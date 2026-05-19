<script setup lang="ts">
import { computed, ref, onUnmounted } from "vue";
import { useI18n } from "vue-i18n";
import { openUrl } from "@tauri-apps/plugin-opener";
import type { ChatMessage, MemberInfo, MessageAttachment, TimelineItem } from "../types";
import { downloadFileWithDialog } from "../utils/notification";
import { useUserProfile } from "../composables/useUserProfile";
import { useFullscreenViewer } from "../composables/useFullscreenViewer";
import { renderMarkdown, escapeRegex, DOMPurify } from "../utils/markdown";
import { formatTime, formatFileSize } from "../utils/taskFormatters";
import MemberHoverCard from "./MemberHoverCard.vue";

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
.bubble-row { display: flex; align-items: flex-start; gap: 6px; max-width: 78%; }
.bubble-row.mine { align-self: flex-end; flex-direction: row-reverse; }
.checkbox { width: 20px; height: 20px; border-radius: 50%; border: 2px solid var(--glass-border); background: var(--glass-bg-light); display: flex; align-items: center; justify-content: center; flex-shrink: 0; cursor: pointer; margin-top: 10px; transition: all 0.15s; }
.checkbox.checked { background: var(--accent); border-color: var(--accent); color: var(--text-on-accent); }
.bubble { max-width: 75%; padding: 10px 14px; border-radius: 18px; background: var(--glass-bg); backdrop-filter: blur(var(--glass-blur)); -webkit-backdrop-filter: blur(var(--glass-blur)); color: var(--bubble-other-text); align-self: flex-start; border: 1px solid var(--glass-border); }
.bubble.mine { background: var(--bubble-mine); color: var(--bubble-mine-text); align-self: flex-end; border-bottom-right-radius: 4px; }
.bubble:not(.mine) { border-bottom-left-radius: 4px; }
.bubble.selected { border-color: var(--accent); box-shadow: 0 0 0 1px var(--accent); }

.forwarded-summary { display: flex; align-items: center; gap: var(--space-xs); cursor: pointer; font-size: 0.88em; opacity: 0.75; transition: opacity 0.15s; white-space: nowrap; }
.forwarded-summary:hover { opacity: 1; }
.forwarded-summary .arrow { margin-left: auto; }

.forwarded-dialog-overlay { position: fixed; inset: 0; z-index: 9998; background: var(--overlay-bg); backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; }
.forwarded-dialog { width: 440px; max-height: 70vh; display: flex; flex-direction: column; background: var(--glass-bg-heavy); backdrop-filter: blur(var(--glass-blur)); -webkit-backdrop-filter: blur(var(--glass-blur)); border: 1px solid var(--glass-border); border-radius: var(--radius-md); box-shadow: var(--glass-shadow-heavy); overflow: hidden; }
.forwarded-dialog-header { display: flex; align-items: center; justify-content: space-between; padding: var(--space-md) var(--space-lg); font-weight: 600; font-size: 0.95em; color: var(--text-primary); border-bottom: 1px solid var(--glass-border); }
.forwarded-dialog-close { display: flex; align-items: center; justify-content: center; width: 28px; height: 28px; border: none; border-radius: var(--radius-sm); background: transparent; color: var(--text-muted); cursor: pointer; transition: all 0.15s; }
.forwarded-dialog-close:hover { background: var(--glass-bg-light); color: var(--text-primary); }
.forwarded-dialog-body { flex: 1; overflow-y: auto; padding: var(--space-md) var(--space-lg); display: flex; flex-direction: column; gap: var(--space-md); }
.fd-record { padding-bottom: var(--space-md); border-bottom: 1px solid var(--glass-border); }
.fd-record:last-child { border-bottom: none; padding-bottom: 0; }
.fd-meta { font-size: 0.75em; color: var(--text-muted); margin-bottom: var(--space-xs); }
.fd-text { font-size: 0.9em; color: var(--text-primary); line-height: 1.5; word-break: break-word; }
.fd-attachments { display: flex; flex-direction: column; gap: var(--space-xs); margin-top: var(--space-xs); }
.fd-attachments .image-card { border: none; }
.fd-attachments .file-card { display: flex; align-items: center; gap: var(--space-sm); padding: var(--space-sm) var(--space-md); background: var(--glass-bg-light); border: 1px solid var(--glass-border); border-radius: var(--radius-md); cursor: pointer; max-width: 280px; }

