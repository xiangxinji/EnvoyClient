import { ref } from "vue";
import type { ClientTask } from "../../envoy/packages/client/client.js";
import { EXECUTION_TIMEOUT } from "../../envoy/packages/client/client.js";
import { useAITask as useAI } from "./useAITask";
import { getTaskService, getMemberSettings } from "./teamClientContext";
import { getErrorMessage } from "../utils/error";
import { writeOutbox, deleteOutbox, submitWithRetry } from "../utils/outbox";
import type { TaskSubmitResult } from "../services/types";
import type { TaskResolution } from "../types";

const DEFAULT_TIMEOUT_MS = 10 * 60 * 1000;

interface TaskExecutionContext {
  role: "leader" | "member";
  myId: string;
  teamName: string;
}

export function useTaskExecution(ctx: TaskExecutionContext) {
  const currentClientTask = ref<ClientTask | null>(null);
  const clientTaskQueue = ref<ClientTask[]>([]);
  const taskService = getTaskService();

  const pendingResolves = new Map<string, {
    resolve: (result: unknown) => void;
    timer: ReturnType<typeof setTimeout>;
  }>();

  function registerHandler(client: {
    doing: (handler: (task: ClientTask) => Promise<unknown>) => void;
    on: (event: string, handler: (...args: unknown[]) => void) => void;
    taskQueue: readonly ClientTask[];
  }) {
    const syncQueue = () => {
      clientTaskQueue.value = [...client.taskQueue];
    };

    client.on("task_queued", syncQueue);
    client.on("task_started", syncQueue);
    client.on("task_completed", syncQueue);
    client.on("task_failed", syncQueue);
    client.on("task_skipped", syncQueue);
    client.on("task_finished", (...args: unknown[]) => {
      const task = args[0] as ClientTask;
      if (currentClientTask.value?.id === task.id) {
        currentClientTask.value = null;
      }
      syncQueue();
    });

    client.doing(async (clientTask) => {
      const taskStatus = clientTask.serverTask.status;

      // Leader reviewing: execute directly, no queue bridge
      if (ctx.role === "leader" && taskStatus === "reviewing") {
        return await handleLeaderReview(clientTask);
      }

      // Member: bridge to UI, wait for resolveCurrentTask
      currentClientTask.value = clientTask;
      const taskId = clientTask.serverTask.id;

      return new Promise((resolve) => {
        const { settings } = getMemberSettings();
        const timeoutMs = settings.value?.task_execution_timeout_ms ?? DEFAULT_TIMEOUT_MS;
        const timer = setTimeout(() => {
          if (pendingResolves.has(taskId)) {
            pendingResolves.delete(taskId);
            resolve(EXECUTION_TIMEOUT);
          }
        }, timeoutMs);
        pendingResolves.set(taskId, { resolve, timer });
      });
    });
  }

  function resolveCurrentTask(result: TaskResolution) {
    const task = currentClientTask.value;
    if (!task) return;

    const taskId = task.serverTask.id;
    const entry = pendingResolves.get(taskId);
    if (entry) {
      clearTimeout(entry.timer);
      pendingResolves.delete(taskId);
    }

    const payload = buildResultPayload(result);

    // Write outbox first, then async submit
    void (async () => {
      await writeOutbox(ctx.teamName, taskId, payload);
      const ok = await submitWithRetry(() => taskService.submitResult(taskId, payload));
      if (ok) await deleteOutbox(ctx.teamName, taskId);
    })();

    if (entry) {
      entry.resolve(result);
    }
  }

  function buildResultPayload(result: TaskResolution): TaskSubmitResult & { submissionId: string; source: string } {
    const task = currentClientTask.value;
    const taskId = task?.serverTask.id ?? "unknown";
    return {
      from: ctx.myId,
      success: result.success,
      data: result.data ?? {},
      error: result.error,
      source: result.source,
      submissionId: `${taskId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      ...(result.trace ? { trace: result.trace } : {}),
    };
  }

  async function handleLeaderReview(clientTask: ClientTask) {
    const task = clientTask.serverTask;
    const taskId = task.id;
    const taskContent = task.content;
    const memberResults = task.resources.filter(
      (r: { attempt: number }) => r.attempt === task.attempt,
    );

    try {
      const ai = useAI();
      const reviewResult = await ai.reviewTaskResult(taskContent, memberResults);
      const resolution: TaskResolution = {
        success: reviewResult.success,
        source: "ai",
        data: { review: reviewResult.summary, ...reviewResult },
      };
      const payload = buildResultPayload(resolution);
      await writeOutbox(ctx.teamName, taskId, payload);
      const ok = await submitWithRetry(() => taskService.submitResult(taskId, payload));
      if (ok) await deleteOutbox(ctx.teamName, taskId);
      return reviewResult;
    } catch (e) {
      const resolution: TaskResolution = {
        success: false,
        source: "ai",
        error: `Leader review failed: ${getErrorMessage(e)}`,
      };
      const payload = buildResultPayload(resolution);
      await writeOutbox(ctx.teamName, taskId, payload);
      const ok = await submitWithRetry(() => taskService.submitResult(taskId, payload));
      if (ok) await deleteOutbox(ctx.teamName, taskId);
      return { error: getErrorMessage(e) };
    }
  }

  return {
    registerHandler,
    currentClientTask,
    clientTaskQueue,
    resolveCurrentTask,
  };
}
