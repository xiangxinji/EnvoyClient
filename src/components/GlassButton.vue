<template>
  <button
    class="glass-btn"
    :class="[variant, { disabled }]"
    :disabled="disabled"
    @click="$emit('click', $event)"
  >
    <slot />
  </button>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  variant?: 'default' | 'primary' | 'danger'
  disabled?: boolean
}>(), {
  variant: 'default',
})

defineEmits<{
  click: [e: MouseEvent]
}>()
</script>

<style scoped>
.glass-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-xs);
  height: 36px;
  box-sizing: border-box;
  padding: 0 16px;
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-sm);
  background: var(--glass-bg-light);
  backdrop-filter: blur(var(--glass-blur));
  -webkit-backdrop-filter: blur(var(--glass-blur));
  color: var(--text-primary);
  font-size: 0.88em;
  font-weight: 500;
  font-family: inherit;
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
}

.glass-btn:hover:not(:disabled) {
  border-color: var(--accent);
  color: var(--accent);
}

.glass-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.glass-btn.primary {
  background: var(--accent);
  border-color: var(--accent);
  color: white;
}

.glass-btn.primary:hover:not(:disabled) {
  background: var(--accent-hover);
  border-color: var(--accent-hover);
  color: white;
}

.glass-btn.danger {
  border-color: var(--error);
  color: var(--error);
  background: transparent;
}

.glass-btn.danger:hover:not(:disabled) {
  background: var(--error);
  color: white;
}
</style>
