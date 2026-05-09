<script setup lang="ts">
import type { TaskMessage } from "../types";

defineProps<{
  task: TaskMessage;
}>();

const statusLabels: Record<TaskMessage["status"], string> = {
  pending: "Pending",
  running: "Running",
  completed: "Completed",
  failed: "Failed",
};
</script>

<template>
  <div class="task-card" :class="task.status">
    <div class="task-header">
      <span class="task-icon">Task</span>
      <span class="status-badge" :class="task.status">{{ statusLabels[task.status] }}</span>
    </div>
    <div class="task-content">{{ task.content }}</div>
    <div class="task-meta">
      <span>from: {{ task.from }}</span>
    </div>
  </div>
</template>

<style scoped>
.task-card {
  max-width: 85%;
  padding: 10px 14px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--task-card-bg);
  color: var(--text-primary);
  align-self: flex-start;
}

.task-card.running {
  border-color: var(--task-running-border);
}

.task-card.completed {
  border-color: var(--task-completed-border);
}

.task-card.failed {
  border-color: var(--task-failed-border);
}

.task-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}

.task-icon {
  font-weight: 600;
  font-size: 0.85em;
  color: var(--text-secondary);
}

.status-badge {
  font-size: 0.7em;
  padding: 2px 8px;
  border-radius: 3px;
  text-transform: uppercase;
}

.status-badge.pending {
  background: var(--task-pending-bg);
  color: var(--task-pending-text);
}

.status-badge.running {
  background: var(--task-running-bg);
  color: var(--task-running-text);
}

.status-badge.completed {
  background: var(--task-completed-bg);
  color: var(--task-completed-text);
}

.status-badge.failed {
  background: var(--task-failed-bg);
  color: var(--task-failed-text);
}

.task-content {
  font-size: 0.95em;
  line-height: 1.4;
}

.task-meta {
  margin-top: 6px;
  font-size: 0.75em;
  color: var(--text-muted);
}
</style>
