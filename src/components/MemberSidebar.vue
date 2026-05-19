<script setup lang="ts">
import { inject, computed, ref, onMounted, onUnmounted } from "vue";
import { useI18n } from "vue-i18n";
import { TeamClientKey, getMemberSettings } from "../composables/teamClientContext";
import GlassInput from "./GlassInput.vue";
import MemberHoverCard from "./MemberHoverCard.vue";
import ToolHoverCard from "./ToolHoverCard.vue";
import { useSidebarSearch } from "../composables/useSidebarSearch";
import type { TaskExecutionMode } from "../composables/useMemberSettings";
import type { MemberInfo } from "../types";

const { t } = useI18n();

const props = defineProps<{
  selectedPeer: string;
}>();

const emit = defineEmits<{
  select: [peerId: string];
}>();

const ctx = inject(TeamClientKey)!;
const { members, unreadCounts, markRead, messages, myId, userProfile } = ctx;
const { settings: memberSettings, saveSettings } = getMemberSettings();

const isAutoMode = computed(() => memberSettings.value.task_execution_mode === "auto");
const isAutoReply = computed(() => memberSettings.value.ai_auto_reply);

const {
  searchQuery,
  filteredTools,
  filteredMembers,
  matchHints,
  filteredNavItems,
  isEmpty,
} = useSidebarSearch(members, ctx.role, t);

const searchInputRef = ref<InstanceType<typeof GlassInput> | null>(null);

// Hover card state
const hoveredMember = ref<MemberInfo | null>(null);
const hoverRect = ref<DOMRect | null>(null);
const hoverCardVisible = ref(false);
let showTimer: ReturnType<typeof setTimeout> | null = null;
let hideTimer: ReturnType<typeof setTimeout> | null = null;

function handleMemberEnter(m: MemberInfo, e: MouseEvent) {
  if (hideTimer) {
    clearTimeout(hideTimer);
    hideTimer = null;
  }
  const target = e.currentTarget as HTMLElement;
  showTimer = setTimeout(() => {
    hoveredMember.value = m;
    hoverRect.value = target.getBoundingClientRect();
    hoverCardVisible.value = true;
  }, 150);
}

function handleMemberLeave() {
  if (showTimer) {
    clearTimeout(showTimer);
    showTimer = null;
  }
  hideTimer = setTimeout(() => {
    hoverCardVisible.value = false;
  }, 100);
}

function handleCardEnter() {
  if (hideTimer) {
    clearTimeout(hideTimer);
    hideTimer = null;
  }
}

function handleCardLeave() {
  hideTimer = setTimeout(() => {
    hoverCardVisible.value = false;
  }, 100);
}

// Tool hover card state
const toolDescMap: Record<string, string> = {
  __cloud__: "sidebar.cloudResourcesDesc",
  __tasks__: "sidebar.taskCenterDesc",
  __dispatch__: "sidebar.taskDispatchDesc",
};
const toolIconMap: Record<string, "cloud" | "tasks" | "dispatch"> = {
  __cloud__: "cloud",
  __tasks__: "tasks",
  __dispatch__: "dispatch",
};

const hoveredToolId = ref<string | null>(null);
const toolHoverRect = ref<DOMRect | null>(null);
const toolCardVisible = ref(false);
let toolShowTimer: ReturnType<typeof setTimeout> | null = null;
let toolHideTimer: ReturnType<typeof setTimeout> | null = null;

function handleToolEnter(toolId: string, e: MouseEvent) {
  if (toolHideTimer) {
    clearTimeout(toolHideTimer);
    toolHideTimer = null;
  }
  const target = e.currentTarget as HTMLElement;
  toolShowTimer = setTimeout(() => {
    hoveredToolId.value = toolId;
    toolHoverRect.value = target.getBoundingClientRect();
    toolCardVisible.value = true;
  }, 150);
}

function handleToolLeave() {
  if (toolShowTimer) {
    clearTimeout(toolShowTimer);
    toolShowTimer = null;
  }
  toolHideTimer = setTimeout(() => {
    toolCardVisible.value = false;
  }, 100);
}

function handleToolCardEnter() {
  if (toolHideTimer) {
    clearTimeout(toolHideTimer);
    toolHideTimer = null;
  }
}

