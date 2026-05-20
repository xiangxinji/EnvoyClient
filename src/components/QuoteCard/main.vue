<script setup lang="ts">
defineProps<{
  from: string;
  text: string;
  revoked?: boolean;
}>();

const emit = defineEmits<{ click: [] }>();
</script>

<template>
  <div class="quote-card" :class="{ revoked }" @click="emit('click')">
    <span class="quote-sender">{{ from }}</span>
    <span class="quote-text">{{ text }}</span>
  </div>
</template>

<style scoped>
.quote-card { display: flex; flex-direction: column; gap: 2px; padding: 3px 8px; border-left: 3px solid var(--accent); border-radius: var(--radius-sm); background: var(--glass-bg-light); cursor: pointer; transition: background 0.15s; }
.quote-card:hover { background: var(--glass-bg); }
.quote-card.revoked .quote-text { opacity: 0.5; font-style: italic; }
.quote-sender { font-size: 0.72em; font-weight: 600; color: var(--accent); }
.quote-text { font-size: 0.75em; color: var(--text-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 220px; line-height: 1.4; }
</style>
