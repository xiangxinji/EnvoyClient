<script setup lang="ts">
import { computed, ref, onUnmounted, watch } from "vue";
import { useI18n } from "vue-i18n";
import { openUrl } from "@tauri-apps/plugin-opener";
import type { ChatMessage, MemberInfo, TimelineItem } from "../../types";
import { downloadFileWithDialog } from "../../utils/notification";
import { useUserProfile } from "../../composables/useUserProfile";
import { useHoverCard } from "../../composables/useHoverCard";
import { formatTime, formatFileSize } from "../../utils/taskFormatters";
import BubbleContent from "../BubbleContent";
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
  teamName?: string;
}>();

const emit = defineEmits<{
  contextmenu: [rect: DOMRect, message: ChatMessage];
  toggleSelect: [id: string];
  "scroll-to-quote": [quoteId: string];
}>();

const { t } = useI18n();
const { getDisplayName, getAvatarUrl, getInitial } = useUserProfile();
const { hoveredItem: hoverMember, hoverRect, visible: hoverVisible, show: showHoverCard, scheduleHide: hideHoverCard, cancelHide: cancelHoverHide } = useHoverCard<MemberInfo>();

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

const quoteForContent = computed(() => {
  if (!props.message.quote) return null;
  return { from: getDisplayName(props.message.quote.from), text: quoteDisplayText.value };
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

const forwardedDialogVisible = ref(false);
const forwardedDownloading = ref(false);

async function handleForwardedFileDownload(att: { url: string; name: string }) {
  if (forwardedDownloading.value) return;
  forwardedDownloading.value = true;
  try { await downloadFileWithDialog(att.url, att.name); } catch { /* download failed */ }
  finally { forwardedDownloading.value = false; }
}

function getMember(id: string): MemberInfo | null { return props.members?.find(m => m.id === id) ?? null; }

function onAvatarEnter(e: MouseEvent) {
  const member = getMember(props.message.from);
  if (member) showHoverCard(member, e.currentTarget as HTMLElement);
}

function onAvatarLeave() { hideHoverCard(); }
function onCardEnter() { cancelHoverHide(); }
function onCardLeave() { hideHoverCard(); }

function handleKeydown(e: KeyboardEvent) {
  if (e.key === "Escape") forwardedDialogVisible.value = false;
}

watch(forwardedDialogVisible, (open) => {
  if (open) document.addEventListener("keydown", handleKeydown);
  else document.removeEventListener("keydown", handleKeydown);
});

onUnmounted(() => {
  document.removeEventListener("keydown", handleKeydown);
});

function bubbleContextmenu() {
  if (!props.selectMode && bubbleRef.value) emit('contextmenu', bubbleRef.value.getBoundingClientRect(), props.message);
}

function bubbleClick(e: MouseEvent) {
  if (!props.selectMode) onBubbleClick(e);
  else emit('toggleSelect', props.message.id);
}
</script>

<template>
  <!-- Channel: other's message -->
  <div v-if="isChannel && !message.mine" class="bubble-row channel-row" :data-id="message.id">
    <div v-if="selectMode" class="checkbox" :class="{ checked: selected }" @click.stop="emit('toggleSelect', message.id)">
      <SvgIcon v-if="selected" name="check" :size="14" />
    </div>
    <div class="channel-avatar" @mouseenter="onAvatarEnter" @mouseleave="onAvatarLeave">
      <img v-if="getAvatarUrl(message.from)" :src="getAvatarUrl(message.from)!" class="channel-avatar-img" />
      <template v-else>{{ getInitial(getDisplayName(message.from)) }}</template>
    </div>
    <div class="channel-body">
      <div class="channel-meta">
        <span class="channel-sender">{{ getDisplayName(message.from) }}</span>
        <span class="channel-time">{{ formatTime(message.timestamp) }}</span>
      </div>
      <div ref="bubbleRef" class="bubble channel-bubble" :class="{ selected: selected && selectMode, 'sticker-mode': isSticker }" @click="bubbleClick($event)" @contextmenu.prevent="bubbleContextmenu">
        <BubbleContent
          :text="message.text"
          :mentions="isChannel ? message.mentions : undefined"
          :member-ids="memberIds"
          :quote="quoteForContent"
          :is-quote-revoked="isQuoteRevoked"
          :forwarded="message.forwarded"
          :attachments="message.attachments"
          :is-sticker="isSticker"
          :sticker-url="stickerUrl"
          :sticker-name="message.sticker?.name"
          :cloud-refs="message.cloudRefs"
          :team-name="teamName"
          @scroll-to-quote="handleQuoteClick"
          @open-forwarded="forwardedDialogVisible = true"
        />
      </div>
    </div>
    <span v-if="message.source === 'ai-auto'" class="ai-badge-inline">{{ $t('chat.aiAutoReply') }}</span>
  </div>

  <!-- Channel: my message -->
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
        <div ref="bubbleRef" class="bubble mine channel-bubble" :class="{ selected: selected && selectMode, 'sticker-mode': isSticker }" @click="bubbleClick($event)" @contextmenu.prevent="bubbleContextmenu">
          <BubbleContent
            :text="message.text"
            :mentions="isChannel ? message.mentions : undefined"
            :member-ids="memberIds"
            :quote="quoteForContent"
            :is-quote-revoked="isQuoteRevoked"
            :forwarded="message.forwarded"
            :attachments="message.attachments"
            :is-sticker="isSticker"
            :sticker-url="stickerUrl"
            :sticker-name="message.sticker?.name"
            :cloud-refs="message.cloudRefs"
            :team-name="teamName"
            @scroll-to-quote="handleQuoteClick"
            @open-forwarded="forwardedDialogVisible = true"
          />
        </div>
        <div class="channel-avatar mine-avatar">
          <img v-if="getAvatarUrl(message.from)" :src="getAvatarUrl(message.from)!" class="channel-avatar-img" />
          <template v-else>{{ getInitial(getDisplayName(message.from)) }}</template>
        </div>
      </div>
    </div>
  </div>

  <!-- DM -->
  <template v-else>
  <div class="bubble-row" :class="{ mine: message.mine }" :data-id="message.id">
    <div v-if="selectMode" class="checkbox" :class="{ checked: selected }" @click.stop="emit('toggleSelect', message.id)">
      <SvgIcon v-if="selected" name="check" :size="14" />
    </div>
    <div ref="bubbleRef" class="bubble" :class="{ mine: message.mine, selected: selected && selectMode, 'sticker-mode': isSticker }" @click="bubbleClick($event)" @contextmenu.prevent="bubbleContextmenu">
      <BubbleContent
        :text="message.text"
        :mentions="isChannel ? message.mentions : undefined"
        :member-ids="memberIds"
        :quote="quoteForContent"
        :is-quote-revoked="isQuoteRevoked"
        :forwarded="message.forwarded"
        :attachments="message.attachments"
        :show-sender="showSender"
        :sender-name="showSender ? getDisplayName(message.from) : undefined"
        :is-sticker="isSticker"
        :sticker-url="stickerUrl"
        :sticker-name="message.sticker?.name"
        :cloud-refs="message.cloudRefs"
        :team-name="teamName"
        @scroll-to-quote="handleQuoteClick"
        @open-forwarded="forwardedDialogVisible = true"
      />
    </div>
  </div>
  <div class="time-row" :class="{ mine: message.mine }">
    <span v-if="message.source === 'ai-auto'" class="ai-badge">{{ $t('chat.aiAutoReply') }}</span>
    <span class="time">{{ formatTime(message.timestamp) }}</span>
  </div>
  </template>

  <!-- Forwarded history dialog -->
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
                  <div v-if="att.type === 'image'" class="image-card"><img :src="att.url" :alt="att.name" loading="lazy" /></div>
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
