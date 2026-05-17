<script setup lang="ts">
import { computed, ref, onUnmounted, watch } from "vue";
import { useI18n } from "vue-i18n";
import { marked, type Tokens } from "marked";
import DOMPurify from "dompurify";
import type { ChatMessage, MessageAttachment } from "../types";

const props = defineProps<{
  message: ChatMessage;
  myId: string;
}>();

const emit = defineEmits<{
  contextmenu: [rect: DOMRect, message: ChatMessage];
}>();

const { t } = useI18n();

const bubbleRef = ref<HTMLElement | null>(null);marked.setOptions({
  gfm: true,
  breaks: true,
});

const renderer = {
  link({ href, title, text }: Tokens.Link) {
    const titleAttr = title ? ` title="${title}"` : "";
    return `<a target="_blank" rel="noopener noreferrer" href="${href}"${titleAttr}>${text}</a>`;
  },
};
marked.use({ renderer });

const renderedHtml = computed(() => {
  const raw = marked.parse(props.message.text) as string;
  return DOMPurify.sanitize(raw);
});

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Fullscreen image viewer
const fullscreenUrl = ref<string | null>(null);
const imageScale = ref(1);
const imageRotation = ref(0);
const panX = ref(0);
const panY = ref(0);
const isDragging = ref(false);
let dragStartX = 0;
let dragStartY = 0;
let panStartX = 0;
let panStartY = 0;

function openFullscreen(att: MessageAttachment) {
  if (att.type === "image") {
    fullscreenUrl.value = att.url;
    imageScale.value = 1;
    imageRotation.value = 0;
    panX.value = 0;
    panY.value = 0;
  }
}

function closeFullscreen() {
  fullscreenUrl.value = null;
  isDragging.value = false;
}

function zoomIn() {
  imageScale.value = Math.min(imageScale.value + 0.25, 5);
}

function zoomOut() {
  imageScale.value = Math.max(imageScale.value - 0.25, 0.25);
}

function resetZoom() {
  imageScale.value = 1;
  imageRotation.value = 0;
  panX.value = 0;
  panY.value = 0;
}

function rotateLeft() {
  imageRotation.value = (imageRotation.value - 90 + 360) % 360;
}

function rotateRight() {
  imageRotation.value = (imageRotation.value + 90) % 360;
}

function handleFullscreenKey(e: KeyboardEvent) {
  if (e.key === "Escape") closeFullscreen();
}

