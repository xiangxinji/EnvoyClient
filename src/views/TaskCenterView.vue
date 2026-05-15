<script setup lang="ts">
import { inject, computed } from "vue";
import { TeamClientKey } from "../composables/teamClientContext";
import TaskCard from "../components/TaskCard.vue";
import type { TaskMessage } from "../types";

const ctx = inject(TeamClientKey)!;
const { messages, teamName, myId } = ctx;

// Collect all TaskMessage items from all conversations
const allTasks = computed<TaskMessage[]>(() => {
  const tasks: TaskMessage[] = [];
  const seen = new Set<string>();
  for (const items of messages.value.values()) {
    for (const item of items) {
      if (item.type === "task" && !seen.has(item.taskId)) {
        seen.add(item.taskId);
        tasks.push(item);
      }
    }
  }
  return tasks;
});

const groupedTasks = computed(() => {
  const running: TaskMessage[] = [];
  const pending: TaskMessage[] = [];
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
      case "completed":
        completed.push(task);
        break;
      case "failed":
        failed.push(task);
        break;
    }
  }

  return { running, pending, completed, failed };
});

const statusGroups = computed(() => [
  { key: "running", label: "执行中", tasks: groupedTasks.value.running },
  { key: "pending", label: "等待中", tasks: groupedTasks.value.pending },
  { key: "completed", label: "已完成", tasks: groupedTasks.value.completed },
  { key: "failed", label: "失败", tasks: groupedTasks.value.failed },
]);
</script>

<template>
  <div class="task-center">
    <div class="task-center-header">
      <span class="header-name">任务中心</span>
    </div>

    <div v-if="allTasks.length === 0" class="empty-state">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <path d="M9 11l3 3L22 4" />
        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
      </svg>
      <p>暂无任务</p>
    </div>

    <div v-else class="task-groups">
      <div v-for="group in statusGroups" :key="group.key" class="task-group">
        <div v-if="group.tasks.length > 0" class="group-header">
          {{ group.label }} ({{ group.tasks.length }})
        </div>
        <div class="group-tasks">
          <TaskCard v-for="task in group.tasks" :key="task.taskId" :task="task" :team-name="teamName" :my-id="myId" />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.task-center {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: transparent;
}

.task-center-header {
  padding: var(--space-md) var(--space-lg);
  border-bottom: 1px solid var(--glass-border);
  background: var(--glass-bg-heavy);
  backdrop-filter: blur(var(--glass-blur));
  -webkit-backdrop-filter: blur(var(--glass-blur));
}

.header-name {
  font-weight: 600;
  color: var(--text-primary);
}

.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-md);
  color: var(--text-muted);
}

.empty-state svg {
  color: var(--empty-icon);
}

.empty-state p {
  margin: 0;
  font-size: 0.9em;
}

.task-groups {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-lg);
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
}

.task-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.group-header {
  font-size: 0.8em;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  padding-bottom: var(--space-xs);
  border-bottom: 1px solid var(--border-light);
}

.group-tasks {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}
</style>