.quote-card { display: flex; flex-direction: column; gap: var(--space-xs); padding: var(--space-xs) var(--space-sm); margin-bottom: var(--space-sm); border: 1px solid rgba(255, 255, 255, 0.18); border-left: 3px solid rgba(255, 255, 255, 0.5); border-radius: var(--radius-sm); background: rgba(255, 255, 255, 0.15); cursor: pointer; transition: background 0.15s; }
.quote-card:hover { background: rgba(255, 255, 255, 0.22); }
.quote-card.revoked .quote-text { opacity: 0.5; font-style: italic; }
.quote-sender { font-size: 0.75em; font-weight: 600; opacity: 0.9; }
.quote-text { font-size: 0.78em; opacity: 0.7; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; line-height: 1.4; }
.bubble:not(.mine) .quote-card { background: transparent; border: none; border-left: 3px solid var(--accent); border-radius: var(--radius-sm); }
.bubble:not(.mine) .quote-card:hover { background: transparent; }
.bubble:not(.mine) .quote-sender { color: var(--accent); opacity: 1; }
.bubble:not(.mine) .quote-text { color: var(--text-secondary); opacity: 1; }

.content { word-break: break-word; line-height: 1.45; font-size: 0.92em; }
.content :deep(p) { margin: 0 0 0.4em; }
.content :deep(p:last-child) { margin-bottom: 0; }
.content :deep(strong) { font-weight: 600; }
.content :deep(em) { font-style: italic; }
.content :deep(code) { font-family: "SF Mono", Menlo, Consolas, monospace; font-size: 0.88em; background: var(--md-code-bg); color: var(--md-code-text); padding: 1px 5px; border-radius: 4px; }
.content :deep(pre) { margin: 0.5em 0; padding: 10px 12px; background: var(--md-pre-bg); border-radius: var(--radius-sm); overflow-x: auto; }
.content :deep(pre code) { background: none; color: var(--md-pre-text); padding: 0; font-size: 0.85em; line-height: 1.5; }
.content :deep(a) { color: var(--md-link-color); text-decoration: none; }
.content :deep(a:hover) { text-decoration: underline; }
.bubble.mine .content :deep(a) { color: rgba(255, 255, 255, 0.85); text-decoration: underline; text-decoration-style: dotted; }
.bubble.mine .content :deep(a:hover) { color: #fff; }
.content :deep(ul), .content :deep(ol) { margin: 0.4em 0; padding-left: 1.5em; }
.content :deep(li) { margin: 0.15em 0; }
.content :deep(blockquote) { margin: 0.5em 0; padding: 4px 12px; border-left: 3px solid var(--md-blockquote-border); color: var(--md-blockquote-text); }
.content :deep(blockquote p) { margin: 0; }

.attachments { display: flex; flex-direction: column; gap: var(--space-xs); margin-top: var(--space-sm); }
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

.time-row { padding: 0 4px; margin-top: -2px; margin-bottom: 2px; display: flex; align-items: center; gap: var(--space-xs); }
.time-row.mine { justify-content: flex-end; }
.ai-badge { font-size: 0.68em; padding: 1px 6px; border-radius: var(--radius-sm); background: var(--glass-bg-light); border: 1px solid var(--glass-border); color: var(--text-muted); white-space: nowrap; }
.time { font-size: 0.7em; color: var(--text-muted); }

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

.channel-row { max-width: 90%; align-items: flex-start; gap: 8px; }
.channel-row.mine { flex-direction: row; justify-content: flex-end; }
.channel-msg-row { display: flex; align-items: flex-start; gap: 8px; }
.channel-msg-row.mine { flex-direction: row; justify-content: flex-end; }
.channel-avatar { width: 34px; height: 34px; border-radius: 50%; background: var(--accent-light); color: var(--accent); display: flex; align-items: center; justify-content: center; font-weight: 600; font-size: 0.8em; flex-shrink: 0; margin-top: 2px; cursor: pointer; border: 2px solid transparent; transition: border-color 0.15s, transform 0.15s; }
.channel-avatar:hover { border-color: var(--accent); transform: scale(1.08); }
.channel-avatar.mine-avatar { margin-top: 2px; cursor: default; pointer-events: none; }
.channel-avatar-img { width: 100%; height: 100%; border-radius: 50%; object-fit: cover; }
.channel-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.channel-body.mine { align-items: flex-end; }
.channel-meta { display: flex; align-items: baseline; gap: var(--space-sm); padding: 0 4px; }
.channel-meta.mine { justify-content: flex-end; }
.channel-sender { font-size: 0.78em; font-weight: 600; color: var(--text-secondary); }
.channel-time { font-size: 0.68em; color: var(--text-muted); }
.channel-bubble { border-radius: 12px; }
.channel-bubble.mine { border-bottom-right-radius: 4px; }
.channel-bubble:not(.mine) { border-bottom-left-radius: 4px; }
.ai-badge-inline { font-size: 0.68em; padding: 1px 6px; border-radius: var(--radius-sm); background: var(--glass-bg-light); border: 1px solid var(--glass-border); color: var(--text-muted); white-space: nowrap; align-self: center; }
.sender-name { display: block; font-size: 0.75em; font-weight: 600; color: var(--accent); margin-bottom: 2px; }
:deep(.mention-highlight) { color: var(--accent); font-weight: 600; background: var(--accent-light); padding: 0 3px; border-radius: 3px; }
</style>
