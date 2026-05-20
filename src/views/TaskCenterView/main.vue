<script setup lang="ts">
import { inject, computed, ref, onMounted, onUnmounted } from "vue";
import { useI18n } from "vue-i18n";
import { TeamClientKey } from "../../composables/teamClientContext";
import { managerFetch } from "../../api";
import TaskCard from "../../components/TaskCard";
import SvgIcon from "../../components/SvgIcon";
import type { TaskMessage, TaskResource } from "../../types";
import type { Task } from "../../../envoy/packages/core/task.js";

const { t } = useI18n();

const ctx = inject(TeamClientKey)!;
const { teamName, myId, role } = ctx;

const emit = defineEmits<{
  selectTask: [task: TaskMessage];
}>();

interface ApiTask {
  id: string;
  createBy: string;
  subscribe: string[];
  content: string;
  mode: string;
  status: string;
  resources: TaskResource[];
  createdAt: number;
  attempt: number;
}

function apiTaskToTaskMessage(t: ApiTask): TaskMessage {
  return {
    type: "task",
    id: `task-${t.id}`,
    seq: 0,
    taskId: t.id,
    from: t.createBy,
    content: t.content,
    status: t.status as TaskMessage["status"],
    resources: t.resources,
    subscribe: t.subscribe,
    timestamp: t.createdAt,
  };
}

const tasks = ref<TaskMessage[]>([]);
let loading = false;

async function fetchTasks() {
  if (loading) return;
  loading = true;
  try {
    const res = await managerFetch(`/api/teams/${encodeURIComponent(teamName)}/tasks`);
    const data = await res.json() as ApiTask[];
    tasks.value = data.map(apiTaskToTaskMessage);
  } catch {
    // server unreachable, keep existing data
  } finally {
    loading = false;
  }
}

function onTaskUpdate(task: Task) {
  const taskMsg = apiTaskToTaskMessage({
    id: task.id,
    createBy: task.createBy,
    subscribe: task.subscribe,
    content: task.content,
    mode: task.mode,
    status: task.status,
    resources: task.resources,
    createdAt: task.createdAt,
    attempt: task.attempt,
  });

  const idx = tasks.value.findIndex((t) => t.taskId === task.id);
  if (idx >= 0) {
    tasks.value[idx] = taskMsg;
  } else {
    tasks.value.unshift(taskMsg);
  }
  // Trigger reactivity
  tasks.value = [...tasks.value];
}

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
    switch (task.status) {
      case "running":
        running.push(task);
        break;
      case "pending":
        pending.push(task);
        break;
      case "reviewing":
        reviewing.push(task);
        break;
      case "completed":
        completed.push(task);
        break;
      case "failed":
        failed.push(task);
        break;
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

let refreshTimer: ReturnType<typeof setInterval> | undefined;

onMounted(async () => {
  await fetchTasks();
  ctx.client?.on("task", onTaskUpdate);
  refreshTimer = setInterval(fetchTasks, 30000);
});

onUnmounted(() => {
  ctx.client?.off("task", onTaskUpdate);
  if (refreshTimer) clearInterval(refreshTimer);
});
</script>

<template>
  <div class="task-center">
    <div class="task-center-header">
      <span class="header-name">{{ $t('task.taskCenter') }}</span>
    </div>

    <div v-if="allTasks.length === 0" class="empty-state">
      <SvgIcon name="check-circle" :size="48" />
      <p>{{ $t('task.noTasks') }}</p>
    </div>

    <div v-else class="task-groups">
      <div v-for="group in statusGroups" :key="group.key" class="task-group">
        <div v-if="group.tasks.length > 0" class="group-header">
          {{ group.label }} ({{ group.tasks.length }})
        </div>
        <div class="group-tasks">
          <TaskCard v-for="task in group.tasks" :key="task.taskId" :task="task" :team-name="teamName" :my-id="myId" @select-task="emit('selectTask', $event)" />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
@import './styles.css';
</style>
