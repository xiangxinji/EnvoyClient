<template>
  <button class="back-btn" @click="$emit('click')">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <polyline points="15 18 9 12 15 6" />
    </svg>
    {{ $t('common.back') }}
  </button>
</template>

<script setup lang="ts">
defineEmits<{
  click: []
}>()
</script>

<style scoped>
@import './styles.css';
</style>
