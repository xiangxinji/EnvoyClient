import { ref } from "vue";
import type { ClientTask } from "../../envoy/packages/client/client.js";
import { SKIP_RESULT } from "../../envoy/packages/client/client.js";
import { useAITask as useAI } from "./useAITask";
import { getTaskService, getMemberSettings } from "./teamClientContext";
import { getErrorMessage } from "../utils/error";
import { writeOutbox, deleteOutbox, submitWithRetry } from "../utils/outbox";
import type { TaskResolution } from "../types";

interface TaskExecutionContext {
  role: "leader" | "member";
  myId: string;
  teamName: string;
}

export function useTaskExecution(ctx: TaskExecutionContext) {
  const currentClientTask = ref<ClientTask | null>(null);
  const currentReviewTask = ref<ClientTask | null>(null);
  const clientTaskQueue = ref<ClientTask[]>([]);
  const isReviewing = ref(false);
  const taskService = getTaskService();

  const autoExecutorRef = ref<((task: ClientTask) => Promise<void>) | null>(null);

  function setAutoExecutor(executor: (task: ClientTask) => Promise<void>) {
    autoExecutorRef.value = executor;
  }

  async function submitTaskResult(taskId: string, result: TaskResolution) {
    const payload = {
      from: ctx.myId,
      success: result.success,
      data: result.data ?? {},
      error: result.error,
      source: result.source,
      submissionId: `${taskId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      ...(result.trace ? { trace: result.trace } : {}),
    };
    try {
      await writeOutbox(ctx.teamName, taskId, payload);
      const ok = await submitWithRetry(() => taskService.submitResult(taskId, payload));
      if (ok) {
        await deleteOutbox(ctx.teamName, taskId);
        console.log(`[task] result submitted: ${taskId}, success=${result.success}, source=${result.source}`);
      } else {
        console.error(`[task] result submit failed after retries: ${taskId}, outbox entry preserved`);
      }
    } catch (e) {
      console.error(`[task] result submit error: ${taskId}`, getErrorMessage(e));
    }
  }

  function registerHandler(client: {
    doing: (handler: (task: ClientTask) => Promise<unknown>) => void;
    reviewing: (handler: (task: ClientTask) => Promise<unknown>) => void;
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
    client.on("task_finished", syncQueue);
    client.on("review_queued", syncQueue);
    client.on("review_started", syncQueue);
    client.on("review_completed", syncQueue);
    client.on("review_failed", syncQueue);
    client.on("review_skipped", syncQueue);
    client.on("review_finished", syncQueue);

    client.doing(async (clientTask) => {
      currentClientTask.value = clientTask;
      const executor = autoExecutorRef.value;
      if (executor) {
        await executor(clientTask);
      }
      return SKIP_RESULT;
    });

    client.reviewing(async (clientTask) => {
      currentReviewTask.value = clientTask;
      const { settings, loadSettings } = getMemberSettings();
      await loadSettings(ctx.myId);
      if (settings.value.task_execution_mode === "auto") {
        void runLeaderReview(clientTask);
      }
      return SKIP_RESULT;
    });
  }

  function resolveCurrentTask(result: TaskResolution) {
    const task = currentClientTask.value;
    if (!task) {
      console.warn("[task] resolveCurrentTask called but currentClientTask is null");
      return;
    }
    void submitTaskResult(task.serverTask.id, result);
  }

  async function runLeaderReview(clientTask: ClientTask) {
    const task = clientTask.serverTask;
    const taskId = task.id;
    const taskContent = task.content;
    const memberResults = task.resources.filter(
      (r: { attempt: number }) => r.attempt === task.attempt,
    );

    isReviewing.value = true;
    try {
      const ai = useAI();
      const reviewResult = await ai.reviewTaskResult(taskContent, memberResults);
      await submitTaskResult(taskId, {
        success: reviewResult.success,
        source: "ai",
        data: { review: reviewResult.summary, ...reviewResult },
      });
    } catch (e) {
      await submitTaskResult(taskId, {
        success: false,
        source: "ai",
        error: `Leader review failed: ${getErrorMessage(e)}`,
      });
    } finally {
      isReviewing.value = false;
      if (currentReviewTask.value?.serverTask.id === taskId) {
        currentReviewTask.value = null;
      }
    }
  }

  function resolveCurrentReview(result: TaskResolution) {
    const task = currentReviewTask.value;
    if (!task) return;
    isReviewing.value = false;
    currentReviewTask.value = null;
    void submitTaskResult(task.serverTask.id, result);
  }

  return {
    registerHandler,
    currentClientTask,
    currentReviewTask,
    clientTaskQueue,
    isReviewing,
    resolveCurrentTask,
    resolveCurrentReview,
    setAutoExecutor,
  };
}
