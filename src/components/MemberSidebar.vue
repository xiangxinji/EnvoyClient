<script setup lang="ts">
import { inject, computed, onMounted, onUnmounted } from "vue";
import { useI18n } from "vue-i18n";
import { TeamClientKey, getMemberSettings } from "../composables/teamClientContext";
import type { TaskExecutionMode } from "../composables/useMemberSettings";

const { t } = useI18n();

const props = defineProps<{
  selectedPeer: string;
}>();

const emit = defineEmits<{
  select: [peerId: string];
}>();

const ctx = inject(TeamClientKey)!;
const { members, unreadCounts, markRead, messages, myId } = ctx;
const { settings: memberSettings, saveSettings } = getMemberSettings();

const isAutoMode = computed(() => memberSettings.value.task_execution_mode === "auto");
const isAutoReply = computed(() => memberSettings.value.ai_auto_reply);

/** Ordered list of all selectable peer IDs in the sidebar */
const navItems = computed(() => {
  const items: string[] = ["__tasks__"];
  if (ctx.role === "leader") items.push("__dispatch__");
  for (const m of members.value) {
    items.push(m.id);
  }
  return items;
});

function handleKeyDown(e: KeyboardEvent) {
  if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
  const target = e.target as HTMLElement;
  if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) return;

  e.preventDefault();
  const items = navItems.value;
  if (items.length === 0) return;

  const idx = items.indexOf(props.selectedPeer);
  let next: number;
  if (e.key === "ArrowUp") {
    next = idx <= 0 ? items.length - 1 : idx - 1;
  } else {
    next = idx >= items.length - 1 ? 0 : idx + 1;
  }
  const peerId = items[next]!;
  markRead(peerId);
  emit("select", peerId);
}

onMounted(() => window.addEventListener("keydown", handleKeyDown));
onUnmounted(() => window.removeEventListener("keydown", handleKeyDown));

async function toggleExecutionMode() {
  const next: TaskExecutionMode = isAutoMode.value ? "manual" : "auto";
  await saveSettings(myId, { task_execution_mode: next });
}

async function toggleAutoReply() {
  const next = !isAutoReply.value;
  await saveSettings(myId, { ai_auto_reply: next });
  if (!next) {
    ctx.autoReplyDispose?.();
  }
}

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
      <h3>{{ t('sidebar.members') }}</h3>
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
          <span class="member-name">{{ t('sidebar.taskCenter') }}</span>
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
          <span class="member-name">{{ t('sidebar.taskDispatch') }}</span>
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
        <span>{{ t('sidebar.noMembers') }}</span>
      </li>
    </ul>

    <div class="sidebar-footer">
      <div class="user-menu-wrapper">
        <div class="user-avatar-btn" :title="myId">
          {{ getInitial(myId) }}
        </div>
        <div class="user-menu" @click.stop>
          <button class="user-menu-item" :class="{ active: selectedPeer === '__quick__' }" @click="emit('select', '__quick__')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="2" y="4" width="20" height="16" rx="2" />
              <path d="M6 8h.01M10 8h.01M14 8h.01M18 8h.01M8 12h.01M12 12h.01M16 12h.01M9 16h6" />
            </svg>
            {{ t('sidebar.shortcuts') }}
          </button>
          <button class="user-menu-item" :class="{ active: selectedPeer === '__settings__' }" @click="emit('select', '__settings__')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
            {{ t('sidebar.settings') }}
          </button>
        </div>
      </div>
      <div class="quick-toggles">
        <button
          class="quick-toggle"
          :class="{ active: isAutoReply }"
          :title="t('sidebar.aiAutoReply')"
          @click="toggleAutoReply"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </button>
        <button
          class="quick-toggle"
          :class="{ active: isAutoMode }"
          :title="t('sidebar.aiTaskMode')"
          @click="toggleExecutionMode"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
          </svg>
        </button>
      </div>
    </div>
  </aside>
</template>

