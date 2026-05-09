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
  border: 1px solid #ddd;
  background: #fff;
  align-self: flex-start;
}

.task-card.running {
  border-color: #3182ce;
}

.task-card.completed {
  border-color: #38a169;
}

.task-card.failed {
  border-color: #e53e3e;
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
  color: #555;
}

.status-badge {
  font-size: 0.7em;
  padding: 2px 8px;
  border-radius: 3px;
  text-transform: uppercase;
}

.status-badge.pending {
  background: #edf2f7;
  color: #718096;
}

.status-badge.running {
  background: #ebf8ff;
  color: #3182ce;
}

.status-badge.completed {
  background: #f0fff4;
  color: #38a169;
}

.status-badge.failed {
  background: #fff5f5;
  color: #e53e3e;
}

.task-content {
  font-size: 0.95em;
  line-height: 1.4;
}

.task-meta {
  margin-top: 6px;
  font-size: 0.75em;
  color: #999;
}
</style>
