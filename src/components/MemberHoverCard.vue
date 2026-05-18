<script setup lang="ts">
import { computed } from "vue";
import type { MemberInfo } from "../types";

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

function getInitial(name: string): string {
  return name.charAt(0).toUpperCase();
}
</script>

<template>
  <Teleport to="body">
    <Transition name="hover-card">
      <div
        v-if="visible && rect"
        class="hover-card"
        :style="position"
      >
        <div class="hover-card-header">
          <div class="hover-card-avatar">{{ getInitial(member.id) }}</div>
          <div class="hover-card-identity">
            <span class="hover-card-name">{{ member.id }}</span>
            <div class="hover-card-meta">
              <span class="hover-card-role" :class="member.role">{{ member.role }}</span>
              <span class="hover-card-status">
                <span class="status-indicator" :class="member.status"></span>
                {{ member.status === 'online' ? 'Online' : 'Offline' }}
              </span>
            </div>
          </div>
        </div>
        <div v-if="member.responsibilities" class="hover-card-section">
          <span class="hover-card-label">Responsibilities</span>
          <span class="hover-card-text">{{ member.responsibilities }}</span>
        </div>
        <div v-if="member.capabilities" class="hover-card-section">
          <span class="hover-card-label">Capabilities</span>
          <span class="hover-card-text">{{ member.capabilities }}</span>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.hover-card {
  position: fixed;
  z-index: 1000;
  min-width: 180px;
  max-width: 240px;
  background: var(--glass-bg);
  backdrop-filter: blur(var(--glass-blur));
  -webkit-backdrop-filter: blur(var(--glass-blur));
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  box-shadow: var(--glass-shadow-heavy);
  padding: var(--space-md);
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  pointer-events: auto;
}

.hover-card-enter-active,
.hover-card-leave-active {
  transition: opacity 0.12s, transform 0.12s;
}

.hover-card-enter-from,
.hover-card-leave-to {
  opacity: 0;
  transform: translateY(4px);
}

.hover-card-header {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.hover-card-avatar {
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

.hover-card-identity {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.hover-card-name {
  font-weight: 600;
  font-size: 0.9em;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.hover-card-meta {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
}

.hover-card-role {
  font-size: 0.65em;
  padding: 1px 5px;
  border-radius: var(--radius-sm);
  font-weight: 500;
}

.hover-card-role.leader {
  background: var(--role-leader-bg);
  color: var(--role-leader-text);
}

.hover-card-role.member {
  background: var(--role-member-bg);
  color: var(--role-member-text);
}

.hover-card-status {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 0.7em;
  color: var(--text-muted);
}

.status-indicator {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

.status-indicator.online {
  background: var(--online-dot);
}

.status-indicator.offline {
  background: var(--text-muted);
}

.hover-card-section {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding-top: var(--space-xs);
  border-top: 1px solid var(--glass-border);
}

.hover-card-label {
  font-size: 0.65em;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.hover-card-text {
  font-size: 0.8em;
  color: var(--text-secondary);
  word-break: break-word;
}
</style>
