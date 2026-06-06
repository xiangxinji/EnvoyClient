import { computed, ref, onMounted, onUnmounted } from "vue";
import { useI18n } from "vue-i18n";
import { getTeamClientInstance, getTaskService } from "./teamClientContext";
import { useToast } from "./useToast";
import { apiTaskToTaskMessage } from "../utils/taskFormatters";
import type { TaskMessage } from "../types";
import type { Task } from "../../envoy/packages/core/task.js";
import type { ClientTask } from "../../envoy/packages/client/client.js";

export function useTaskCenterData() {
  const { t } = useI18n();
  const { showToast } = useToast();

  const ctx = getTeamClientInstance()!;
  const { teamName, myId, role, currentClientTask, currentReviewTask, clientTaskQueue, isReviewing, resolveCurrentTask, resolveCurrentReview, setAutoExecutor } = ctx;
  const taskService = getTaskService();

  const tasks = ref<TaskMessage[]>([]);
  const loading = ref(false);

  async function fetchTasks() {
    if (loading.value) return;
    loading.value = true;
    try {
      const data = await taskService.listTasks();
      tasks.value = data.map(apiTaskToTaskMessage);
    } catch {
      showToast(t('common.operationFailed'), "error");
    } finally {
      loading.value = false;
    }
  }

  function onTaskUpdate(task: Task) {
    const taskMsg = apiTaskToTaskMessage(task);
    const idx = tasks.value.findIndex((t) => t.taskId === task.id);
    if (idx >= 0) tasks.value[idx] = taskMsg;
    else tasks.value.unshift(taskMsg);
    tasks.value = [...tasks.value];
  }

  function clientTaskToTaskMessage(ct: ClientTask): TaskMessage {
    return apiTaskToTaskMessage(ct.serverTask);
  }

  // IDs currently in the ClientTask queue (current + waiting)
  const queuedTaskIds = computed(() => {
    const ids = new Set<string>();
    if (currentClientTask.value) {
      ids.add(currentClientTask.value.serverTask.id);
    }
    for (const ct of clientTaskQueue.value) {
      ids.add(ct.serverTask.id);
    }
    return ids;
  });

  // Current task as TaskMessage (for display)
  const currentTaskMsg = computed<TaskMessage | null>(() => {
    if (!currentClientTask.value) return null;
    const ct = currentClientTask.value;
    const latest = tasks.value.find((t) => t.taskId === ct.serverTask.id);
    return latest ?? clientTaskToTaskMessage(ct);
  });

  // Current review task as TaskMessage (Leader only)
  const reviewTaskMsg = computed<TaskMessage | null>(() => {
    if (!currentReviewTask.value) return null;
    const ct = currentReviewTask.value;
    const latest = tasks.value.find((t) => t.taskId === ct.serverTask.id);
    return latest ?? clientTaskToTaskMessage(ct);
  });

  // Queued tasks as TaskMessage list
  const queuedTaskMsgs = computed<TaskMessage[]>(() => {
    return clientTaskQueue.value.map((ct) => {
      const latest = tasks.value.find((t) => t.taskId === ct.serverTask.id);
      return latest ?? clientTaskToTaskMessage(ct);
    });
  });

  const allTasks = computed<TaskMessage[]>(() => {
    if (role === "leader") {
      return [...tasks.value].sort((a, b) => b.timestamp - a.timestamp);
    }
    return tasks.value
      .filter((t) => t.from === myId || t.subscribe?.includes(myId))
      .sort((a, b) => b.timestamp - a.timestamp);
  });

  const groupedTasks = computed(() => {
    const running: TaskMessage[] = [];
    const pending: TaskMessage[] = [];
    const reviewing: TaskMessage[] = [];
    const completed: TaskMessage[] = [];
    const failed: TaskMessage[] = [];

    for (const task of allTasks.value) {
      // Exclude tasks currently in the ClientTask queue (shown in current/queued sections)
      if (role === "member" && queuedTaskIds.value.has(task.taskId)) continue;

      switch (task.status) {
        case "running": running.push(task); break;
        case "pending": pending.push(task); break;
        case "reviewing": reviewing.push(task); break;
        case "completed": completed.push(task); break;
        case "failed": failed.push(task); break;
      }
    }

    return { running, pending, reviewing, completed, failed };
  });

  const statusGroups = computed(() => [
    { key: "running", label: t('task.status.running'), tasks: groupedTasks.value.running },
    { key: "pending", label: t('task.status.pending'), tasks: groupedTasks.value.pending },
    { key: "reviewing", label: t('task.status.reviewing'), tasks: groupedTasks.value.reviewing },
    { key: "completed", label: t('task.status.completed'), tasks: groupedTasks.value.completed },
    { key: "failed", label: t('task.status.failed'), tasks: groupedTasks.value.failed },
  ]);

  onMounted(async () => {
    await fetchTasks();
    ctx.client?.on("task", onTaskUpdate);
  });

  onUnmounted(() => {
    ctx.client?.off("task", onTaskUpdate);
  });

  return {
    tasks, loading, fetchTasks,
    currentTaskMsg, reviewTaskMsg, queuedTaskMsgs, queuedTaskIds,
    allTasks, groupedTasks, statusGroups,
    teamName, myId, role,
    currentClientTask, currentReviewTask, clientTaskQueue,
    isReviewing, resolveCurrentTask, resolveCurrentReview, setAutoExecutor,
  };
}
