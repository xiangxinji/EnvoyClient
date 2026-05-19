<script setup lang="ts">
import { computed, ref, onUnmounted } from "vue";
import { useI18n } from "vue-i18n";
import { openUrl } from "@tauri-apps/plugin-opener";
import type { ChatMessage, MemberInfo, MessageAttachment, TimelineItem } from "../../types";
import { downloadFileWithDialog } from "../../utils/notification";
import { useUserProfile } from "../../composables/useUserProfile";
import { useFullscreenViewer } from "../../composables/useFullscreenViewer";
import { renderMarkdown, escapeRegex, DOMPurify } from "../../utils/markdown";
import { formatTime, formatFileSize } from "../../utils/taskFormatters";
import MemberHoverCard from "../MemberHoverCard";

const props = defineProps<{
  message: ChatMessage;
  myId: string;
  selectMode?: boolean;
  selected?: boolean;
  timeline?: TimelineItem[];
  showSender?: boolean;
  memberIds?: string[];
  isChannel?: boolean;
  members?: MemberInfo[];
}>();

const emit = defineEmits<{
  contextmenu: [rect: DOMRect, message: ChatMessage];
  toggleSelect: [id: string];
  "scroll-to-quote": [quoteId: string];
}>();

const { t } = useI18n();
const { getDisplayName, getAvatarUrl } = useUserProfile();

const isQuoteRevoked = computed(() => {
  if (!props.message.quote || !props.timeline) return false;
  const found = props.timeline.find(item => item.id === props.message.quote!.id);
  return !!found && found.type === "revoked";
});

const quoteDisplayText = computed(() => {
  if (!props.message.quote) return "";
  if (isQuoteRevoked.value) return t('chat.quoteRevoked');
  return props.message.quote.text;
});

function handleQuoteClick() {
  if (props.message.quote) emit("scroll-to-quote", props.message.quote.id);
}

const bubbleRef = ref<HTMLElement | null>(null);

function onBubbleClick(e: MouseEvent) {
  const anchor = (e.target as HTMLElement).closest("a[href]");
  if (anchor) {
    const href = anchor.getAttribute("href");
    if (href && !href.startsWith("#")) { e.preventDefault(); openUrl(href); }
  }
}

