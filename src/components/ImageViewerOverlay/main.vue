<script setup lang="ts">
import { useFullscreenViewer } from "../../composables/useFullscreenViewer";
import SvgIcon from "../SvgIcon";

const viewer = useFullscreenViewer();
</script>

<template>
  <Teleport to="body">
    <Transition name="viewer">
      <div
        v-if="viewer.fullscreenUrl.value"
        class="fullscreen-overlay"
        @click="viewer.closeFullscreen()"
        @mousemove="viewer.onDragMove"
        @mouseup="viewer.onDragEnd"
        @mouseleave="viewer.onDragEnd"
      >
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
        <img
          :src="viewer.fullscreenUrl.value"
          class="fullscreen-image"
          :class="{ dragging: viewer.isDragging.value }"
          :style="{ transform: viewer.imageTransform.value }"
          @click.stop
          @wheel.prevent="viewer.onImageWheel"
          @mousedown.prevent="viewer.onDragStart"
        />
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
@import './styles.css';
</style>
