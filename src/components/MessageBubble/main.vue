<script setup lang="ts">
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import { openUrl } from "@tauri-apps/plugin-opener";
import type { ChatMessage, MemberInfo, TimelineItem } from "../../types";
import { useUserProfile } from "../../composables/useUserProfile";
import { useHoverCard } from "../../composables/useHoverCard";
import { formatTime } from "../../utils/taskFormatters";
import BubbleContent from "../BubbleContent";
import AttachmentList from "../AttachmentList";
import CloudRefCard from "../CloudRefCard";
import CloudDirDialog from "../CloudDirDialog";
import ForwardedDialog from "../ForwardedDialog";
import MemberHoverCard from "../MemberHoverCard";
import QuoteCard from "../QuoteCard";
import StickerImage from "../StickerImage";
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
  isNew?: boolean;
}>();

const emit = defineEmits<{
  contextmenu: [rect: DOMRect, message: ChatMessage];
  toggleSelect: [id: string];
  "scroll-to-quote": [quoteId: string];
  "view-profile": [memberId: string];
}>();

const { t } = useI18n();
const { getDisplayName, getAvatarUrl, getInitial } = useUserProfile();
const { hoveredItem: hoverMember, hoverRect, visible: hoverVisible, show: showHoverCard, scheduleHide: hideHoverCard, cancelHide: cancelHoverHide } = useHoverCard<MemberInfo>();

const isSticker = computed(() => !!props.message.sticker);
const stickerUrl = computed(() => props.message.sticker?.url ?? "");
const noText = computed(() => !props.message.text?.trim());

const isFlatMode = computed(() => {
  if (isSticker.value) return false;
  if (props.message.attachments?.length && noText.value) return true;
  if (props.message.cloudRefs?.length) {
    const stripped = (props.message.text || "").replace(/\{cloud:\d+\}/g, "").trim();
    if (!stripped) return true;
  }
  return false;
});

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
const cloudDirDialogVisible = ref(false);
const cloudDirPath = ref("");
const cloudDirName = ref("");

function handleOpenDir(data: { path: string; name: string }) {
  cloudDirPath.value = data.path;
  cloudDirName.value = data.name;
  cloudDirDialogVisible.value = true;
}

function getMember(id: string): MemberInfo | null { return props.members?.find(m => m.id === id) ?? null; }

function onAvatarEnter(e: MouseEvent) {
  const member = getMember(props.message.from);
  if (member) showHoverCard(member, e.currentTarget as HTMLElement);
}

function onAvatarLeave() { hideHoverCard(); }
function onCardEnter() { cancelHoverHide(); }
function onCardLeave() { hideHoverCard(); }

