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
import SvgIcon from "../SvgIcon";

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

const isSticker = computed(() => !!props.message.sticker);
const stickerUrl = computed(() => props.message.sticker?.url ?? "");

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
      <SvgIcon v-if="selected" name="check" :size="14" />
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
      <div ref="bubbleRef" class="bubble channel-bubble" :class="{ selected: selected && selectMode, 'sticker-mode': isSticker }" @click="!selectMode ? onBubbleClick($event) : emit('toggleSelect', message.id)" @contextmenu.prevent="!selectMode && bubbleRef && emit('contextmenu', bubbleRef.getBoundingClientRect(), message)">
        <div v-if="isSticker" class="sticker-image"><img :src="stickerUrl" :alt="message.sticker?.name" loading="lazy" /></div>
        <template v-else>
        <div v-if="message.quote" class="quote-card" :class="{ revoked: isQuoteRevoked }" @click.stop="handleQuoteClick">
          <span class="quote-sender">{{ getDisplayName(message.quote.from) }}</span>
          <span class="quote-text">{{ quoteDisplayText }}</span>
        </div>
        <div v-if="!message.forwarded?.length" class="content" v-html="renderedHtml"></div>
        <div v-if="message.forwarded?.length" class="forwarded-summary" @click.stop="forwardedDialogVisible = true">
          <SvgIcon name="chat" :size="14" />
          <span>{{ t('chat.chatHistory') }} ({{ message.forwarded.length }})</span>
          <SvgIcon class="arrow" name="chevron-right" :size="12" />
        </div>
        <div v-if="message.attachments?.length" class="attachments">
          <template v-for="(att, i) in message.attachments" :key="i">
            <div v-if="att.type === 'image'" class="image-card" @click="openFullscreen(att)"><img :src="att.url" :alt="att.name" loading="lazy" /></div>
            <a v-else :href="att.url" class="file-card" target="_blank" rel="noopener">
              <div class="file-icon"><SvgIcon name="file" :size="16" /></div>
              <div class="file-info"><span class="file-name">{{ att.name }}</span><span class="file-size">{{ formatFileSize(att.size) }}</span></div>
              <SvgIcon class="file-download" name="download" :size="14" />
            </a>
          </template>
        </div>
        </template>
      </div>
    </div>
    <span v-if="message.source === 'ai-auto'" class="ai-badge-inline">{{ $t('chat.aiAutoReply') }}</span>
  </div>

  <div v-else-if="isChannel && message.mine" class="bubble-row channel-row mine" :data-id="message.id">
    <div v-if="selectMode" class="checkbox" :class="{ checked: selected }" @click.stop="emit('toggleSelect', message.id)">
      <SvgIcon v-if="selected" name="check" :size="14" />
    </div>
    <div class="channel-body mine">
      <div class="channel-meta mine">
        <span v-if="message.source === 'ai-auto'" class="ai-badge-inline">{{ $t('chat.aiAutoReply') }}</span>
        <span class="channel-time">{{ formatTime(message.timestamp) }}</span>
      </div>
      <div class="channel-msg-row mine">
        <div ref="bubbleRef" class="bubble mine channel-bubble" :class="{ selected: selected && selectMode, 'sticker-mode': isSticker }" @click="!selectMode ? onBubbleClick($event) : emit('toggleSelect', message.id)" @contextmenu.prevent="!selectMode && bubbleRef && emit('contextmenu', bubbleRef.getBoundingClientRect(), message)">
          <div v-if="isSticker" class="sticker-image"><img :src="stickerUrl" :alt="message.sticker?.name" loading="lazy" /></div>
          <template v-else>
          <div v-if="message.quote" class="quote-card" :class="{ revoked: isQuoteRevoked }" @click.stop="handleQuoteClick">
            <span class="quote-sender">{{ getDisplayName(message.quote.from) }}</span>
            <span class="quote-text">{{ quoteDisplayText }}</span>
          </div>
          <div v-if="!message.forwarded?.length" class="content" v-html="renderedHtml"></div>
          <div v-if="message.forwarded?.length" class="forwarded-summary" @click.stop="forwardedDialogVisible = true">
            <SvgIcon name="chat" :size="14" />
            <span>{{ t('chat.chatHistory') }} ({{ message.forwarded.length }})</span>
            <SvgIcon class="arrow" name="chevron-right" :size="12" />
          </div>
          <div v-if="message.attachments?.length" class="attachments">
            <template v-for="(att, i) in message.attachments" :key="i">
              <div v-if="att.type === 'image'" class="image-card" @click="openFullscreen(att)"><img :src="att.url" :alt="att.name" loading="lazy" /></div>
              <a v-else :href="att.url" class="file-card" target="_blank" rel="noopener">
                <div class="file-icon"><SvgIcon name="file" :size="16" /></div>
                <div class="file-info"><span class="file-name">{{ att.name }}</span><span class="file-size">{{ formatFileSize(att.size) }}</span></div>
                <SvgIcon class="file-download" name="download" :size="14" />
              </a>
            </template>
          </div>
          </template>
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
      <SvgIcon v-if="selected" name="check" :size="14" />
    </div>
    <div ref="bubbleRef" class="bubble" :class="{ mine: message.mine, selected: selected && selectMode, 'sticker-mode': isSticker }" @click="!selectMode ? onBubbleClick($event) : emit('toggleSelect', message.id)" @contextmenu.prevent="!selectMode && bubbleRef && emit('contextmenu', bubbleRef.getBoundingClientRect(), message)">
      <div v-if="isSticker" class="sticker-image"><img :src="stickerUrl" :alt="message.sticker?.name" loading="lazy" /></div>
      <template v-else>
      <span v-if="showSender" class="sender-name">{{ getDisplayName(message.from) }}</span>
      <div v-if="message.quote" class="quote-card" :class="{ revoked: isQuoteRevoked }" @click.stop="handleQuoteClick">
        <span class="quote-sender">{{ getDisplayName(message.quote.from) }}</span>
        <span class="quote-text">{{ quoteDisplayText }}</span>
      </div>
      <div v-if="!message.forwarded?.length" class="content" v-html="renderedHtml"></div>
      <div v-if="message.forwarded?.length" class="forwarded-summary" @click.stop="forwardedDialogVisible = true">
        <SvgIcon name="chat" :size="14" />
        <span>{{ t('chat.chatHistory') }} ({{ message.forwarded.length }})</span>
        <SvgIcon class="arrow" name="chevron-right" :size="12" />
      </div>
      <div v-if="message.attachments?.length" class="attachments">
        <template v-for="(att, i) in message.attachments" :key="i">
          <div v-if="att.type === 'image'" class="image-card" @click="openFullscreen(att)"><img :src="att.url" :alt="att.name" loading="lazy" /></div>
          <a v-else :href="att.url" class="file-card" target="_blank" rel="noopener">
            <div class="file-icon"><SvgIcon name="file" :size="16" /></div>
            <div class="file-info"><span class="file-name">{{ att.name }}</span><span class="file-size">{{ formatFileSize(att.size) }}</span></div>
            <SvgIcon class="file-download" name="download" :size="14" />
          </a>
        </template>
      </div>
      </template>
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
          <button class="toolbar-btn" @click="viewer.zoomOut()" :title="t('chat.zoomOut')"><SvgIcon name="zoom-out" :size="18" /></button>
          <span class="toolbar-scale">{{ Math.round(viewer.imageScale.value * 100) }}%</span>
          <button class="toolbar-btn" @click="viewer.zoomIn()" :title="t('chat.zoomIn')"><SvgIcon name="zoom-in" :size="18" /></button>
          <div class="toolbar-divider"></div>
          <button class="toolbar-btn" @click="viewer.rotateLeft()" :title="t('chat.rotateLeft')"><SvgIcon name="rotate-ccw" :size="18" /></button>
          <button class="toolbar-btn" @click="viewer.rotateRight()" :title="t('chat.rotateRight')"><SvgIcon name="rotate-cw" :size="18" /></button>
          <div class="toolbar-divider"></div>
          <button class="toolbar-btn" @click="viewer.resetZoom()" :title="t('chat.resetZoom')"><SvgIcon name="refresh" :size="18" /></button>
          <div class="toolbar-divider"></div>
          <button class="toolbar-btn" @click="viewer.downloadImage()" :title="t('chat.downloadImage')"><SvgIcon name="download" :size="18" /></button>
          <div class="toolbar-divider"></div>
          <button class="toolbar-btn" @click="viewer.closeFullscreen()" :title="t('chat.closeViewer')"><SvgIcon name="close" :size="18" /></button>
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
            <button class="forwarded-dialog-close" @click="forwardedDialogVisible = false"><SvgIcon name="close" :size="16" /></button>
          </div>
          <div class="forwarded-dialog-body">
            <div v-for="(rec, i) in message.forwarded" :key="i" class="fd-record">
              <div class="fd-meta">{{ getDisplayName(rec.from) }} · {{ formatTime(rec.timestamp) }}</div>
              <div v-if="rec.text" class="fd-text">{{ rec.text }}</div>
              <div v-if="rec.attachments?.length" class="fd-attachments">
                <template v-for="(att, j) in rec.attachments" :key="j">
                  <div v-if="att.type === 'image'" class="image-card" @click="openFullscreen(att)"><img :src="att.url" :alt="att.name" loading="lazy" /></div>
                  <div v-else class="file-card" @click="handleForwardedFileDownload(att)">
                    <div class="file-icon"><SvgIcon name="file" :size="16" /></div>
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
