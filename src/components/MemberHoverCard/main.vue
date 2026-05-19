<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import type { MemberInfo } from "../../types";
import { useUserProfile } from "../../composables/useUserProfile";

const { t } = useI18n();
const { getDisplayName, getAvatarUrl } = useUserProfile();

const props = defineProps<{
  member: MemberInfo;
  rect: DOMRect | null;
  visible: boolean;
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
</script>

<template>
  <Teleport to="body">
    <Transition name="hover-card">
      <div
        v-if="visible && rect"
        class="hover-card"
        :style="position"
        @mouseenter="$emit('mouseenter')"
        @mouseleave="$emit('mouseleave')"
      >
        <div class="hover-card-header">
          <div class="hover-card-avatar">
            <img v-if="getAvatarUrl(member.id)" :src="getAvatarUrl(member.id)!" class="hover-card-avatar-img" />
            <template v-else>{{ getDisplayName(member.id).charAt(0).toUpperCase() }}</template>
          </div>
          <div class="hover-card-identity">
            <span class="hover-card-name">{{ getDisplayName(member.id) }}</span>
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