function downloadImage() {
  if (!fullscreenUrl.value) return;
  const a = document.createElement("a");
  a.href = fullscreenUrl.value;
  a.download = "";
  a.target = "_blank";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

const imageTransform = computed(() =>
  `translate(${panX.value}px, ${panY.value}px) scale(${imageScale.value}) rotate(${imageRotation.value}deg)`
);

function onImageWheel(e: WheelEvent) {
  const delta = e.deltaY > 0 ? -0.1 : 0.1;
  imageScale.value = Math.min(Math.max(imageScale.value + delta, 0.25), 5);
}

function onDragStart(e: MouseEvent) {
  isDragging.value = true;
  dragStartX = e.clientX;
  dragStartY = e.clientY;
  panStartX = panX.value;
  panStartY = panY.value;
}

function onDragMove(e: MouseEvent) {
  if (!isDragging.value) return;
  panX.value = panStartX + (e.clientX - dragStartX);
  panY.value = panStartY + (e.clientY - dragStartY);
}

function onDragEnd() {
  isDragging.value = false;
}

watch(fullscreenUrl, (url) => {
  if (url) {
    document.addEventListener("keydown", handleFullscreenKey);
  } else {
    document.removeEventListener("keydown", handleFullscreenKey);
  }
});

onUnmounted(() => {
  document.removeEventListener("keydown", handleFullscreenKey);
});
</script>

<template>
  <div ref="bubbleRef" class="bubble" :class="{ mine: message.mine }" @contextmenu.prevent="bubbleRef && emit('contextmenu', bubbleRef.getBoundingClientRect(), message)">
    <div class="content" v-html="renderedHtml"></div>

    <!-- Attachments -->
    <div v-if="message.attachments?.length" class="attachments">
      <template v-for="(att, i) in message.attachments" :key="i">
        <!-- Image card -->
        <div v-if="att.type === 'image'" class="image-card" @click="openFullscreen(att)">
          <img :src="att.url" :alt="att.name" loading="lazy" />
        </div>
        <!-- File card -->
        <a v-else :href="att.url" class="file-card" target="_blank" rel="noopener">
          <div class="file-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>
          </div>
          <div class="file-info">
            <span class="file-name">{{ att.name }}</span>
            <span class="file-size">{{ formatSize(att.size) }}</span>
          </div>
          <svg class="file-download" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        </a>
      </template>
    </div>
  </div>
  <div class="time-row" :class="{ mine: message.mine }">
    <span v-if="message.source === 'ai-auto'" class="ai-badge">{{ $t('chat.aiAutoReply') }}</span>
    <span class="time">{{ formatTime(message.timestamp) }}</span>
  </div>

  <!-- Fullscreen image overlay -->
  <Teleport to="body">
    <Transition name="viewer">
      <div v-if="fullscreenUrl" class="fullscreen-overlay" @click="closeFullscreen" @mousemove="onDragMove" @mouseup="onDragEnd" @mouseleave="onDragEnd">
      <div class="fullscreen-toolbar" @click.stop>
        <button class="toolbar-btn" @click="zoomOut" :title="t('chat.zoomOut')">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
        </button>
        <span class="toolbar-scale">{{ Math.round(imageScale * 100) }}%</span>
        <button class="toolbar-btn" @click="zoomIn" :title="t('chat.zoomIn')">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
        </button>
        <div class="toolbar-divider"></div>
        <button class="toolbar-btn" @click="rotateLeft" :title="t('chat.rotateLeft')">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
        </button>
        <button class="toolbar-btn" @click="rotateRight" :title="t('chat.rotateRight')">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
        </button>
        <div class="toolbar-divider"></div>
        <button class="toolbar-btn" @click="resetZoom" :title="t('chat.resetZoom')">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
        </button>
        <div class="toolbar-divider"></div>
        <button class="toolbar-btn" @click="downloadImage" :title="t('chat.downloadImage')">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        </button>
        <div class="toolbar-divider"></div>
        <button class="toolbar-btn" @click="closeFullscreen" :title="t('chat.closeViewer')">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      <img
        :src="fullscreenUrl"
        class="fullscreen-image"
        :class="{ dragging: isDragging }"
        :style="{ transform: imageTransform }"
        @click.stop
        @wheel.prevent="onImageWheel"
        @mousedown.prevent="onDragStart"
      />
    </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.bubble {
  max-width: 75%;
  padding: 10px 14px;
  border-radius: 18px;
  background: var(--glass-bg);
  backdrop-filter: blur(var(--glass-blur));
  -webkit-backdrop-filter: blur(var(--glass-blur));
  color: var(--bubble-other-text);
  align-self: flex-start;
  border: 1px solid var(--glass-border);
}

.bubble.mine {
  background: var(--bubble-mine);
  color: var(--bubble-mine-text);
  align-self: flex-end;
  border-bottom-right-radius: 4px;
}

.bubble:not(.mine) {
  border-bottom-left-radius: 4px;
}

.content {
  word-break: break-word;
  line-height: 1.45;
  font-size: 0.92em;
}

.content :deep(p) {
  margin: 0 0 0.4em;
}

.content :deep(p:last-child) {
  margin-bottom: 0;
}

.content :deep(strong) {
  font-weight: 600;
}

.content :deep(em) {
  font-style: italic;
}

.content :deep(code) {
  font-family: "SF Mono", Menlo, Consolas, monospace;
  font-size: 0.88em;
  background: var(--md-code-bg);
  color: var(--md-code-text);
  padding: 1px 5px;
  border-radius: 4px;
}

.content :deep(pre) {
  margin: 0.5em 0;
  padding: 10px 12px;
  background: var(--md-pre-bg);
  border-radius: var(--radius-sm);
  overflow-x: auto;
}

.content :deep(pre code) {
  background: none;
  color: var(--md-pre-text);
  padding: 0;
  font-size: 0.85em;
  line-height: 1.5;
}

.content :deep(a) {
  color: var(--md-link-color);
  text-decoration: none;
}

.content :deep(a:hover) {
  text-decoration: underline;
}

.content :deep(ul),
.content :deep(ol) {
  margin: 0.4em 0;
  padding-left: 1.5em;
}

.content :deep(li) {
  margin: 0.15em 0;
}

.content :deep(blockquote) {
  margin: 0.5em 0;
  padding: 4px 12px;
  border-left: 3px solid var(--md-blockquote-border);
  color: var(--md-blockquote-text);
}

.content :deep(blockquote p) {
  margin: 0;
}

/* Attachments */
.attachments {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
  margin-top: var(--space-sm);
}

.image-card {
  border-radius: var(--radius-md);
  overflow: hidden;
  cursor: pointer;
  max-width: 280px;
  border: 1px solid var(--glass-border);
  transition: opacity 0.15s;
}

.image-card:hover {
  opacity: 0.92;
}

.image-card img {
  display: block;
  max-width: 100%;
  max-height: 200px;
  object-fit: cover;
}

.file-card {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-sm) var(--space-md);
  background: var(--glass-bg-light);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  color: var(--text-primary);
  text-decoration: none;
  font-size: 0.85em;
  transition: border-color 0.15s, background 0.15s;
  max-width: 280px;
}

