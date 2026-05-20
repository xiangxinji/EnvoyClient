import { ref, onMounted, onUnmounted } from "vue";
import type { TaskMessage } from "../types";
import { apiTaskToTaskMessage, type ApiTask } from "../utils/taskFormatters";
import { getTaskService, getTeamClientInstance } from "./teamClientContext";
import type { Task } from "../../envoy/packages/core/task.js";

export function useTaskLiveData(initialTask: TaskMessage) {
  const ctx = getTeamClientInstance()!;
  const taskService = getTaskService();

  const liveTask = ref<TaskMessage>({ ...initialTask });

  async function fetchTask() {
    try {
      const t = await taskService.fetchDetail(liveTask.value.taskId);
      liveTask.value = apiTaskToTaskMessage(t);
    } catch { /* ignore */ }
  }

  function onTaskUpdate(task: Task) {
    if (task.id === liveTask.value.taskId) {
      liveTask.value = apiTaskToTaskMessage(task as unknown as ApiTask);
    }
  }

  onMounted(async () => {
    await fetchTask();
    ctx.client?.on("task", onTaskUpdate);
  });

  onUnmounted(() => {
    ctx.client?.off("task", onTaskUpdate);
  });

  return { liveTask, refresh: fetchTask };
}
