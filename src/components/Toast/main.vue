<script setup lang="ts">
import { ref, watch } from "vue";

const props = defineProps<{
  visible: boolean;
  message: string;
  type?: "success" | "error" | "info";
  duration?: number;
}>();

const emit = defineEmits<{
  done: [];
}>();

const show = ref(false);
let timer: ReturnType<typeof setTimeout> | null = null;

watch(() => props.visible, (val) => {
  if (val) {
    requestAnimationFrame(() => { show.value = true; });
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      show.value = false;
      setTimeout(() => emit("done"), 280);
    }, props.duration ?? 2000);
  } else {
    show.value = false;
    if (timer) { clearTimeout(timer); timer = null; }
  }
});
</script>

<template>
  <Teleport to="body">
    <div v-if="visible" class="toast" :class="[type ?? 'info', { active: show }]">
      <svg v-if="type === 'success'" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
      <svg v-else-if="type === 'error'" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
      <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
      <span>{{ message }}</span>
    </div>
  </Teleport>
</template>

<style scoped>
@import './styles.css';
</style>