<style scoped>
.sidebar {
  width: 220px;
  min-width: 220px;
  border-right: 1px solid var(--glass-border);
  display: flex;
  flex-direction: column;
  background: var(--glass-bg);
  backdrop-filter: blur(var(--glass-blur));
  -webkit-backdrop-filter: blur(var(--glass-blur));
}

.sidebar-header {
  padding: var(--space-md) var(--space-md);
  padding-bottom: var(--space-xs);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

h3 {
  margin: 0;
  font-size: 0.8em;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

ul {
  list-style: none;
  margin: 0;
  padding: var(--space-xs);
  overflow-y: auto;
  flex: 1;
}

li {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: 6px var(--space-sm);
  border-radius: var(--radius-sm);
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
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: var(--accent-light);
  color: var(--accent);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: 0.75em;
  flex-shrink: 0;
}

.status-dot {
  position: absolute;
  bottom: 0;
  right: 0;
  width: 8px;
  height: 8px;
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
  align-items: baseline;
  gap: var(--space-xs);
  min-width: 0;
}

.member-name {
  font-weight: 500;
  font-size: 0.85em;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.member-role {
  font-size: 0.65em;
  padding: 1px 5px;
  border-radius: var(--radius-sm);
  font-weight: 500;
  flex-shrink: 0;
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
  font-size: 0.65em;
  font-weight: 600;
  padding: 1px 6px;
  border-radius: 10px;
  min-width: 18px;
  text-align: center;
  flex-shrink: 0;
}

.empty {
  flex-direction: column;
  gap: var(--space-sm);
  padding: var(--space-xl) var(--space-md);
  color: var(--text-muted);
  cursor: default;
  font-size: 0.8em;
  text-align: center;
}

.empty svg {
  color: var(--empty-icon);
}

/* Task center / dispatch entries */
.task-center-entry {
  padding: 6px var(--space-sm);
}

.task-center-avatar {
  background: var(--bg-tertiary);
  color: var(--text-secondary);
}

.task-center-avatar svg,
.dispatch-avatar svg {
  width: 14px;
  height: 14px;
}

.badge-task {
  background: var(--accent);
}

.dispatch-avatar {
  background: var(--warning-bg);
  color: var(--warning);
}

/* User avatar button */
.user-avatar-btn {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  border: none;
  background: var(--accent-light);
  color: var(--accent);
  font-weight: 600;
  font-size: 0.75em;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
}

.user-avatar-btn:hover {
  background: var(--sidebar-hover);
}

/* User menu dropdown */
.user-menu-wrapper {
  position: relative;
}

.user-menu {
  position: absolute;
  bottom: 100%;
  left: 0;
  margin-bottom: 4px;
  background: var(--glass-bg-heavy);
  backdrop-filter: blur(var(--glass-blur));
  -webkit-backdrop-filter: blur(var(--glass-blur));
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-sm);
  box-shadow: var(--glass-shadow);
  min-width: 120px;
  overflow: hidden;
  opacity: 0;
  visibility: hidden;
  transform: translateY(4px);
  transition: opacity 0.15s, visibility 0.15s, transform 0.15s;
}

.user-menu-wrapper:hover .user-menu {
  opacity: 1;
  visibility: visible;
  transform: translateY(0);
}

.user-menu-item {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  width: 100%;
  padding: 8px 12px;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  font-size: 0.82em;
  cursor: pointer;
  transition: all 0.1s;
}

.user-menu-item:hover {
  background: var(--sidebar-hover);
  color: var(--text-primary);
}

.user-menu-item.active {
  color: var(--accent);
}

/* Footer */
.sidebar-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-sm) var(--space-md);
  border-top: 1px solid var(--glass-border);
}

/* Quick toggle buttons */
.quick-toggles {
  display: flex;
  align-items: center;
  gap: 4px;
}

.quick-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-sm);
  background: var(--glass-bg-light);
  color: var(--text-muted);
  cursor: pointer;
  transition: all 0.15s;
  flex-shrink: 0;
}

.quick-toggle:hover {
  background: var(--sidebar-hover);
  color: var(--text-secondary);
}

.quick-toggle.active {
  background: var(--accent-light);
  color: var(--accent);
  border-color: var(--accent);
}
</style>
