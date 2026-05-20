<script setup lang="ts">
import type { MessageAttachment, CloudRef } from "../../types";
import { renderMarkdown, escapeRegex, DOMPurify } from "../../utils/markdown";
import { formatFileSize } from "../../utils/taskFormatters";
import { useUserProfile } from "../../composables/useUserProfile";
import { useFullscreenViewer } from "../../composables/useFullscreenViewer";
import { computed, onMounted, onUnmounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { getCloudResourceService } from "../../composables/teamClientContext";
import SvgIcon from "../SvgIcon";

const { t } = useI18n();

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
  cloudRefs?: CloudRef[];
  teamName?: string;
}>();

const emit = defineEmits<{
  "scroll-to-quote": [];
  "open-forwarded": [];
}>();

const { getDisplayName } = useUserProfile();

const validationMap = ref<Record<string, boolean>>({});

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const renderedHtml = computed(() => {
  let rawText = props.text;

  // Replace {cloud:N} markers with final HTML before markdown processing
  rawText = rawText.replace(/\{cloud:(\d+)\}/g, (_match: string, idx: string) => {
    const index = parseInt(idx, 10);
    const cloudRef = props.cloudRefs?.[index];
    if (!cloudRef || !cloudRef.name) return `{cloud:${index}}`;
    const refPath = cloudRef.path ?? "";
    const expired = refPath ? validationMap.value[refPath] === false : false;
    if (cloudRef.type === "directory") {
      return expired
        ? `<span class="cloud-ref-card expired"><span class="cloud-ref-icon-fallback">📁</span><span class="cloud-ref-name">${escapeHtml(cloudRef.name)}</span><span class="cloud-ref-expired">(${t("cloudMention.expired")})</span></span>`
        : `<span class="cloud-ref-card directory" data-cloud-path="${escapeHtml(refPath)}"><span class="cloud-ref-icon-fallback">📁</span><span class="cloud-ref-name">${escapeHtml(cloudRef.name)}</span><span class="cloud-ref-action">${t("cloudMention.openInCloud")}</span></span>`;
    } else {
      const dlUrl = refPath && props.teamName ? escapeHtml(getCloudResourceService().downloadUrl(refPath)) : "#";
      return expired
        ? `<span class="cloud-ref-card expired"><span class="cloud-ref-icon-fallback">📄</span><span class="cloud-ref-info"><span class="cloud-ref-name">${escapeHtml(cloudRef.name)}</span><span class="cloud-ref-expired">(${t("cloudMention.expired")})</span></span></span>`
        : `<a class="cloud-ref-card file" href="${dlUrl}" target="_blank" rel="noopener"><span class="cloud-ref-icon-fallback">📄</span><span class="cloud-ref-info"><span class="cloud-ref-name">${escapeHtml(cloudRef.name)}</span><span class="cloud-ref-size">${formatFileSize(cloudRef.size ?? 0)}</span></span><span class="cloud-ref-download">⬇</span></a>`;
    }
  });

  if (props.mentions && props.mentions.length > 0) {
    const expanded = props.mentions.flatMap(m =>
      m === "all" && props.memberIds ? props.memberIds : [m]
    );
    for (const m of expanded) {
      const displayName = getDisplayName(m);
      rawText = rawText.replace(new RegExp(`@${escapeRegex(m)}(?!\\w)`, "g"), `<span class="mention-highlight">@${escapeRegex(displayName)}</span>`);
    }
  }
  let raw = renderMarkdown(rawText);
  let sanitized = DOMPurify.sanitize(raw, { ADD_TAGS: ["span", "a"], ADD_ATTR: ["class", "data-cloud-path", "target", "rel", "href"] });

  return sanitized;
});

let cancelled = false;
onMounted(async () => {
  if (!props.cloudRefs?.length || !props.teamName) return;
  const paths = props.cloudRefs.map(r => r.path);
  try {
    const result = await getCloudResourceService().validatePaths(paths);
    if (!cancelled) validationMap.value = result;
  } catch {
    // silent fail — cards stay in valid state
  }
});
onUnmounted(() => { cancelled = true; });

const viewer = useFullscreenViewer();

function openFullscreen(att: MessageAttachment) {
  if (att.type === "image") viewer.openFullscreen(att.url);
}
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
