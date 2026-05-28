<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from "vue";
import { useI18n } from "vue-i18n";
import { getTeamClientInstance } from "../../composables/teamClientContext";
import { useTaskCenterExecution } from "../../composables/useTaskCenterExecution";
import { managerFetch } from "../../api";
import TaskCard from "../../components/TaskCard";
import SvgIcon from "../../components/SvgIcon";
import type { TaskMessage } from "../../types";
import type { Task } from "../../../envoy/packages/core/task.js";
import type { ClientTask } from "../../../envoy/packages/client/client.js";
import { apiTaskToTaskMessage, type ApiTask } from "../../utils/taskFormatters";

const { t } = useI18n();

const ctx = getTeamClientInstance()!;
const { teamName, myId, role, currentClientTask, currentReviewTask, clientTaskQueue, isReviewing, resolveCurrentTask, resolveCurrentReview, setAutoExecutor } = ctx;

const emit = defineEmits<{
  selectTask: [task: TaskMessage];
}>();

// Task center execution composable (Member only)
const taskExec = role === "member"
  ? useTaskCenterExecution({ myId, teamName }, currentClientTask, resolveCurrentTask, setAutoExecutor)
  : null;

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
  tasks.value = [...tasks.value];
}

function clientTaskToTaskMessage(ct: ClientTask): TaskMessage {
  const st = ct.serverTask;
  return apiTaskToTaskMessage({
    id: st.id,
    createBy: st.createBy,
    subscribe: st.subscribe,
    content: st.content,
    mode: st.mode,
    status: st.status,
    resources: st.resources,
    createdAt: st.createdAt,
    attempt: st.attempt,
  });
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

    <div v-if="allTasks.length === 0 && !currentTaskMsg && queuedTaskMsgs.length === 0" class="empty-state">
      <SvgIcon name="check-circle" :size="48" />
      <p>{{ $t('task.noTasks') }}</p>
    </div>

    <div v-else class="task-groups">
      <!-- Current task section (Member only) -->
      <div v-if="role === 'member' && currentTaskMsg" class="task-group">
        <div class="group-header current-task-header">
          {{ t('task.currentTask', '当前任务') }}
          <span v-if="taskExec?.isRunning?.value" class="execution-badge">{{ t('task.executing', '执行中...') }}</span>
        </div>
        <TaskCard
          :task="currentTaskMsg"
          :team-name="teamName"
          :my-id="myId"
          :show-actions="true"
          @select-task="emit('selectTask', $event)"
          @task-resolved="resolveCurrentTask({ success: true, source: 'manual' })"
        />
        <div v-if="taskExec" class="manual-execute">
          <button v-if="taskExec.isRunning?.value" class="abort-btn" @click="resolveCurrentTask({ success: false, source: 'aborted', error: 'User aborted' })">
            {{ t('task.abort', '中止任务') }}
          </button>
          <button v-else class="execute-btn" @click="taskExec.executeCurrentTask()">
            {{ t('task.execute', '执行任务') }}
          </button>
        </div>
      </div>

      <!-- Queued tasks section (Member only) -->
      <div v-if="role === 'member' && queuedTaskMsgs.length > 0" class="task-group">
        <div class="group-header">{{ t('task.queued', '等待中') }} ({{ queuedTaskMsgs.length }})</div>
        <TransitionGroup name="task-list" tag="div" class="group-tasks">
          <TaskCard
            v-for="task in queuedTaskMsgs"
            :key="task.taskId"
            :task="task"
            :team-name="teamName"
            :my-id="myId"
            @select-task="emit('selectTask', $event)"
          />
        </TransitionGroup>
      </div>

      <!-- Reviewing task section (Leader only) -->
      <div v-if="role === 'leader' && reviewTaskMsg" class="task-group">
        <div class="group-header current-task-header">
          {{ t('task.reviewing', '审核中') }}
          <span v-if="isReviewing" class="execution-badge">{{ t('task.aiReviewing', 'AI 审核中...') }}</span>
        </div>
        <TaskCard
          :task="reviewTaskMsg"
          :team-name="teamName"
          :my-id="myId"
          @select-task="emit('selectTask', $event)"
        />
        <div v-if="!isReviewing" class="manual-review">
          <button class="approve-btn" @click="resolveCurrentReview({ success: true, source: 'manual', data: {} })">
            {{ t('task.approve', '通过') }}
          </button>
          <button class="reject-btn" @click="resolveCurrentReview({ success: false, source: 'manual', error: 'Leader rejected' })">
            {{ t('task.reject', '驳回') }}
          </button>
        </div>
      </div>

      <!-- Regular status groups -->
      <div v-for="group in statusGroups" :key="group.key" class="task-group">
        <div v-if="group.tasks.length > 0" class="group-header">
          {{ group.label }} ({{ group.tasks.length }})
        </div>
        <TransitionGroup name="task-list" tag="div" class="group-tasks">
          <TaskCard
            v-for="task in group.tasks"
            :key="task.taskId"
            :task="task"
            :team-name="teamName"
            :my-id="myId"
            @select-task="emit('selectTask', $event)"
          />
        </TransitionGroup>
      </div>
    </div>
  </div>
</template>

<style scoped>
@import './styles.css';
</style>
