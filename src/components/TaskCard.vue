<script setup lang="ts">
import type { TaskMessage } from "../types";

defineProps<{
  task: TaskMessage;
}>();

const statusLabels: Record<TaskMessage["status"], string> = {
  pending: "等待中",
  running: "执行中",
  completed: "已完成",
  failed: "失败",
};
</script>

<template>
  <div class="task-card" :class="task.status">
    <div class="task-header">
      <div class="task-title">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M9 11l3 3L22 4" />
          <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
        </svg>
        <span>任务</span>
      </div>
      <span class="status-badge" :class="task.status">{{ statusLabels[task.status] }}</span>
    </div>
    <div class="task-content">{{ task.content }}</div>
    <div class="task-meta">
      <span>来自 {{ task.from }}</span>
    </div>
  </div>
</template>

<style scoped>
.task-card {
  max-width: 80%;
  padding: var(--space-md) var(--space-lg);
  border-radius: var(--radius-md);
  border: 1px solid var(--border);
  border-left: 3px solid var(--border);
  background: var(--task-card-bg);
  color: var(--text-primary);
  align-self: flex-start;
  box-shadow: var(--shadow-sm);
}

.task-card.running {
  border-left-color: var(--task-running-border);
}

.task-card.completed {
  border-left-color: var(--task-completed-border);
}

.task-card.failed {
  border-left-color: var(--task-failed-border);
}

.task-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-sm);
}

.task-title {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  font-weight: 600;
  font-size: 0.8em;
  color: var(--text-secondary);
}

.status-badge {
  font-size: 0.7em;
  padding: 2px 8px;
  border-radius: var(--radius-sm);
  font-weight: 500;
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
  font-size: 0.9em;
  line-height: 1.4;
}

.task-meta {
  margin-top: var(--space-sm);
  font-size: 0.72em;
  color: var(--text-muted);
}
</style>
