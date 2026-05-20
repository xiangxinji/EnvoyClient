<script setup lang="ts">
import { ref, watch } from "vue";
import SvgIcon from "../SvgIcon";

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
      <SvgIcon v-if="type === 'success'" name="success-circle" :size="16" />
      <SvgIcon v-else-if="type === 'error'" name="error-circle" :size="16" />
      <SvgIcon v-else name="info" :size="16" />
      <span>{{ message }}</span>
    </div>
  </Teleport>
</template>

<style scoped>
@import './styles.css';
</style>
