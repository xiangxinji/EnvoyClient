<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from "vue";
import { useI18n } from "vue-i18n";
import { getTeamClientInstance, getMemberSettings } from "../../composables/teamClientContext";
import { apiUrl } from "../../api";
import GlassInput from "../GlassInput";
import MemberHoverCard from "../MemberHoverCard";
import ToolHoverCard from "../ToolHoverCard";
import { useSidebarSearch } from "../../composables/useSidebarSearch";
import { useHoverCard } from "../../composables/useHoverCard";
import { useMouseGradient } from "../../composables/useMouseGradient";
import SvgIcon from "../SvgIcon";
import type { MemberInfo } from "../../types";

const { t } = useI18n();

const props = defineProps<{
  selectedPeer: string;
}>();

const emit = defineEmits<{
  select: [peerId: string];
}>();

const ctx = getTeamClientInstance()!;
const { members, unreadCounts, markRead, messages, myId, userProfile } = ctx;
const { settings: memberSettings, toggleAutoReply, toggleExecutionMode } = getMemberSettings();

const myAvatarUrl = computed(() => userProfile.getAvatarUrl(myId));
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

const menuItems = [
  { id: "__quick__", icon: "keyboard" as const, labelKey: "sidebar.shortcuts" },
  { id: "__settings_profile__", icon: "user" as const, labelKey: "sidebar.profile" },
  { id: "__settings_task__", icon: "tasks" as const, labelKey: "sidebar.taskSettings" },
  { id: "__settings_ai__", icon: "lightning" as const, labelKey: "sidebar.aiSettings" },
  { id: "__settings_general__", icon: "settings" as const, labelKey: "sidebar.general" },
];

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

async function handleToggleExecutionMode() {
  await toggleExecutionMode(myId);
}

async function handleToggleAutoReply() {
  await toggleAutoReply(myId, ctx.autoReplyDispose);
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

const sidebarRef = ref<HTMLElement | null>(null);
const { onMouseMove, onMouseLeave } = useMouseGradient(sidebarRef, {
  initialX: 50,
  initialY: 0,
});

function handleClick(peerId: string) {
  markRead(peerId);
  emit("select", peerId);
}

function formatBadge(count: number): string {
  if (count > 99) return "99+";
  return String(count);
}
</script>

<template>
  <aside class="sidebar" ref="sidebarRef" @mousemove="onMouseMove" @mouseleave="onMouseLeave">
    <div class="sidebar-search">
      <GlassInput
        ref="searchInputRef"
        v-model="searchQuery"
        :placeholder="t('sidebar.searchPlaceholder')"
        clearable
        @clear="searchQuery = ''"
      >
        <template #prefix>
          <SvgIcon name="search" :size="14" />
        </template>
      </GlassInput>
    </div>

    <div v-if="isEmpty" class="empty-state">
      <span>{{ t('sidebar.noResults') }}</span>
    </div>

    <template v-else>
      <div v-if="!searchQuery.trim()" class="sidebar-header">
        <h3>{{ t('sidebar.channel') }}</h3>
      </div>
      <ul v-if="!searchQuery.trim()" class="nav-group">
        <li
          class="channel-entry"
          :class="{ active: '__team__' === selectedPeer }"
          @click="handleClick('__team__')"
        >
          <div class="avatar channel-avatar">
            <SvgIcon name="chat" :size="14" />
          </div>
          <div class="member-info">
            <span class="member-name">{{ t('sidebar.channelGeneral') }}</span>
          </div>
          <span v-if="channelUnread > 0" class="badge">
            {{ formatBadge(channelUnread) }}
          </span>
        </li>
      </ul>

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
            <SvgIcon v-if="tool.id === '__cloud__'" name="cloud" :size="14" />
            <SvgIcon v-else-if="tool.id === '__tasks__'" name="tasks" :size="14" />
            <SvgIcon v-else name="lightning" :size="14" />
          </div>
          <div class="member-info">
            <span class="member-name">{{ tool.label }}</span>
          </div>
          <span v-if="tool.id === '__tasks__' && taskCount > 0" class="badge badge-task">
            {{ formatBadge(taskCount) }}
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
            <img v-if="m.avatar_url" :src="apiUrl(m.avatar_url)" class="avatar-img" />
            <template v-else>{{ userProfile.getInitial(m.id) }}</template>
            <span class="status-dot" :class="m.status"></span>
          </div>
          <div class="member-info">
            <span class="member-name" :title="m.id">{{ m.nickname || m.id }}</span>
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
          <img v-if="myAvatarUrl" :src="myAvatarUrl" class="avatar-img" />
          <template v-else>{{ userProfile.getInitial(myId) }}</template>
        </div>
        <div class="user-menu" @click.stop>
          <button
            v-for="item in menuItems"
            :key="item.id"
            class="user-menu-item"
            :class="{ active: selectedPeer === item.id }"
            @click="emit('select', item.id)"
          >
            <SvgIcon :name="item.icon" :size="14" />
            {{ t(item.labelKey) }}
          </button>
        </div>
      </div>
      <div class="quick-toggles">
        <button
          class="quick-toggle"
          :class="{ active: isAutoReply }"
          :title="t('sidebar.aiAutoReply')"
          @click="handleToggleAutoReply"
        >
          <SvgIcon name="chat" :size="14" />
        </button>
        <button
          class="quick-toggle"
          :class="{ active: isAutoMode }"
          :title="t('sidebar.aiTaskMode')"
          @click="handleToggleExecutionMode"
        >
          <SvgIcon name="lightning" :size="14" />
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