function handleToolCardLeave() {
  toolHideTimer = setTimeout(() => {
    toolCardVisible.value = false;
  }, 100);
}

/** Ordered list of all selectable peer IDs in the sidebar (unfiltered, for reference) */
const navItems = computed(() => {
  const items: string[] = ["__cloud__"];
  items.push("__tasks__");
  if (ctx.role === "leader") items.push("__dispatch__");
  items.push("__team__");
  for (const m of members.value) {
    items.push(m.id);
  }
  return items;
});

const channelUnread = computed(() => unreadCounts.value.get("__team__") ?? 0);

function handleKeyDown(e: KeyboardEvent) {
  if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
  const target = e.target as HTMLElement;
  if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) return;

  e.preventDefault();
  const items = searchQuery.value.trim() ? filteredNavItems.value : navItems.value;
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

function handleGlobalKeyDown(e: KeyboardEvent) {
  // Ctrl+K: focus search
  if (e.ctrlKey && e.code === "KeyK" && !e.shiftKey && !e.altKey && !e.metaKey) {
    const target = e.target as HTMLElement;
    if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) {
      // Don't intercept if user is already in an input (unless it's the search itself)
      if (!target.closest(".sidebar-search")) return;
    }
    e.preventDefault();
    searchInputRef.value?.focus();
  }

  // Escape: clear and blur search (only when search input is focused)
  if (e.key === "Escape") {
    const inputEl = searchInputRef.value?.inputRef;
    if (inputEl && document.activeElement === inputEl) {
      searchQuery.value = "";
      searchInputRef.value?.blur();
    }
  }
}

onMounted(() => {
  window.addEventListener("keydown", handleKeyDown);
  window.addEventListener("keydown", handleGlobalKeyDown);
});
onUnmounted(() => {
  window.removeEventListener("keydown", handleKeyDown);
  window.removeEventListener("keydown", handleGlobalKeyDown);
});

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
    <div class="sidebar-search">
      <GlassInput
        ref="searchInputRef"
        v-model="searchQuery"
        :placeholder="t('sidebar.searchPlaceholder')"
        clearable
        @clear="searchQuery = ''"
      >
        <template #prefix>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
        </template>
      </GlassInput>
    </div>

    <div v-if="isEmpty" class="empty-state">
      <span>{{ t('sidebar.noResults') }}</span>
    </div>

    <template v-else>
      <div v-if="filteredTools.length > 0" class="sidebar-header">
        <h3>{{ t('sidebar.tools') }}</h3>
      </div>
      <ul v-if="filteredTools.length > 0" class="nav-group">
        <li
          v-for="tool in filteredTools"
          :key="tool.id"
          class="task-center-entry"
          :class="{ active: tool.id === selectedPeer }"
          @click="markRead(tool.id); emit('select', tool.id)"
          @mouseenter="handleToolEnter(tool.id, $event)"
          @mouseleave="handleToolLeave"
        >
          <div class="avatar" :class="tool.id === '__cloud__' ? 'cloud-avatar' : tool.id === '__dispatch__' ? 'dispatch-avatar' : 'task-center-avatar'">
            <svg v-if="tool.id === '__cloud__'" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />
            </svg>
            <svg v-else-if="tool.id === '__tasks__'" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
              <rect x="9" y="3" width="6" height="4" rx="1" />
              <path d="M9 14l2 2 4-4" />
            </svg>
            <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
          </div>
          <div class="member-info">
            <span class="member-name">{{ tool.label }}</span>
          </div>
          <span v-if="tool.id === '__tasks__' && taskCount > 0" class="badge badge-task">
            {{ formatBadge(taskCount) }}
          </span>
        </li>
      </ul>

      <div class="sidebar-header">
        <h3>{{ t('sidebar.channel', '# General') }}</h3>
      </div>
      <ul class="nav-group">
        <li
          class="channel-entry"
          :class="{ active: '__team__' === selectedPeer }"
          @click="handleClick('__team__')"
        >
          <div class="avatar channel-avatar">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </div>
          <div class="member-info">
            <span class="member-name">General</span>
          </div>
          <span v-if="channelUnread > 0" class="badge">
            {{ formatBadge(channelUnread) }}
          </span>
        </li>
      </ul>

      <div v-if="filteredMembers.length > 0" class="sidebar-header">
        <h3>{{ t('sidebar.members') }}</h3>
      </div>
      <ul v-if="filteredMembers.length > 0" class="nav-group">
        <li
          v-for="m in filteredMembers"
          :key="m.id"
          :class="{ active: m.id === selectedPeer }"
          @click="handleClick(m.id)"
          @mouseenter="handleMemberEnter(m, $event)"
          @mouseleave="handleMemberLeave"
        >
          <div class="avatar">
            <img v-if="userProfile.getAvatarUrl(m.id)" :src="userProfile.getAvatarUrl(m.id)" class="avatar-img" />
            <template v-else>{{ getInitial(m.id) }}</template>
            <span class="status-dot" :class="m.status"></span>
          </div>
          <div class="member-info">
            <span class="member-name" :title="m.id">{{ userProfile.getDisplayName(m.id) }}</span>
            <span class="member-role" :class="m.role">{{ m.role }}</span>
            <span v-if="matchHints.get(m.id)" class="member-hint" :title="matchHints.get(m.id)">{{ matchHints.get(m.id) }}</span>
          </div>
          <span v-if="(unreadCounts.get(m.id) ?? 0) > 0" class="badge">
            {{ formatBadge(unreadCounts.get(m.id) ?? 0) }}
          </span>
        </li>
      </ul>
    </template>

    <div class="sidebar-footer">
      <div class="user-menu-wrapper">
        <div class="user-avatar-btn" :title="myId">
          <img v-if="userProfile.getAvatarUrl(myId)" :src="userProfile.getAvatarUrl(myId)!" class="avatar-img" />
          <template v-else>{{ getInitial(myId) }}</template>
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
    <MemberHoverCard
      v-if="hoveredMember"
      :member="hoveredMember"
      :rect="hoverRect"
      :visible="hoverCardVisible"
      @mouseenter="handleCardEnter"
      @mouseleave="handleCardLeave"
    />
    <ToolHoverCard
      v-if="hoveredToolId"
      :icon="toolIconMap[hoveredToolId]!"
      :name="t(`sidebar.${hoveredToolId === '__cloud__' ? 'cloudResources' : hoveredToolId === '__tasks__' ? 'taskCenter' : 'taskDispatch'}`)"
      :description="t(toolDescMap[hoveredToolId]!)"
      :rect="toolHoverRect"
      :visible="toolCardVisible"
      @mouseenter="handleToolCardEnter"
      @mouseleave="handleToolCardLeave"
    />
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

