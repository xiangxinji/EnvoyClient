import { ref, inject, onMounted, onUnmounted } from "vue";
import type { TaskMessage } from "../types";
import type { ApiTask } from "../utils/taskFormatters";
import { apiTaskToTaskMessage } from "../utils/taskFormatters";
import { managerFetch } from "../api";
import { TeamClientKey } from "./teamClientContext";
import type { Task } from "../../envoy/packages/core/task.js";

export function useTaskLiveData(initialTask: TaskMessage) {
  const ctx = inject(TeamClientKey)!;

  const liveTask = ref<TaskMessage>({ ...initialTask });

  async function fetchTask() {
    try {
      const res = await managerFetch(`/api/teams/${encodeURIComponent(ctx.teamName)}/tasks/${liveTask.value.taskId}`);
      if (!res.ok) return;
      const t = await res.json() as ApiTask;
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
