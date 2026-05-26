<script setup lang="ts">
import { computed, ref, watch, nextTick, onMounted } from "vue";
import { useI18n } from "vue-i18n";
import { getTeamClientInstance, getMemberSettings } from "../../composables/teamClientContext";
import ToolHoverCard from "../ToolHoverCard";
import { useHoverCard } from "../../composables/useHoverCard";
import SvgIcon from "../SvgIcon";

const { t } = useI18n();

const props = defineProps<{
  selectedPeer: string;
  sidebarCollapsed: boolean;
}>();

const emit = defineEmits<{
  select: [peerId: string];
  "update:sidebarCollapsed": [value: boolean];
}>();

const ctx = getTeamClientInstance()!;
const { messages, myId, userProfile } = ctx;
const { settings: memberSettings, toggleAutoReply, toggleExecutionMode } = getMemberSettings();

const myAvatarUrl = computed(() => userProfile.getAvatarUrl(myId));
const isAutoMode = computed(() => memberSettings.value.task_execution_mode === "auto");
const isAutoReply = computed(() => memberSettings.value.ai_auto_reply);

const toolItems = computed(() => {
  const items: { id: string; icon: string; labelKey: string; descKey: string }[] = [
    { id: "__cloud__", icon: "cloud" as const, labelKey: "sidebar.cloudResources", descKey: "sidebar.cloudResourcesDesc" },
    { id: "__tasks__", icon: "tasks" as const, labelKey: "sidebar.taskCenter", descKey: "sidebar.taskCenterDesc" },
    { id: "__execution__", icon: "terminal" as const, labelKey: "sidebar.executionPanel", descKey: "sidebar.executionPanelDesc" },
  ];
  if (ctx.role === "leader") {
    items.push({ id: "__dispatch__", icon: "lightning", labelKey: "sidebar.taskDispatch", descKey: "sidebar.taskDispatchDesc" });
  }
  return items;
});

const toolPeerIds = new Set(["__cloud__", "__tasks__", "__execution__", "__dispatch__"]);
const isChatActive = computed(() => !toolPeerIds.has(props.selectedPeer));

const toolHover = useHoverCard<string>();

function handleToolEnter(toolId: string, e: MouseEvent) { toolHover.show(toolId, e.currentTarget as HTMLElement); }
function handleToolLeave() { toolHover.scheduleHide(); }
function handleToolCardEnter() { toolHover.cancelHide(); }
function handleToolCardLeave() { toolHover.scheduleHide(); }

const toolDescMap: Record<string, string> = {
  __cloud__: "sidebar.cloudResourcesDesc",
  __tasks__: "sidebar.taskCenterDesc",
  __dispatch__: "sidebar.taskDispatchDesc",
  __execution__: "sidebar.executionPanelDesc",
};
const toolIconMap: Record<string, "cloud" | "tasks" | "dispatch" | "terminal"> = {
  __cloud__: "cloud",
  __tasks__: "tasks",
  __dispatch__: "dispatch",
  __execution__: "terminal",
};

const menuItems = [
  { id: "__quick__", icon: "keyboard" as const, labelKey: "sidebar.shortcuts" },
  { id: "__settings_task__", icon: "tasks" as const, labelKey: "sidebar.taskSettings" },
  { id: "__settings_knowledge__", icon: "book" as const, labelKey: "sidebar.knowledgeSettings" },
  { id: "__settings_ai__", icon: "lightning" as const, labelKey: "sidebar.aiSettings" },
  { id: "__settings_general__", icon: "settings" as const, labelKey: "sidebar.general" },
  { id: "__settings_profile__", icon: "user" as const, labelKey: "sidebar.profile" },
];

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

function formatBadge(count: number): string {
  if (count > 99) return "99+";
  return String(count);
}

async function handleToggleExecutionMode() {
  await toggleExecutionMode(myId);
}

async function handleToggleAutoReply() {
  await toggleAutoReply(myId, ctx.autoReplyDispose);
}

// Indicator
const navRef = ref<HTMLElement | null>(null);
const indicatorRef = ref<HTMLElement | null>(null);

function updateIndicator() {
  nextTick(() => {
    const nav = navRef.value;
    const indicator = indicatorRef.value;
    if (!nav || !indicator) return;
    const activeEl = nav.querySelector(".activity-item.active") as HTMLElement | null;
    if (!activeEl) {
      indicator.style.opacity = "0";
      return;
    }
    const navRect = nav.getBoundingClientRect();
    const activeRect = activeEl.getBoundingClientRect();
    const top = activeRect.top - navRect.top + nav.scrollTop;
    indicator.style.transform = `translateY(${top}px)`;
    indicator.style.height = `${activeRect.height}px`;
    indicator.style.opacity = "1";
  });
}

watch(() => props.selectedPeer, updateIndicator);
onMounted(updateIndicator);
</script>

<template>
  <aside class="activity-bar">
    <div class="activity-top" ref="navRef">
      <div class="activity-indicator" ref="indicatorRef"></div>

      <button
        class="activity-item"
        :class="{ active: isChatActive }"
        :title="t('sidebar.channel')"
        @click="emit('select', '__team__')"
      >
        <SvgIcon name="chat" :size="20" />
      </button>

      <div class="activity-separator"></div>

      <button
        v-for="tool in toolItems"
        :key="tool.id"
        class="activity-item"
        :class="{ active: selectedPeer === tool.id }"
        :title="t(tool.labelKey)"
        @click="emit('select', tool.id)"
        @mouseenter="handleToolEnter(tool.id, $event)"
        @mouseleave="handleToolLeave"
      >
        <SvgIcon :name="tool.icon" :size="20" />
        <span v-if="tool.id === '__tasks__' && taskCount > 0" class="activity-badge">
          {{ formatBadge(taskCount) }}
        </span>
      </button>
    </div>

    <div class="activity-bottom">
      <button
        class="sidebar-toggle-btn"
        :title="sidebarCollapsed ? t('common.expand') : t('common.collapse')"
        @click="emit('update:sidebarCollapsed', !sidebarCollapsed)"
      >
        <SvgIcon name="sidebar" :size="18" />
      </button>

      <div class="activity-spacer"></div>

      <button
        class="activity-toggle"
        :class="{ active: isAutoReply }"
        :title="t('sidebar.aiAutoReply')"
        @click="handleToggleAutoReply"
      >
        <SvgIcon name="chat" :size="14" />
      </button>
      <button
        class="activity-toggle"
        :class="{ active: isAutoMode }"
        :title="t('sidebar.aiTaskMode')"
        @click="handleToggleExecutionMode"
      >
        <SvgIcon name="lightning" :size="14" />
      </button>

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
    </div>

    <ToolHoverCard
      v-if="toolHover.hoveredItem.value"
      :icon="toolIconMap[toolHover.hoveredItem.value] ?? 'tasks'"
      :name="t(`sidebar.${toolHover.hoveredItem.value === '__cloud__' ? 'cloudResources' : toolHover.hoveredItem.value === '__tasks__' ? 'taskCenter' : toolHover.hoveredItem.value === '__execution__' ? 'executionPanel' : 'taskDispatch'}`)"
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
