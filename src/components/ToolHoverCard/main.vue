<script setup lang="ts">
import { computed } from "vue";
import SvgIcon from "../SvgIcon";

const props = defineProps<{
  icon: "cloud" | "tasks" | "dispatch" | "org";
  name: string;
  description: string;
  rect: DOMRect | null;
  visible: boolean;
}>();

const iconName = computed(() => {
  const m: Record<string, string> = { cloud: "cloud", tasks: "tasks", dispatch: "lightning", org: "users" };
  return m[props.icon] ?? "lightning";
});

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
            <SvgIcon :name="iconName" :size="16" />
          </div>
          <span class="hover-card-name">{{ name }}</span>
        </div>
        <div class="hover-card-desc">{{ description }}</div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
@import './styles.css';
</style>
