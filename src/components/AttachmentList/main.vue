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

<style scoped>
.attachments { display: flex; flex-direction: column; gap: var(--space-xs); margin-top: var(--space-sm); }
.attachments.no-text { margin-top: 0; }
.image-card { cursor: pointer; max-width: 280px; transition: opacity 0.15s; }
.image-card:hover { opacity: 0.92; }
.image-card img { display: block; max-width: 100%; max-height: 200px; object-fit: cover; border-radius: var(--radius-md); }
.file-card { display: flex; align-items: center; gap: var(--space-sm); padding: var(--space-sm) var(--space-md); background: var(--glass-bg-light); border: 1px solid var(--glass-border); border-radius: var(--radius-md); color: var(--text-primary); text-decoration: none; font-size: 0.85em; transition: border-color 0.15s, background 0.15s; max-width: 280px; }
.file-card:hover { border-color: var(--accent); background: var(--glass-bg); }
.file-icon { width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; background: var(--accent-light); border-radius: var(--radius-sm); color: var(--accent); flex-shrink: 0; }
.file-info { flex: 1; display: flex; flex-direction: column; min-width: 0; }
.file-name { font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.file-size { font-size: 0.8em; color: var(--text-muted); }
.file-download { color: var(--text-muted); flex-shrink: 0; transition: color 0.15s; }
.file-card:hover .file-download { color: var(--accent); }

.fullscreen-overlay { position: fixed; inset: 0; z-index: 9999; background: var(--image-overlay-bg); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); display: flex; align-items: center; justify-content: center; cursor: pointer; }
.fullscreen-image { max-width: 90vw; max-height: 85vh; object-fit: contain; border-radius: var(--radius-md); box-shadow: var(--glass-shadow-heavy); transition: transform 0.2s ease; cursor: grab; user-select: none; -webkit-user-drag: none; }
.fullscreen-image.dragging { cursor: grabbing; transition: none; }
.fullscreen-toolbar { position: fixed; bottom: 32px; left: 50%; transform: translateX(-50%); z-index: 10000; display: flex; align-items: center; gap: 6px; padding: 8px 12px; background: var(--image-toolbar-bg); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); border: 1px solid var(--image-toolbar-border); border-radius: 12px; box-shadow: var(--image-toolbar-shadow); }
.toolbar-btn { display: flex; align-items: center; justify-content: center; width: 34px; height: 34px; border: none; border-radius: 8px; background: transparent; color: var(--image-toolbar-btn); cursor: pointer; transition: background 0.15s, color 0.15s; }
.toolbar-btn:hover { background: var(--image-toolbar-btn-hover); color: var(--image-toolbar-btn-active); }
.toolbar-scale { min-width: 42px; text-align: center; font-size: 0.8em; font-weight: 500; color: var(--image-toolbar-text); user-select: none; }
.toolbar-divider { width: 1px; height: 20px; background: var(--image-toolbar-divider); margin: 0 4px; }

.viewer-enter-active { transition: opacity 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
.viewer-enter-active .fullscreen-image { transition: transform 0.35s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
.viewer-enter-active .fullscreen-toolbar { transition: transform 0.35s cubic-bezier(0.16, 1, 0.3, 1) 0.05s, opacity 0.3s cubic-bezier(0.16, 1, 0.3, 1) 0.05s; }
.viewer-leave-active { transition: opacity 0.2s cubic-bezier(0.4, 0, 1, 1); }
.viewer-leave-active .fullscreen-image { transition: transform 0.2s cubic-bezier(0.4, 0, 1, 1), opacity 0.2s cubic-bezier(0.4, 0, 1, 1); }
.viewer-leave-active .fullscreen-toolbar { transition: transform 0.2s cubic-bezier(0.4, 0, 1, 1), opacity 0.2s cubic-bezier(0.4, 0, 1, 1); }
.viewer-enter-from { opacity: 0; }
.viewer-enter-from .fullscreen-image { transform: scale(0.92); opacity: 0; }
.viewer-enter-from .fullscreen-toolbar { transform: translateX(-50%) translateY(10px); opacity: 0; }
.viewer-leave-to { opacity: 0; }
.viewer-leave-to .fullscreen-image { transform: scale(0.96); opacity: 0; }
.viewer-leave-to .fullscreen-toolbar { transform: translateX(-50%) translateY(6px); opacity: 0; }
</style>