.file-card:hover {
  border-color: var(--accent);
  background: var(--glass-bg);
}

.file-icon {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--accent-light);
  border-radius: var(--radius-sm);
  color: var(--accent);
  flex-shrink: 0;
}

.file-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.file-name {
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-size {
  font-size: 0.8em;
  color: var(--text-muted);
}

.file-download {
  color: var(--text-muted);
  flex-shrink: 0;
  transition: color 0.15s;
}

.file-card:hover .file-download {
  color: var(--accent);
}

/* Fullscreen overlay */
.fullscreen-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: var(--image-overlay-bg);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.fullscreen-image {
  max-width: 90vw;
  max-height: 85vh;
  object-fit: contain;
  border-radius: var(--radius-md);
  box-shadow: var(--glass-shadow-heavy);
  transition: transform 0.2s ease;
  cursor: grab;
  user-select: none;
  -webkit-user-drag: none;
}

.fullscreen-image.dragging {
  cursor: grabbing;
  transition: none;
}

.fullscreen-toolbar {
  position: fixed;
  bottom: 32px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 10000;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  background: var(--image-toolbar-bg);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid var(--image-toolbar-border);
  border-radius: 12px;
  box-shadow: var(--image-toolbar-shadow);
}

.toolbar-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--image-toolbar-btn);
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}

.toolbar-btn:hover {
  background: var(--image-toolbar-btn-hover);
  color: var(--image-toolbar-btn-active);
}

.toolbar-scale {
  min-width: 42px;
  text-align: center;
  font-size: 0.8em;
  font-weight: 500;
  color: var(--image-toolbar-text);
  user-select: none;
}

.toolbar-divider {
  width: 1px;
  height: 20px;
  background: var(--image-toolbar-divider);
  margin: 0 4px;
}

.time-row {
  padding: 0 4px;
  margin-top: -2px;
  margin-bottom: 2px;
  display: flex;
  align-items: center;
  gap: var(--space-xs);
}

.time-row.mine {
  justify-content: flex-end;
}

.ai-badge {
  font-size: 0.68em;
  padding: 1px 6px;
  border-radius: var(--radius-sm);
  background: var(--glass-bg-light);
  border: 1px solid var(--glass-border);
  color: var(--text-muted);
  white-space: nowrap;
}

.time {
  font-size: 0.7em;
  color: var(--text-muted);
}

.viewer-enter-active {
  transition: opacity 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}
.viewer-enter-active .fullscreen-image {
  transition:
    transform 0.35s cubic-bezier(0.16, 1, 0.3, 1),
    opacity 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}
.viewer-enter-active .fullscreen-toolbar {
  transition:
    transform 0.35s cubic-bezier(0.16, 1, 0.3, 1) 0.05s,
    opacity 0.3s cubic-bezier(0.16, 1, 0.3, 1) 0.05s;
}
.viewer-leave-active {
  transition: opacity 0.2s cubic-bezier(0.4, 0, 1, 1);
}
.viewer-leave-active .fullscreen-image {
  transition:
    transform 0.2s cubic-bezier(0.4, 0, 1, 1),
    opacity 0.2s cubic-bezier(0.4, 0, 1, 1);
}
.viewer-leave-active .fullscreen-toolbar {
  transition:
    transform 0.2s cubic-bezier(0.4, 0, 1, 1),
    opacity 0.2s cubic-bezier(0.4, 0, 1, 1);
}
.viewer-enter-from {
  opacity: 0;
}
.viewer-enter-from .fullscreen-image {
  transform: scale(0.92);
  opacity: 0;
}
.viewer-enter-from .fullscreen-toolbar {
  transform: translateX(-50%) translateY(10px);
  opacity: 0;
}
.viewer-leave-to {
  opacity: 0;
}
.viewer-leave-to .fullscreen-image {
  transform: scale(0.96);
  opacity: 0;
}
.viewer-leave-to .fullscreen-toolbar {
  transform: translateX(-50%) translateY(6px);
  opacity: 0;
}
</style>
