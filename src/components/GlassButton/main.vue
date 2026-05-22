<template>
  <button
    ref="btnRef"
    class="glass-btn"
    :class="[variant, { disabled, loading }]"
    :disabled="disabled || loading"
    @click="$emit('click', $event)"
    @mousemove="onBtnMouseMove"
    @mouseleave="onBtnMouseLeave"
  >
    <span v-if="loading" class="glass-btn-spinner"></span>
    <slot />
  </button>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useMouseGradient } from '../../composables/useMouseGradient';

withDefaults(defineProps<{
  variant?: 'default' | 'primary' | 'danger'
  disabled?: boolean
  loading?: boolean
}>(), {
  variant: 'default',
})

defineEmits<{
  click: [e: MouseEvent]
}>()

const btnRef = ref<HTMLElement | null>(null);

const { onMouseMove: onBtnMouseMove, onMouseLeave: onBtnMouseLeave } = useMouseGradient(btnRef, {
  radius: 200,
  opacity: 0.12,
});
</script>

<style scoped>
@import './styles.css';
</style>
