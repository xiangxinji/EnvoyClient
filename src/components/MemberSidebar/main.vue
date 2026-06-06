<script setup lang="ts">
import { computed, ref, watch, nextTick, onMounted, onUnmounted } from "vue";
import { useI18n } from "vue-i18n";
import { getTeamClientInstance } from "../../composables/teamClientContext";
import { apiUrl } from "../../api";
import { formatBadge } from "../../utils/formatting";
import GlassInput from "../GlassInput";
import MemberHoverCard from "../MemberHoverCard";
import { useSidebarSearch } from "../../composables/useSidebarSearch";
import { useHoverCard } from "../../composables/useHoverCard";
import { useMouseGradient } from "../../composables/useMouseGradient";
import SvgIcon from "../SvgIcon";
import type { MemberInfo } from "../../types";

const { t } = useI18n();

const props = defineProps<{
  selectedPeer: string;
  collapsed?: boolean;
}>();

const emit = defineEmits<{
  select: [peerId: string];
  "update:collapsed": [value: boolean];
}>();

const ctx = getTeamClientInstance()!;
const { members, unreadCounts, markRead, userProfile } = ctx;

const {
  searchQuery,
  filteredMembers,
  matchHints,
  filteredNavItems,
  isEmpty,
} = useSidebarSearch(members, ctx.role, t);

const searchInputRef = ref<InstanceType<typeof GlassInput> | null>(null);

const memberHover = useHoverCard<MemberInfo>();

function handleMemberEnter(m: MemberInfo, e: MouseEvent) { memberHover.show(m, e.currentTarget as HTMLElement); }
function handleMemberLeave() { memberHover.scheduleHide(); }
function handleCardEnter() { memberHover.cancelHide(); }
function handleCardLeave() { memberHover.scheduleHide(); }

function handleViewProfile(memberId: string) {
  memberHover.visible.value = false;
  memberHover.hoveredItem.value = null;
  emit("select", `__profile__${memberId}__`);
}

const navItems = computed(() => {
  const items: string[] = ["__team__"];
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
  if (e.ctrlKey && e.code === "KeyK" && !e.shiftKey && !e.altKey && !e.metaKey) {
    const target = e.target as HTMLElement;
    if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) {
      if (!target.closest(".sidebar-search")) return;
    }
    e.preventDefault();
    searchInputRef.value?.focus();
  }

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

const sidebarRef = ref<HTMLElement | null>(null);
const { onMouseMove, onMouseLeave } = useMouseGradient(sidebarRef, {
  initialX: 50,
  initialY: 0,
});

function handleClick(peerId: string) {
  markRead(peerId);
  emit("select", peerId);
}



const sidebarNavRef = ref<HTMLElement | null>(null);
const indicatorRef = ref<HTMLElement | null>(null);

function updateIndicator() {
  nextTick(() => {
    const nav = sidebarNavRef.value;
    const indicator = indicatorRef.value;
    if (!nav || !indicator) return;
    const activeEl = nav.querySelector("li.active") as HTMLElement | null;
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
  <aside class="sidebar" :class="{ collapsed }" ref="sidebarRef" @mousemove="onMouseMove" @mouseleave="onMouseLeave">
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
      <div class="sidebar-nav" ref="sidebarNavRef">
        <div class="sidebar-indicator" ref="indicatorRef"></div>
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
      </div>
    </template>

    <MemberHoverCard
      v-if="memberHover.hoveredItem.value"
      :member="memberHover.hoveredItem.value"
      :rect="memberHover.hoverRect.value"
      :visible="memberHover.visible.value"
      @mouseenter="handleCardEnter"
      @mouseleave="handleCardLeave"
      @view-profile="handleViewProfile"
    />
  </aside>
</template>

<style scoped>
@import './styles.css';
</style>