function onViewProfile(memberId: string) {
  hideHoverCard();
  emit("view-profile", memberId);
}

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
  <div v-if="isChannel && !message.mine" class="bubble-row channel-row" :class="{ 'msg-pop-in': isNew }" :data-id="message.id">
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
      <div ref="bubbleRef" class="bubble channel-bubble" :class="{ selected: selected && selectMode, 'sticker-mode': isSticker, 'flat-mode': isFlatMode }" @click="bubbleClick($event)" @contextmenu.prevent="bubbleContextmenu">
        <StickerImage v-if="isSticker" :url="stickerUrl" :name="message.sticker?.name" />
        <template v-else>
          <BubbleContent v-if="!noText && !message.forwarded?.length" :text="message.text" :mentions="isChannel ? message.mentions : undefined" :member-ids="memberIds" />
          <CloudRefCard v-for="(ref, ri) in message.cloudRefs" :key="'cr'+ri" :data="ref" :team-name="teamName" @open-dir="handleOpenDir" />
          <div v-if="message.forwarded?.length" class="forwarded-summary" @click.stop="forwardedDialogVisible = true">
            <SvgIcon name="chat" :size="14" />
            <span>{{ t('chat.chatHistory') }} ({{ message.forwarded.length }})</span>
            <SvgIcon class="arrow" name="chevron-right" :size="12" />
          </div>
          <AttachmentList v-if="message.attachments?.length" :items="message.attachments" :no-text="noText && !message.forwarded?.length" />
        </template>
      </div>
      <QuoteCard v-if="quoteForContent" :from="quoteForContent.from" :text="quoteForContent.text" :revoked="isQuoteRevoked" @click="handleQuoteClick" />
    </div>
    <span v-if="message.source === 'ai-auto'" class="ai-badge-inline">{{ $t('chat.aiAutoReply') }}</span>
  </div>

  <!-- Channel: my message -->
  <div v-else-if="isChannel && message.mine" class="bubble-row channel-row mine" :class="{ 'msg-pop-in': isNew }" :data-id="message.id">
    <div v-if="selectMode" class="checkbox" :class="{ checked: selected }" @click.stop="emit('toggleSelect', message.id)">
      <SvgIcon v-if="selected" name="check" :size="14" />
    </div>
    <div class="channel-body mine">
      <div class="channel-meta mine">
        <span v-if="message.source === 'ai-auto'" class="ai-badge-inline">{{ $t('chat.aiAutoReply') }}</span>
        <span class="channel-time">{{ formatTime(message.timestamp) }}</span>
      </div>
      <div class="channel-msg-row mine">
        <div ref="bubbleRef" class="bubble mine channel-bubble" :class="{ selected: selected && selectMode, 'sticker-mode': isSticker, 'flat-mode': isFlatMode }" @click="bubbleClick($event)" @contextmenu.prevent="bubbleContextmenu">
          <StickerImage v-if="isSticker" :url="stickerUrl" :name="message.sticker?.name" />
          <template v-else>
            <BubbleContent v-if="!noText && !message.forwarded?.length" :text="message.text" :mentions="isChannel ? message.mentions : undefined" :member-ids="memberIds" />
            <CloudRefCard v-for="(ref, ri) in message.cloudRefs" :key="'cr'+ri" :data="ref" :team-name="teamName" @open-dir="handleOpenDir" />
            <div v-if="message.forwarded?.length" class="forwarded-summary" @click.stop="forwardedDialogVisible = true">
              <SvgIcon name="chat" :size="14" />
              <span>{{ t('chat.chatHistory') }} ({{ message.forwarded.length }})</span>
              <SvgIcon class="arrow" name="chevron-right" :size="12" />
            </div>
            <AttachmentList v-if="message.attachments?.length" :items="message.attachments" :no-text="noText && !message.forwarded?.length" />
          </template>
        </div>
        <div class="channel-avatar mine-avatar">
          <img v-if="getAvatarUrl(message.from)" :src="getAvatarUrl(message.from)!" class="channel-avatar-img" />
          <template v-else>{{ getInitial(getDisplayName(message.from)) }}</template>
        </div>
      </div>
      <QuoteCard v-if="quoteForContent" :from="quoteForContent.from" :text="quoteForContent.text" :revoked="isQuoteRevoked" @click="handleQuoteClick" />
    </div>
  </div>

  <!-- DM -->
  <template v-else>
  <div class="bubble-row" :class="{ mine: message.mine, 'msg-pop-in': isNew }" :data-id="message.id">
    <div v-if="selectMode" class="checkbox" :class="{ checked: selected }" @click.stop="emit('toggleSelect', message.id)">
      <SvgIcon v-if="selected" name="check" :size="14" />
    </div>
    <div ref="bubbleRef" class="bubble" :class="{ mine: message.mine, selected: selected && selectMode, 'sticker-mode': isSticker, 'flat-mode': isFlatMode }" @click="bubbleClick($event)" @contextmenu.prevent="bubbleContextmenu">
      <StickerImage v-if="isSticker" :url="stickerUrl" :name="message.sticker?.name" />
      <template v-else>
        <BubbleContent v-if="!noText && !message.forwarded?.length" :text="message.text" :mentions="isChannel ? message.mentions : undefined" :member-ids="memberIds" :show-sender="showSender" :sender-name="showSender ? getDisplayName(message.from) : undefined" />
        <CloudRefCard v-for="(ref, ri) in message.cloudRefs" :key="'cr'+ri" :data="ref" :team-name="teamName" @open-dir="handleOpenDir" />
        <div v-if="message.forwarded?.length" class="forwarded-summary" @click.stop="forwardedDialogVisible = true">
          <SvgIcon name="chat" :size="14" />
          <span>{{ t('chat.chatHistory') }} ({{ message.forwarded.length }})</span>
          <SvgIcon class="arrow" name="chevron-right" :size="12" />
        </div>
        <AttachmentList v-if="message.attachments?.length" :items="message.attachments" :no-text="noText && !message.forwarded?.length" />
      </template>
    </div>
  </div>
  <div v-if="quoteForContent" class="quote-row" :class="{ mine: message.mine }">
    <QuoteCard :from="quoteForContent.from" :text="quoteForContent.text" :revoked="isQuoteRevoked" @click="handleQuoteClick" />
  </div>
  <div class="time-row" :class="{ mine: message.mine }">
    <span v-if="message.source === 'ai-auto'" class="ai-badge">{{ $t('chat.aiAutoReply') }}</span>
    <span class="time">{{ formatTime(message.timestamp) }}</span>
  </div>
  </template>

  <!-- Forwarded history dialog -->
  <ForwardedDialog v-if="message.forwarded?.length" :records="message.forwarded" :team-name="teamName" v-model:visible="forwardedDialogVisible" />

  <CloudDirDialog :visible="cloudDirDialogVisible" :dir-path="cloudDirPath" :dir-name="cloudDirName" :team-name="teamName" @update:visible="cloudDirDialogVisible = $event" />

  <MemberHoverCard v-if="hoverMember" :member="hoverMember" :rect="hoverRect" :visible="hoverVisible" @mouseenter="onCardEnter" @mouseleave="onCardLeave" @view-profile="onViewProfile" />
</template>

<style scoped>
@import './styles.css';
</style>
