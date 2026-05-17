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
.back-btn {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  margin-left: auto;
  background: none;
  border: none;
  color: var(--accent);
  cursor: pointer;
  font-size: 0.85em;
  padding: var(--space-xs) var(--space-sm);
  border-radius: var(--radius-sm);
  transition: background 0.15s;
}

.back-btn:hover {
  background: var(--bg-secondary);
}
</style>
