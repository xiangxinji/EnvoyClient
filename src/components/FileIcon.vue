<script setup lang="ts">
import { ref, computed } from "vue";

const props = defineProps<{ category: string }>();

const path = computed(() => {
  const m: Record<string, string> = {
    directory: "M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z",
    document: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2 14 8 20 8 M16 13L8 13 M16 17L8 17 M10 9L9 9 8 9",
    spreadsheet: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2 14 8 20 8 M8 13L16 13 M8 17L16 17 M12 11L12 19",
    image: "M3 3h18v18H3z M8.5 8.5a1.5 1.5 0 1 0 3 0 1.5 1.5 0 0 0-3 0 M21 15L16 10 5 21",
    audio: "M9 18V5l12-2v13 M6 18a3 3 0 1 0 6 0 3 3 0 0 0-6 0 M18 16a3 3 0 1 0 6 0 3 3 0 0 0-6 0",
    video: "M23 7L16 12 23 17 23 7z M1 5h15v14H1z",
    archive: "M21 8v13H3V8 M1 3h22v5H1z M10 12h4",
    code: "M16 18l6-6-6-6 M8 6l-6 6 6 18",
    file: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2 14 8 20 8",
  };
  return m[props.category] ?? m.file;
});
</script>

<template>
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path v-for="(d, i) in path.split(' M')" :key="i" :d="i === 0 ? d : 'M' + d" />
  </svg>
</template>
