<script setup lang="ts">
import { inject, computed, ref, onMounted, onUnmounted } from "vue";
import { useI18n } from "vue-i18n";
import { TeamClientKey, getMemberSettings } from "../../composables/teamClientContext";
import GlassInput from "../GlassInput";
import MemberHoverCard from "../MemberHoverCard";
import ToolHoverCard from "../ToolHoverCard";
import { useSidebarSearch } from "../../composables/useSidebarSearch";
import { useHoverCard } from "../../composables/useHoverCard";
import type { TaskExecutionMode } from "../../composables/useMemberSettings";
import type { MemberInfo } from "../../types";

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

const memberHover = useHoverCard<MemberInfo>();
const toolHover = useHoverCard<string>();

function handleMemberEnter(m: MemberInfo, e: MouseEvent) { memberHover.show(m, e.currentTarget as HTMLElement); }
function handleMemberLeave() { memberHover.scheduleHide(); }
function handleCardEnter() { memberHover.cancelHide(); }
function handleCardLeave() { memberHover.scheduleHide(); }

const toolDescMap: Record<string, string> = { __cloud__: "sidebar.cloudResourcesDesc", __tasks__: "sidebar.taskCenterDesc", __dispatch__: "sidebar.taskDispatchDesc" };
const toolIconMap: Record<string, "cloud" | "tasks" | "dispatch"> = { __cloud__: "cloud", __tasks__: "tasks", __dispatch__: "dispatch" };

function handleToolEnter(toolId: string, e: MouseEvent) { toolHover.show(toolId, e.currentTarget as HTMLElement); }
function handleToolLeave() { toolHover.scheduleHide(); }
function handleToolCardEnter() { toolHover.cancelHide(); }
function handleToolCardLeave() { toolHover.scheduleHide(); }

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
        <h3>{{ t('sidebar.channel') }}</h3>
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
            <span class="member-name">{{ t('sidebar.channelGeneral') }}</span>
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
            <img v-if="userProfile.getAvatarUrl(m.id)" :src="userProfile.getAvatarUrl(m.id) ?? undefined" class="avatar-img" />
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
      v-if="memberHover.hoveredItem.value"
      :member="memberHover.hoveredItem.value"
      :rect="memberHover.hoverRect.value"
      :visible="memberHover.visible.value"
      @mouseenter="handleCardEnter"
      @mouseleave="handleCardLeave"
    />
    <ToolHoverCard
      v-if="toolHover.hoveredItem.value"
      :icon="toolIconMap[toolHover.hoveredItem.value]!"
      :name="t(`sidebar.${toolHover.hoveredItem.value === '__cloud__' ? 'cloudResources' : toolHover.hoveredItem.value === '__tasks__' ? 'taskCenter' : 'taskDispatch'}`)"
      :description="t(toolDescMap[toolHover.hoveredItem.value]!)"
      :rect="toolHover.hoverRect.value"
      :visible="toolHover.visible.value"
      @mouseenter="handleToolCardEnter"
      @mouseleave="handleToolCardLeave"
    />
  </aside>
</template>

<style scoped>
@import './styles.css';
</style>
