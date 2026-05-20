<script setup lang="ts">
import type { MessageAttachment } from "../../types";
import { renderMarkdown, escapeRegex, DOMPurify } from "../../utils/markdown";
import { formatFileSize } from "../../utils/taskFormatters";
import { useUserProfile } from "../../composables/useUserProfile";
import { useFullscreenViewer } from "../../composables/useFullscreenViewer";
import { computed, onUnmounted } from "vue";
import SvgIcon from "../SvgIcon";

const props = defineProps<{
  text: string;
  mentions?: string[];
  memberIds?: string[];
  quote?: { from: string; text: string } | null;
  isQuoteRevoked?: boolean;
  forwarded?: { from: string; text?: string; timestamp: number; attachments?: MessageAttachment[] }[] | null;
  attachments?: MessageAttachment[];
  isSticker?: boolean;
  stickerUrl?: string;
  stickerName?: string;
  showSender?: boolean;
  senderName?: string;
}>();

const emit = defineEmits<{
  "scroll-to-quote": [];
  "open-forwarded": [];
}>();

const { getDisplayName } = useUserProfile();

const renderedHtml = computed(() => {
  let rawText = props.text;
  if (props.mentions && props.mentions.length > 0) {
    const expanded = props.mentions.flatMap(m =>
      m === "all" && props.memberIds ? props.memberIds : [m]
    );
    for (const m of expanded) {
      const displayName = getDisplayName(m);
      rawText = rawText.replace(new RegExp(`@${escapeRegex(m)}(?!\\w)`, "g"), `<span class="mention-highlight">@${escapeRegex(displayName)}</span>`);
    }
  }
  const raw = renderMarkdown(rawText);
  return DOMPurify.sanitize(raw, { ADD_TAGS: ["span"], ADD_ATTR: ["class"] });
});

const viewer = useFullscreenViewer();

function openFullscreen(att: MessageAttachment) {
  if (att.type === "image") viewer.openFullscreen(att.url);
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === "Escape" && viewer.fullscreenUrl.value) viewer.closeFullscreen();
}

document.addEventListener("keydown", handleKeydown);
onUnmounted(() => document.removeEventListener("keydown", handleKeydown));
</script>

<template>
  <div v-if="isSticker" class="sticker-image"><img :src="stickerUrl" :alt="stickerName" loading="lazy" /></div>
  <template v-else>
    <span v-if="showSender" class="sender-name">{{ senderName }}</span>
    <div v-if="quote" class="quote-card" :class="{ revoked: isQuoteRevoked }" @click.stop="emit('scroll-to-quote')">
      <span class="quote-sender">{{ quote.from }}</span>
      <span class="quote-text">{{ quote.text }}</span>
    </div>
    <div v-if="!forwarded?.length" class="content" v-html="renderedHtml"></div>
    <div v-if="forwarded?.length" class="forwarded-summary" @click.stop="emit('open-forwarded')">
      <SvgIcon name="chat" :size="14" />
      <span>Chat History ({{ forwarded.length }})</span>
      <SvgIcon class="arrow" name="chevron-right" :size="12" />
    </div>
    <div v-if="attachments?.length" class="attachments">
      <template v-for="(att, i) in attachments" :key="i">
        <div v-if="att.type === 'image'" class="image-card" @click="openFullscreen(att)"><img :src="att.url" :alt="att.name" loading="lazy" /></div>
        <a v-else :href="att.url" class="file-card" target="_blank" rel="noopener">
          <div class="file-icon"><SvgIcon name="file" :size="16" /></div>
          <div class="file-info"><span class="file-name">{{ att.name }}</span><span class="file-size">{{ formatFileSize(att.size) }}</span></div>
          <SvgIcon class="file-download" name="download" :size="14" />
        </a>
      </template>
    </div>
  </template>

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
@import './styles.css';
</style>
