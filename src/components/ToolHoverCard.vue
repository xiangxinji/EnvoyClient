<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{
  icon: "cloud" | "tasks" | "dispatch";
  name: string;
  description: string;
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
      >
        <div class="hover-card-header">
          <div class="hover-card-icon">
            <svg v-if="icon === 'cloud'" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />
            </svg>
            <svg v-else-if="icon === 'tasks'" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
              <rect x="9" y="3" width="6" height="4" rx="1" />
              <path d="M9 14l2 2 4-4" />
            </svg>
            <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
          </div>
          <span class="hover-card-name">{{ name }}</span>
        </div>
        <div class="hover-card-desc">{{ description }}</div>
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

.hover-card-icon {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--accent-light);
  color: var(--accent);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.hover-card-name {
  font-weight: 600;
  font-size: 0.9em;
  color: var(--text-primary);
}

.hover-card-desc {
  font-size: 0.8em;
  color: var(--text-secondary);
  line-height: 1.5;
  word-break: break-word;
}
</style>