.sidebar-search {
  padding: var(--space-sm) var(--space-sm) 0;
}

.sidebar-header {
  padding: var(--space-md) var(--space-md);
  padding-bottom: var(--space-xs);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.sidebar-header:not(:first-child) {
  padding-top: var(--space-sm);
}

h3 {
  margin: 0;
  font-size: 0.8em;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.nav-group {
  list-style: none;
  margin: 0;
  padding: 0 var(--space-xs);
}

.nav-group:first-of-type {
  flex: 0;
}

.nav-group:last-of-type {
  flex: 1;
  overflow-y: auto;
  min-height: 0;
}

.nav-group:only-of-type {
  flex: 1;
  overflow-y: auto;
  min-height: 0;
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
  flex-wrap: wrap;
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
  color: var(--text-on-accent);
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

.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
  padding: var(--space-lg) var(--space-md);
  color: var(--text-muted);
  font-size: 0.8em;
}

.member-hint {
  font-size: 0.7em;
  color: var(--text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex-basis: 100%;
  margin-top: 1px;
}

/* Task center / dispatch entries */
.task-center-entry {
  padding: 6px var(--space-sm);
}

/* Channel entry */
.channel-entry {
  padding: 6px var(--space-sm);
}

.channel-avatar {
  background: var(--accent-light);
  color: var(--accent);
}

.channel-avatar svg {
  width: 14px;
  height: 14px;
}

.task-center-avatar {
  background: var(--accent-light);
  color: var(--accent);
}

.task-center-avatar svg,
.dispatch-avatar svg,
.cloud-avatar svg {
  width: 14px;
  height: 14px;
}

.badge-task {
  background: var(--accent);
}

.dispatch-avatar {
  background: var(--accent-light);
  color: var(--accent);
}

.cloud-avatar {
  background: var(--accent-light);
  color: var(--accent);
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

.avatar-img {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  object-fit: cover;
}
</style>
