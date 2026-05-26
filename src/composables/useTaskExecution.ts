import { ref } from "vue";
import type { ClientTask } from "../../envoy/packages/client/client.js";
import { useAITask as useAI } from "./useAITask";
import { getTaskService } from "./teamClientContext";
import { getErrorMessage } from "../utils/error";
import { writeOutbox, deleteOutbox, submitWithRetry } from "../utils/outbox";

const EXECUTION_TIMEOUT_MS = 30 * 60 * 1000;

interface TaskExecutionContext {
  role: "leader" | "member";
  myId: string;
  teamName: string;
}

export function useTaskExecution(ctx: TaskExecutionContext) {
  const currentClientTask = ref<ClientTask | null>(null);
  const clientTaskQueue = ref<ClientTask[]>([]);
  let pendingResolve: ((result: unknown) => void) | null = null;
  let timeoutTimer: ReturnType<typeof setTimeout> | null = null;

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
    client.on("task_finished", (task: ClientTask) => {
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

      return new Promise((resolve) => {
        pendingResolve = resolve;
        timeoutTimer = setTimeout(() => {
          if (pendingResolve === resolve) {
            pendingResolve = null;
            resolve({ error: "execution_timeout" });
          }
        }, EXECUTION_TIMEOUT_MS);
      });
    });
  }

  function resolveCurrentTask(result: unknown) {
    if (timeoutTimer) {
      clearTimeout(timeoutTimer);
      timeoutTimer = null;
    }
    if (pendingResolve) {
      const resolve = pendingResolve;
      pendingResolve = null;
      resolve(result);
    }
  }

  async function handleLeaderReview(clientTask: ClientTask) {
    const task = clientTask.serverTask;
    const taskId = task.id;
    const taskContent = task.content;
    const memberResults = task.resources.filter(
      (r: { attempt: number }) => r.attempt === task.attempt,
    );
    const taskService = getTaskService();

    try {
      const ai = useAI();
      const reviewResult = await ai.reviewTaskResult(taskContent, memberResults);
      const resultPayload = {
        from: ctx.myId,
        success: reviewResult.success,
        data: { review: reviewResult.summary, source: "ai", ...reviewResult },
      };
      await writeOutbox(ctx.teamName, taskId, resultPayload);
      const ok = await submitWithRetry(() => taskService.submitResult(taskId, resultPayload));
      if (ok) await deleteOutbox(ctx.teamName, taskId);
      return reviewResult;
    } catch (e) {
      const errorPayload = {
        from: ctx.myId,
        success: false as const,
        error: `Leader review failed: ${getErrorMessage(e)}`,
      };
      await writeOutbox(ctx.teamName, taskId, errorPayload);
      const ok = await submitWithRetry(() => taskService.submitResult(taskId, errorPayload));
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