const renderedHtml = computed(() => {
  let rawText = props.message.text;
  if (props.message.mentions && props.message.mentions.length > 0) {
    const expanded = props.message.mentions.flatMap(m =>
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
const forwardedDialogVisible = ref(false);
const forwardedDownloading = ref(false);

function openFullscreen(att: MessageAttachment) {
  if (att.type === "image") viewer.openFullscreen(att.url);
}

async function handleForwardedFileDownload(att: MessageAttachment) {
  if (forwardedDownloading.value) return;
  forwardedDownloading.value = true;
  try { await downloadFileWithDialog(att.url, att.name); } catch { /* download failed */ }
  finally { forwardedDownloading.value = false; }
}

// Avatar hover card
const hoverVisible = ref(false);
const hoverRect = ref<DOMRect | null>(null);
const hoverMember = ref<MemberInfo | null>(null);
let hoverTimer: ReturnType<typeof setTimeout> | null = null;

function getMember(id: string): MemberInfo | null { return props.members?.find(m => m.id === id) ?? null; }

function onAvatarEnter(e: MouseEvent) {
  const member = getMember(props.message.from);
  if (!member) return;
  const target = e.currentTarget as HTMLElement;
  if (hoverTimer) clearTimeout(hoverTimer);
  hoverTimer = setTimeout(() => { hoverMember.value = member; hoverRect.value = target.getBoundingClientRect(); hoverVisible.value = true; }, 150);
}

function onAvatarLeave() {
  if (hoverTimer) { clearTimeout(hoverTimer); hoverTimer = null; }
  hoverTimer = setTimeout(() => { hoverVisible.value = false; }, 100);
}

function onCardEnter() { if (hoverTimer) { clearTimeout(hoverTimer); hoverTimer = null; } }
function onCardLeave() { hoverTimer = setTimeout(() => { hoverVisible.value = false; }, 100); }

function handleKeydown(e: KeyboardEvent) {
  if (e.key === "Escape") {
    if (viewer.fullscreenUrl.value) viewer.closeFullscreen();
    else if (forwardedDialogVisible.value) forwardedDialogVisible.value = false;
  }
}

document.addEventListener("keydown", handleKeydown);
onUnmounted(() => {
  document.removeEventListener("keydown", handleKeydown);
  if (hoverTimer) clearTimeout(hoverTimer);
});
</script>

<template>
  <div v-if="isChannel && !message.mine" class="bubble-row channel-row" :data-id="message.id">
    <div v-if="selectMode" class="checkbox" :class="{ checked: selected }" @click.stop="emit('toggleSelect', message.id)">
      <svg v-if="selected" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
    </div>
    <div class="channel-avatar" @mouseenter="onAvatarEnter" @mouseleave="onAvatarLeave">
      <img v-if="getAvatarUrl(message.from)" :src="getAvatarUrl(message.from)!" class="channel-avatar-img" />
      <template v-else>{{ getDisplayName(message.from).charAt(0).toUpperCase() }}</template>
    </div>
    <div class="channel-body">
      <div class="channel-meta">
        <span class="channel-sender">{{ getDisplayName(message.from) }}</span>
        <span class="channel-time">{{ formatTime(message.timestamp) }}</span>
      </div>
      <div ref="bubbleRef" class="bubble channel-bubble" :class="{ selected: selected && selectMode }" @click="!selectMode ? onBubbleClick($event) : emit('toggleSelect', message.id)" @contextmenu.prevent="!selectMode && bubbleRef && emit('contextmenu', bubbleRef.getBoundingClientRect(), message)">
        <div v-if="message.quote" class="quote-card" :class="{ revoked: isQuoteRevoked }" @click.stop="handleQuoteClick">
          <span class="quote-sender">{{ getDisplayName(message.quote.from) }}</span>
          <span class="quote-text">{{ quoteDisplayText }}</span>
        </div>
        <div v-if="!message.forwarded?.length" class="content" v-html="renderedHtml"></div>
        <div v-if="message.forwarded?.length" class="forwarded-summary" @click.stop="forwardedDialogVisible = true">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          <span>{{ t('chat.chatHistory') }} ({{ message.forwarded.length }})</span>
          <svg class="arrow" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
        </div>
        <div v-if="message.attachments?.length" class="attachments">
          <template v-for="(att, i) in message.attachments" :key="i">
            <div v-if="att.type === 'image'" class="image-card" @click="openFullscreen(att)"><img :src="att.url" :alt="att.name" loading="lazy" /></div>
            <a v-else :href="att.url" class="file-card" target="_blank" rel="noopener">
              <div class="file-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg></div>
              <div class="file-info"><span class="file-name">{{ att.name }}</span><span class="file-size">{{ formatFileSize(att.size) }}</span></div>
              <svg class="file-download" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            </a>
          </template>
        </div>
      </div>
    </div>
    <span v-if="message.source === 'ai-auto'" class="ai-badge-inline">{{ $t('chat.aiAutoReply') }}</span>
  </div>

  <div v-else-if="isChannel && message.mine" class="bubble-row channel-row mine" :data-id="message.id">
    <div v-if="selectMode" class="checkbox" :class="{ checked: selected }" @click.stop="emit('toggleSelect', message.id)">
      <svg v-if="selected" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
    </div>
    <div class="channel-body mine">
      <div class="channel-meta mine">
        <span v-if="message.source === 'ai-auto'" class="ai-badge-inline">{{ $t('chat.aiAutoReply') }}</span>
        <span class="channel-time">{{ formatTime(message.timestamp) }}</span>
      </div>
      <div class="channel-msg-row mine">
        <div ref="bubbleRef" class="bubble mine channel-bubble" :class="{ selected: selected && selectMode }" @click="!selectMode ? onBubbleClick($event) : emit('toggleSelect', message.id)" @contextmenu.prevent="!selectMode && bubbleRef && emit('contextmenu', bubbleRef.getBoundingClientRect(), message)">
          <div v-if="message.quote" class="quote-card" :class="{ revoked: isQuoteRevoked }" @click.stop="handleQuoteClick">
            <span class="quote-sender">{{ getDisplayName(message.quote.from) }}</span>
            <span class="quote-text">{{ quoteDisplayText }}</span>
          </div>
          <div v-if="!message.forwarded?.length" class="content" v-html="renderedHtml"></div>
          <div v-if="message.forwarded?.length" class="forwarded-summary" @click.stop="forwardedDialogVisible = true">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            <span>{{ t('chat.chatHistory') }} ({{ message.forwarded.length }})</span>
            <svg class="arrow" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
          </div>
          <div v-if="message.attachments?.length" class="attachments">
            <template v-for="(att, i) in message.attachments" :key="i">
              <div v-if="att.type === 'image'" class="image-card" @click="openFullscreen(att)"><img :src="att.url" :alt="att.name" loading="lazy" /></div>
              <a v-else :href="att.url" class="file-card" target="_blank" rel="noopener">
                <div class="file-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg></div>
                <div class="file-info"><span class="file-name">{{ att.name }}</span><span class="file-size">{{ formatFileSize(att.size) }}</span></div>
                <svg class="file-download" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              </a>
            </template>
          </div>
        </div>
        <div class="channel-avatar mine-avatar">
          <img v-if="getAvatarUrl(message.from)" :src="getAvatarUrl(message.from)!" class="channel-avatar-img" />
          <template v-else>{{ getDisplayName(message.from).charAt(0).toUpperCase() }}</template>
        </div>
      </div>
    </div>
  </div>

  <template v-else>
  <div class="bubble-row" :class="{ mine: message.mine }" :data-id="message.id">
    <div v-if="selectMode" class="checkbox" :class="{ checked: selected }" @click.stop="emit('toggleSelect', message.id)">
      <svg v-if="selected" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
    </div>
    <div ref="bubbleRef" class="bubble" :class="{ mine: message.mine, selected: selected && selectMode }" @click="!selectMode ? onBubbleClick($event) : emit('toggleSelect', message.id)" @contextmenu.prevent="!selectMode && bubbleRef && emit('contextmenu', bubbleRef.getBoundingClientRect(), message)">
      <span v-if="showSender" class="sender-name">{{ getDisplayName(message.from) }}</span>
      <div v-if="message.quote" class="quote-card" :class="{ revoked: isQuoteRevoked }" @click.stop="handleQuoteClick">
        <span class="quote-sender">{{ getDisplayName(message.quote.from) }}</span>
        <span class="quote-text">{{ quoteDisplayText }}</span>
      </div>
      <div v-if="!message.forwarded?.length" class="content" v-html="renderedHtml"></div>
      <div v-if="message.forwarded?.length" class="forwarded-summary" @click.stop="forwardedDialogVisible = true">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
        <span>{{ t('chat.chatHistory') }} ({{ message.forwarded.length }})</span>
        <svg class="arrow" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
      </div>
      <div v-if="message.attachments?.length" class="attachments">
        <template v-for="(att, i) in message.attachments" :key="i">
          <div v-if="att.type === 'image'" class="image-card" @click="openFullscreen(att)"><img :src="att.url" :alt="att.name" loading="lazy" /></div>
          <a v-else :href="att.url" class="file-card" target="_blank" rel="noopener">
            <div class="file-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg></div>
            <div class="file-info"><span class="file-name">{{ att.name }}</span><span class="file-size">{{ formatFileSize(att.size) }}</span></div>
            <svg class="file-download" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          </a>
        </template>
      </div>
    </div>
  </div>
  <div class="time-row" :class="{ mine: message.mine }">
    <span v-if="message.source === 'ai-auto'" class="ai-badge">{{ $t('chat.aiAutoReply') }}</span>
    <span class="time">{{ formatTime(message.timestamp) }}</span>
  </div>
  </template>

  <Teleport to="body">
    <Transition name="viewer">
      <div v-if="viewer.fullscreenUrl.value" class="fullscreen-overlay" @click="viewer.closeFullscreen()" @mousemove="viewer.onDragMove" @mouseup="viewer.onDragEnd" @mouseleave="viewer.onDragEnd">
        <div class="fullscreen-toolbar" @click.stop>
          <button class="toolbar-btn" @click="viewer.zoomOut()" :title="t('chat.zoomOut')"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/></svg></button>
          <span class="toolbar-scale">{{ Math.round(viewer.imageScale.value * 100) }}%</span>
          <button class="toolbar-btn" @click="viewer.zoomIn()" :title="t('chat.zoomIn')"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg></button>
          <div class="toolbar-divider"></div>
          <button class="toolbar-btn" @click="viewer.rotateLeft()" :title="t('chat.rotateLeft')"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg></button>
          <button class="toolbar-btn" @click="viewer.rotateRight()" :title="t('chat.rotateRight')"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg></button>
          <div class="toolbar-divider"></div>
          <button class="toolbar-btn" @click="viewer.resetZoom()" :title="t('chat.resetZoom')"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg></button>
          <div class="toolbar-divider"></div>
          <button class="toolbar-btn" @click="viewer.downloadImage()" :title="t('chat.downloadImage')"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg></button>
          <div class="toolbar-divider"></div>
          <button class="toolbar-btn" @click="viewer.closeFullscreen()" :title="t('chat.closeViewer')"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
        </div>
        <img :src="viewer.fullscreenUrl.value" class="fullscreen-image" :class="{ dragging: viewer.isDragging.value }" :style="{ transform: viewer.imageTransform.value }" @click.stop @wheel.prevent="viewer.onImageWheel" @mousedown.prevent="viewer.onDragStart" />
      </div>
    </Transition>
  </Teleport>

  <Teleport to="body">
    <Transition name="viewer">
      <div v-if="forwardedDialogVisible" class="forwarded-dialog-overlay" @click="forwardedDialogVisible = false">
        <div class="forwarded-dialog" @click.stop>
          <div class="forwarded-dialog-header">
            <span>{{ t('chat.chatHistory') }}</span>
            <button class="forwarded-dialog-close" @click="forwardedDialogVisible = false"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
          </div>
          <div class="forwarded-dialog-body">
            <div v-for="(rec, i) in message.forwarded" :key="i" class="fd-record">
              <div class="fd-meta">{{ getDisplayName(rec.from) }} · {{ formatTime(rec.timestamp) }}</div>
              <div v-if="rec.text" class="fd-text">{{ rec.text }}</div>
              <div v-if="rec.attachments?.length" class="fd-attachments">
                <template v-for="(att, j) in rec.attachments" :key="j">
                  <div v-if="att.type === 'image'" class="image-card" @click="openFullscreen(att)"><img :src="att.url" :alt="att.name" loading="lazy" /></div>
                  <div v-else class="file-card" @click="handleForwardedFileDownload(att)">
                    <div class="file-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg></div>
                    <div class="file-info"><span class="file-name">{{ att.name }}</span><span class="file-size">{{ formatFileSize(att.size) }}</span></div>
                  </div>
                </template>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>

  <MemberHoverCard v-if="hoverMember" :member="hoverMember" :rect="hoverRect" :visible="hoverVisible" @mouseenter="onCardEnter" @mouseleave="onCardLeave" />
</template>

<style scoped>
@import './styles.css';
</style>
