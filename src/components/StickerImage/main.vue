<script setup lang="ts">
defineProps<{
  url: string;
  name?: string;
}>();
</script>

<template>
  <div class="sticker-image"><img :src="url" :alt="name" loading="lazy" /></div>
</template>

<style scoped>
.sticker-image { display: flex; justify-content: center; }
.sticker-image img { max-width: 150px; max-height: 150px; object-fit: contain; border-radius: var(--radius-sm); cursor: pointer; }
</style>
