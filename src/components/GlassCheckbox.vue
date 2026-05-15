<template>
  <label class="glass-checkbox" :class="{ disabled }">
    <span class="box" :class="{ checked: modelValue }">
      <svg v-if="modelValue" class="check" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    </span>
    <input
      type="checkbox"
      :checked="modelValue"
      :disabled="disabled"
      v-bind="$attrs"
      @change="$emit('update:modelValue', ($event.target as HTMLInputElement).checked)"
    />
    <span class="label-text"><slot /></span>
  </label>
</template>

<script setup lang="ts">
defineProps<{
  modelValue?: boolean
  disabled?: boolean
}>()

defineEmits<{
  'update:modelValue': [value: boolean]
}>()
</script>

<style scoped>
.glass-checkbox {
  display: inline-flex;
  align-items: center;
  gap: var(--space-sm);
  cursor: pointer;
  user-select: none;
  position: relative;
}

.glass-checkbox input {
  position: absolute;
  opacity: 0;
  width: 0;
  height: 0;
}

.box {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
  border: 1.5px solid var(--input-border);
  border-radius: 5px;
  background: var(--glass-bg-light);
  backdrop-filter: blur(var(--glass-blur));
  -webkit-backdrop-filter: blur(var(--glass-blur));
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s ease;
}

.box.checked {
  background: var(--accent);
  border-color: var(--accent);
}

.box .check {
  color: #fff;
}

.glass-checkbox input:focus-visible + .box {
  box-shadow: 0 0 0 3px var(--accent-light);
}

.label-text {
  color: var(--text-secondary);
  font-size: 0.9em;
}

.glass-checkbox.disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
