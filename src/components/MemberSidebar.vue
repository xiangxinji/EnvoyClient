<script setup lang="ts">
import { inject, computed } from "vue";
import { TeamClientKey } from "../composables/teamClientContext";

defineProps<{
  selectedPeer: string;
}>();

const emit = defineEmits<{
  select: [peerId: string];
}>();

const ctx = inject(TeamClientKey)!;
const { members, unreadCounts, markRead, messages } = ctx;

// Count all tasks across all conversations
const taskCount = computed(() => {
  let count = 0;
  const seen = new Set<string>();
  for (const items of messages.value.values()) {
    for (const item of items) {
      if (item.type === "task" && !seen.has(item.taskId)) {
        seen.add(item.taskId);
        count++;
      }
    }
  }
  return count;
});

function handleClick(peerId: string) {
  markRead(peerId);
  emit("select", peerId);
}

function formatBadge(count: number): string {
  if (count > 99) return "99+";
  return String(count);
}

function getInitial(name: string): string {
  return name.charAt(0).toUpperCase();
}
</script>

<template>
  <aside class="sidebar">
    <div class="sidebar-header">
      <h3>成员</h3>
    </div>
    <ul>
      <!-- Task center entry -->
      <li
        class="task-center-entry"
        :class="{ active: selectedPeer === '__tasks__' }"
        @click="emit('select', '__tasks__')"
      >
        <div class="avatar task-center-avatar">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
            <rect x="9" y="3" width="6" height="4" rx="1" />
            <path d="M9 14l2 2 4-4" />
          </svg>
        </div>
        <div class="member-info">
          <span class="member-name">任务中心</span>
        </div>
        <span v-if="taskCount > 0" class="badge badge-task">
          {{ formatBadge(taskCount) }}
        </span>
      </li>

      <!-- Dispatch task entry (leader only) -->
      <li
        v-if="ctx.role === 'leader'"
        class="task-center-entry"
        :class="{ active: selectedPeer === '__dispatch__' }"
        @click="emit('select', '__dispatch__')"
      >
        <div class="avatar dispatch-avatar">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
          </svg>
        </div>
        <div class="member-info">
          <span class="member-name">分派任务</span>
        </div>
      </li>

      <li
        v-for="m in members"
        :key="m.id"
        :class="{ active: m.id === selectedPeer }"
        @click="handleClick(m.id)"
      >
        <div class="avatar">
          {{ getInitial(m.id) }}
          <span class="status-dot" :class="m.status"></span>
        </div>
        <div class="member-info">
          <span class="member-name">{{ m.id }}</span>
          <span class="member-role" :class="m.role">{{ m.role }}</span>
        </div>
        <span v-if="(unreadCounts.get(m.id) ?? 0) > 0" class="badge">
          {{ formatBadge(unreadCounts.get(m.id) ?? 0) }}
        </span>
      </li>
      <li v-if="members.length === 0" class="empty">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
        <span>暂无成员</span>
      </li>
    </ul>
    <div class="sidebar-footer">
      <div class="sidebar-divider"></div>
      <div
        class="settings-entry"
        :class="{ active: selectedPeer === '__settings__' }"
        @click="emit('select', '__settings__')"
      >
        <div class="avatar settings-avatar">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </div>
        <span class="settings-label">设置</span>
      </div>
    </div>
  </aside>
</template>

<style scoped>
.sidebar {
  width: 260px;
  min-width: 260px;
  border-right: 1px solid var(--glass-border);
  display: flex;
  flex-direction: column;
  background: var(--glass-bg);
  backdrop-filter: blur(var(--glass-blur));
  -webkit-backdrop-filter: blur(var(--glass-blur));
}

.sidebar-header {
  padding: var(--space-lg);
  padding-bottom: var(--space-sm);
}

h3 {
  margin: 0;
  font-size: 0.85em;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

ul {
  list-style: none;
  margin: 0;
  padding: var(--space-sm);
  overflow-y: auto;
  flex: 1;
}

li {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  padding: 10px var(--space-md);
  border-radius: var(--radius-md);
  cursor: pointer;
  color: var(--text-primary);
  transition: background 0.1s;
}

li:hover {
  background: var(--sidebar-hover);
}

li.active {
  background: var(--sidebar-active);
}

.avatar {
  position: relative;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: var(--accent-light);
  color: var(--accent);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: 0.85em;
  flex-shrink: 0;
}

.status-dot {
  position: absolute;
  bottom: 0;
  right: 0;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  border: 2px solid var(--bg-secondary);
}

.status-dot.online {
  background: var(--online-dot);
}

.status-dot.offline {
  background: var(--text-muted);
}

.member-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.member-name {
  font-weight: 500;
  font-size: 0.9em;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.member-role {
  font-size: 0.7em;
  padding: 1px 6px;
  border-radius: var(--radius-sm);
  width: fit-content;
  font-weight: 500;
}

.member-role.leader {
  background: var(--role-leader-bg);
  color: var(--role-leader-text);
}

.member-role.member {
  background: var(--role-member-bg);
  color: var(--role-member-text);
}

.badge {
  background: var(--badge-bg);
  color: white;
  font-size: 0.7em;
  font-weight: 600;
  padding: 2px 7px;
  border-radius: 10px;
  min-width: 20px;
  text-align: center;
  flex-shrink: 0;
}

.empty {
  flex-direction: column;
  gap: var(--space-sm);
  padding: var(--space-2xl) var(--space-lg);
  color: var(--text-muted);
  cursor: default;
  font-size: 0.85em;
  text-align: center;
}

.empty svg {
  color: var(--empty-icon);
}

/* Task center entry */
.task-center-entry {
  margin-bottom: var(--space-xs);
  border-bottom: 1px solid var(--border-light);
  padding-bottom: var(--space-md);
}

.task-center-avatar {
  background: var(--bg-tertiary);
  color: var(--text-secondary);
}

.badge-task {
  background: var(--accent);
}

.dispatch-avatar {
  background: rgba(255, 149, 10, 0.12);
  color: #ff9f0a;
}

/* Footer settings */
.sidebar-footer {
  flex-shrink: 0;
  background: transparent;
}

.sidebar-divider {
  height: 1px;
  background: var(--border);
  margin: 0 var(--space-md);
}

.settings-entry {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  padding: 10px var(--space-md);
  border-radius: var(--radius-md);
  cursor: pointer;
  color: var(--text-secondary);
  transition: background 0.1s;
}

.settings-entry:hover {
  background: var(--sidebar-hover);
  color: var(--text-primary);
}

.settings-entry.active {
  background: var(--sidebar-active);
  color: var(--text-primary);
}

.settings-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: var(--bg-tertiary);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.settings-label {
  font-size: 0.9em;
  font-weight: 500;
}
</style>
