<template>
  <label class="glass-checkbox" :class="{ disabled }">
    <span class="box" :class="{ checked: modelValue }">
      <SvgIcon v-if="modelValue" name="check" :size="12" class="check" />
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
import SvgIcon from "../SvgIcon";

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
