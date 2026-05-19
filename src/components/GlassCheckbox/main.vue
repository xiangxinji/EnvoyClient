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
@import './styles.css';
</style>
