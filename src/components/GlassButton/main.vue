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
@import './styles.css';
</style>
