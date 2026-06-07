<script setup lang="ts">
import type { MessageAttachment } from "../../types";
import { formatFileSize } from "../../utils/taskFormatters";
import { useFullscreenViewer } from "../../composables/useFullscreenViewer";
import SvgIcon from "../SvgIcon";

defineProps<{
  items: MessageAttachment[];
  noText?: boolean;
}>();

const viewer = useFullscreenViewer();

function openFullscreen(att: MessageAttachment) {
  if (att.type === "image") viewer.openFullscreen(att.url);
}
</script>

<template>
  <div v-if="items.length" class="attachments" :class="{ 'no-text': noText }">
    <template v-for="(att, i) in items" :key="i">
      <div v-if="att.type === 'image'" class="image-card" @click="openFullscreen(att)"><img :src="att.url" :alt="att.name" loading="lazy" /></div>
      <a v-else :href="att.url" class="file-card" target="_blank" rel="noopener">
        <div class="file-icon"><SvgIcon name="file" :size="16" /></div>
        <div class="file-info"><span class="file-name">{{ att.name }}</span><span class="file-size">{{ formatFileSize(att.size) }}</span></div>
        <SvgIcon class="file-download" name="download" :size="14" />
      </a>
    </template>
  </div>
</template>

<style scoped>@import './styles.css';</style>
