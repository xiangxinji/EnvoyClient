<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import type { MemberInfo } from "../../types";
import { apiUrl } from "../../api";

const { t } = useI18n();

const props = defineProps<{
  member: MemberInfo;
  rect: DOMRect | null;
  visible: boolean;
}>();

const emit = defineEmits<{
  (e: "view-profile", memberId: string): void;
  (e: "mouseenter"): void;
  (e: "mouseleave"): void;
}>();

const position = computed(() => {
  if (!props.rect) return { left: "0px", top: "0px" };
  const gap = 4;
  const cardWidth = 220;
  const overflowRight = props.rect.right + gap + cardWidth > window.innerWidth;
  const left = overflowRight
    ? `${props.rect.left - cardWidth - gap}px`
    : `${props.rect.right + gap}px`;
  const top = `${props.rect.top}px`;
  return { left, top };
});

const displayName = computed(() => props.member.nickname || props.member.id);
const avatarSrc = computed(() => props.member.avatar_url ? apiUrl(props.member.avatar_url) : null);
const initial = computed(() => displayName.value.charAt(0).toUpperCase());

function handleAvatarClick() {
  emit("view-profile", props.member.id);
}
</script>

<template>
  <Teleport to="body">
    <Transition name="hover-card">
      <div
        v-if="visible && rect"
        class="hover-card"
        :style="position"
        @mouseenter="emit('mouseenter')"
        @mouseleave="emit('mouseleave')"
      >
        <div class="hover-card-header">
          <div class="hover-card-avatar" @click="handleAvatarClick">
            <img v-if="avatarSrc" :src="avatarSrc" class="hover-card-avatar-img" />
            <template v-else>{{ initial }}</template>
          </div>
          <div class="hover-card-identity">
            <span class="hover-card-name">{{ displayName }}</span>
            <div class="hover-card-meta">
              <span class="hover-card-role" :class="member.role">{{ member.role }}</span>
              <span class="hover-card-status">
                <span class="status-indicator" :class="member.status"></span>
                {{ member.status === 'online' ? t('sidebar.members') + ' Online' : 'Offline' }}
              </span>
            </div>
          </div>
        </div>
        <div v-if="member.responsibilities" class="hover-card-section">
          <span class="hover-card-label">{{ t('task.dispatch.responsibilities', 'Responsibilities') }}</span>
          <span class="hover-card-text">{{ member.responsibilities }}</span>
        </div>
        <div v-if="member.capabilities" class="hover-card-section">
          <span class="hover-card-label">{{ t('task.dispatch.capabilities', 'Capabilities') }}</span>
          <span class="hover-card-text">{{ member.capabilities }}</span>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
@import './styles.css';
</style>
