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

  <Teleport to="body">
    <Transition name="viewer">
      <div v-if="viewer.fullscreenUrl.value" class="fullscreen-overlay" @click="viewer.closeFullscreen()" @mousemove="viewer.onDragMove" @mouseup="viewer.onDragEnd" @mouseleave="viewer.onDragEnd">
        <div class="fullscreen-toolbar" @click.stop>
          <button class="toolbar-btn" @click="viewer.zoomOut()"><SvgIcon name="zoom-out" :size="18" /></button>
          <span class="toolbar-scale">{{ Math.round(viewer.imageScale.value * 100) }}%</span>
          <button class="toolbar-btn" @click="viewer.zoomIn()"><SvgIcon name="zoom-in" :size="18" /></button>
          <div class="toolbar-divider"></div>
          <button class="toolbar-btn" @click="viewer.rotateLeft()"><SvgIcon name="rotate-ccw" :size="18" /></button>
          <button class="toolbar-btn" @click="viewer.rotateRight()"><SvgIcon name="rotate-cw" :size="18" /></button>
          <div class="toolbar-divider"></div>
          <button class="toolbar-btn" @click="viewer.resetZoom()"><SvgIcon name="refresh" :size="18" /></button>
          <div class="toolbar-divider"></div>
          <button class="toolbar-btn" @click="viewer.downloadImage()"><SvgIcon name="download" :size="18" /></button>
          <div class="toolbar-divider"></div>
          <button class="toolbar-btn" @click="viewer.closeFullscreen()"><SvgIcon name="close" :size="18" /></button>
        </div>
        <img :src="viewer.fullscreenUrl.value" class="fullscreen-image" :class="{ dragging: viewer.isDragging.value }" :style="{ transform: viewer.imageTransform.value }" @click.stop @wheel.prevent="viewer.onImageWheel" @mousedown.prevent="viewer.onDragStart" />
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>@import './styles.css';</style>
