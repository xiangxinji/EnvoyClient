<script setup lang="ts">
import { computed } from "vue";
import SvgIcon from "../SvgIcon";

const props = defineProps<{ category: string }>();

const iconName = computed(() => {
  const m: Record<string, string> = {
    directory: "folder",
    document: "file-document",
    spreadsheet: "file-spreadsheet",
    image: "file-image",
    audio: "file-audio",
    video: "file-video",
    archive: "file-archive",
    code: "file-code",
    file: "file",
  };
  return m[props.category] ?? m.file;
});
</script>

<template>
  <span class="file-icon" :data-color="category"><SvgIcon :name="iconName" :size="16" /></span>
</template>

<style scoped>
@import './styles.css';
</style>
