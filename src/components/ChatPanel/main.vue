<script setup lang="ts">
import { ref, nextTick, watch, computed, onMounted, onBeforeUnmount } from "vue";
import { useI18n } from "vue-i18n";
import { getTeamClientInstance, getMemberSettings, getMessageService } from "../../composables/teamClientContext";
import { useAIChat as useAI } from "../../composables/useAIChat";
import { useMessagePagination } from "../../composables/useMessagePagination";
import { useFileUpload } from "../../composables/useFileUpload";
import { useMentionSystem } from "../../composables/useMentionSystem";
import { useCloudMention } from "../../composables/useCloudMention";
import { useMultiSelect } from "../../composables/useMultiSelect";
import { useMessageContextMenu } from "../../composables/useMessageContextMenu";
import { getErrorMessage } from "../../utils/error";
import MessageBubble from "../MessageBubble";
import { useUserProfile } from "../../composables/useUserProfile";
import TaskCard from "../TaskCard";
import ConfirmDialog from "../ConfirmDialog";
import Toast from "../Toast";
import RichEditor from "../RichEditor";
import ForwardDialog from "../ForwardDialog";
import MentionPopup from "../MentionPopup";
import CloudMentionPopup from "../CloudMentionPopup";
import StickerPanel from "../StickerPanel";
import { useToast } from "../../composables/useToast";
import { useConfirm } from "../../composables/useConfirm";
import SvgIcon from "../SvgIcon";
import type { TimelineItem, ChatMessage, TaskMessage, QuoteInfo, ContentSegment } from "../../types";
import { formatFileSize } from "../../utils/taskFormatters";

const { t } = useI18n();
const { getDisplayName } = useUserProfile();

const props = defineProps<{ peerId: string }>();
const emit = defineEmits<{ selectTask: [task: TaskMessage] }>();

const ctx = getTeamClientInstance()!;
const { getConversation, sendChat, dispatchTask, role, myId, markRead, members, teamName, clearConversation, revokeMessage } = ctx;

const isChannel = computed(() => props.peerId === "__team__");
const memberIds = computed(() => members.value.map(m => m.id));
const headerTitle = computed(() => isChannel.value ? `# ${t('sidebar.channelGeneral')}` : getDisplayName(props.peerId));
const peerStatus = computed(() => { if (isChannel.value) return undefined; return members.value.find(m => m.id === props.peerId)?.status; });

const taskInputVisible = ref(false);
const taskContent = ref("");
const messageList = ref<HTMLDivElement | null>(null);
const menuOpen = ref(false);
const richEditorRef = ref<InstanceType<typeof RichEditor> | null>(null);
const stickerPanelVisible = ref(false);

const { toastVisible, toastMessage, toastType, showToast, hideToast } = useToast();
const { confirmVisible, confirmTitle, confirmMessage, confirmDanger, showConfirm, handleConfirm, handleCancel } = useConfirm();

const conversation = computed<TimelineItem[]>(() => props.peerId ? getConversation(props.peerId) : []);
const { visibleMessages, hasMoreHistory, loadingMore, handleScroll, resetDisplayCount, loadAll } = useMessagePagination(conversation, messageList);
const { pendingFiles, uploading, attachmentError, handlePickAttachment, removeFile, uploadImages } = useFileUpload(myId, teamName);
const { currentMentions, mentionPopupVisible, mentionQuery, mentionPopupRef, handleEditorInput, handleMentionSelect, handleMentionClose, handleEditorKeydown, clearMentions } = useMentionSystem(() => isChannel.value, () => members.value, richEditorRef);
const { cloudPopupVisible, cloudQuery, cloudPopupRef, handleEditorInput: handleCloudEditorInput, handleCloudSelect, handleCloudClose, handleCloudKeydown, clearCloudRefs, pendingCloudRefs, removeCloudRef } = useCloudMention();
const { selectMode, selectedIds, forwardDialogVisible, enterSelectMode, exitSelectMode, toggleMessageSelect, handleForwardClick, handleForwardConfirm } = useMultiSelect(conversation, sendChat, showToast);
const { contextMenuVisible, contextMenuX, contextMenuY, contextMenuMsg, quotingMsg, handleMessageContextmenu, handleQuoteReply, handleContextForward, clearQuotingMsg, generateSnapshotText, handleRevoke, handleScrollToQuote, closeContextMenu, handleCopy, canCopyMessage } = useMessageContextMenu(messageList, loadAll, revokeMessage, enterSelectMode, (ids) => { selectMode.value = true; selectedIds.value = ids; }, showToast);

// AI
const { suggestion, isStreaming, aiError, aiAvailable, suggestReply, acceptSuggestion, clearSuggestion } = useAI();
const { settings: memberSettings } = getMemberSettings();

watch(() => props.peerId, (newPeer) => { if (newPeer) markRead(newPeer); resetDisplayCountWithConv(); taskInputVisible.value = false; clearSuggestion(); });
watch(() => props.peerId, () => { nextTick(() => { if (messageList.value) messageList.value.scrollTop = messageList.value.scrollHeight; }); }, { flush: 'post', immediate: true });

// Track new messages for animation
const newMessageIds = ref<Set<string>>(new Set());
let prevConvLength = 0;

watch(
  () => conversation.value.length,
  async (newLen) => {
    await nextTick();
    if (newLen > prevConvLength) {
      const added = newLen - prevConvLength;
      const ids = new Set<string>();
      for (let i = newLen - added; i < newLen; i++) {
        ids.add(conversation.value[i].id);
      }
      newMessageIds.value = ids;
      setTimeout(() => { newMessageIds.value = new Set(); }, 700);
    }
    prevConvLength = newLen;
    // Scroll to bottom on new message
    if (messageList.value) {
      messageList.value.scrollTop = messageList.value.scrollHeight;
    }
  },
  { flush: 'post' }
);

function resetDisplayCountWithConv() {
  resetDisplayCount();
  prevConvLength = conversation.value.length;
  newMessageIds.value = new Set();
}

async function handleSegmentedSend(segments: ContentSegment[]) {
  if (!props.peerId) return;
  if (segments.length === 0 && pendingFiles.value.length === 0 && pendingCloudRefs.value.length === 0) return;
  attachmentError.value = "";

  const quoteInfo: QuoteInfo | undefined = quotingMsg.value
    ? { id: quotingMsg.value.id, from: quotingMsg.value.from, text: generateSnapshotText(quotingMsg.value), timestamp: quotingMsg.value.timestamp }
    : undefined;

  let isFirst = true;

  for (const seg of segments) {
    try {
      if (seg.type === "text") {
        const mentions = isChannel.value ? extractMentionsForText(seg.content) : undefined;
        await sendChat(props.peerId, seg.content || " ", {
          quote: isFirst ? quoteInfo : undefined,
          channel: isChannel.value ? "general" : undefined,
          mentions,
        });
      } else if (seg.type === "image") {
        uploading.value = true;
        const [uploaded] = await uploadImages([seg]);
        uploading.value = false;
        await sendChat(props.peerId, " ", {
          attachments: [uploaded],
          quote: isFirst ? quoteInfo : undefined,
          channel: isChannel.value ? "general" : undefined,
        });
      }
      isFirst = false;
    } catch (e: unknown) {
      attachmentError.value = getErrorMessage(e);
      uploading.value = false;
      break;
    }
  }

  for (const ref of pendingCloudRefs.value) {
    try {
      await sendChat(props.peerId, "{cloud:0}", {
        cloudRefs: [ref],
        quote: isFirst ? quoteInfo : undefined,
        channel: isChannel.value ? "general" : undefined,
      });
      isFirst = false;
    } catch (e: unknown) {
      attachmentError.value = getErrorMessage(e);
      break;
    }
  }

  for (const att of pendingFiles.value) {
    try {
      uploading.value = true;
      const data = await getMessageService().uploadAttachment(att.file);
      uploading.value = false;
      await sendChat(props.peerId, " ", {
        attachments: [data],
        channel: isChannel.value ? "general" : undefined,
      });
    } catch (e: unknown) {
      attachmentError.value = getErrorMessage(e);
      uploading.value = false;
      break;
    }
  }

  clearMentions();
  clearCloudRefs();
  pendingFiles.value = [];
  if (quoteInfo) quotingMsg.value = null;
}

function extractMentionsForText(text: string): string[] | undefined {
  if (!currentMentions.value.length) return undefined;
  const matched = currentMentions.value.filter((id) => text.includes(`@${id}`));
  return matched.length > 0 ? matched : undefined;
}

function handleClearChat() { menuOpen.value = false; showConfirm(t('chat.confirmClearTitle'), t('chat.confirmClearMsg', { peer: props.peerId }), () => { if (!props.peerId) return; clearConversation(props.peerId); showToast(t('chat.cleared', { peer: props.peerId }), "success"); }, true); }
function handleDispatchTask() { const c = taskContent.value.trim(); if (!c) return; dispatchTask([props.peerId], c); taskContent.value = ""; taskInputVisible.value = false; }
function handleAISuggest() { const chatMsgs = conversation.value.filter((m): m is ChatMessage => m.type === "chat"); suggestReply(chatMsgs.slice(-memberSettings.value.ai_suggestion_history_count), `当前团队：${teamName}；你的角色：${role}`); }
function handleAcceptSuggestion() { const text = acceptSuggestion(); if (text) sendChat(props.peerId, text); }
function handleForwardConfirmWrapper(targetId: string) { handleForwardConfirm(targetId, t('chat.chatHistory')); }

function handleStickerSend(stickerUrl: string, stickerName: string) {
  sendChat(props.peerId, " ", { sticker: { url: stickerUrl, name: stickerName }, channel: isChannel.value ? "general" : undefined });
  stickerPanelVisible.value = false;
}

function closeMenuOnClickOutside(e: MouseEvent) { if (!(e.target as HTMLElement).closest(".header-actions")) menuOpen.value = false; if (stickerPanelVisible.value && !(e.target as HTMLElement).closest(".input-area")) stickerPanelVisible.value = false; }
function handleSelectModeKeydown(e: KeyboardEvent) { if (e.key === "Escape") { if (selectMode.value) exitSelectMode(); else if (quotingMsg.value) quotingMsg.value = null; } }

onMounted(() => { document.addEventListener("click", closeMenuOnClickOutside); document.addEventListener("click", closeContextMenu); document.addEventListener("keydown", handleSelectModeKeydown); });
onBeforeUnmount(() => { document.removeEventListener("click", closeMenuOnClickOutside); document.removeEventListener("click", closeContextMenu); document.removeEventListener("keydown", handleSelectModeKeydown); });
</script>

<template>
  <div class="chat-panel">
    <div v-if="!peerId" class="empty-state">
      <SvgIcon name="chat" :size="48" />
      <p>{{ $t('chat.selectPeer') }}</p>
    </div>

    <template v-else>
      <div class="header">
        <span class="header-name">{{ headerTitle }}</span>
        <span v-if="isChannel" class="header-subtitle">{{ members.length }} {{ t('chat.members') }}</span>
        <span v-else-if="peerStatus === 'offline'" class="header-status offline">{{ $t('chat.offline') }}</span>
        <div class="header-actions">
          <button class="btn-menu" @click="menuOpen = !menuOpen" :title="$t('chat.actions')">
            <SvgIcon name="more-vertical" :size="16" />
          </button>
          <div v-if="menuOpen" class="dropdown" @click.stop>
            <button class="dropdown-item" @click="menuOpen = false; enterSelectMode()">
              <SvgIcon name="check-square" :size="14" />
              {{ $t('chat.multiSelect') }}
            </button>
            <button class="dropdown-item danger" @click="handleClearChat">
              <SvgIcon name="trash" :size="14" />
              {{ $t('chat.clearHistory') }}
            </button>
          </div>
        </div>
      </div>

      <div ref="messageList" class="messages" @scroll="handleScroll">
        <div v-if="loadingMore" class="loading-more"><span class="spinner-small"></span> {{ $t('common.loading') }}</div>
        <div v-else-if="hasMoreHistory" class="load-hint">{{ $t('chat.loadMore') }}</div>
        <template v-for="item in visibleMessages" :key="item.id">
          <div v-if="item.type === 'revoked'" class="revoked-notice">{{ $t('chat.revokedNotice', { from: item.from }) }}</div>
          <MessageBubble v-else-if="item.type === 'chat'" :message="item" :my-id="myId" :show-sender="isChannel" :member-ids="isChannel ? memberIds : undefined" :is-channel="isChannel" :members="isChannel ? members : undefined" :select-mode="selectMode" :selected="selectedIds.has(item.id)" :timeline="conversation" :team-name="teamName" :is-new="newMessageIds.has(item.id)" @contextmenu="handleMessageContextmenu" @toggle-select="toggleMessageSelect" @scroll-to-quote="handleScrollToQuote" />
          <TaskCard v-else :task="item" :team-name="teamName" :my-id="myId" @select-task="emit('selectTask', $event)" />
        </template>

        <div v-if="suggestion || isStreaming || aiError" class="ai-suggestion">
          <div class="ai-suggestion-label">{{ $t('chat.aiSuggestion') }}</div>
          <div class="ai-suggestion-text">{{ suggestion }}<span v-if="isStreaming" class="ai-cursor"></span></div>
          <div v-if="aiError" class="ai-error-inline">{{ aiError }}</div>
          <div v-if="!isStreaming && (suggestion || aiError)" class="ai-suggestion-actions">
            <button v-if="suggestion" class="btn-ai-accept" @click="handleAcceptSuggestion">{{ $t('chat.accept') }}</button>
            <button class="btn-ai-retry" @click="handleAISuggest">{{ $t('chat.retry') }}</button>
            <button class="btn-ai-dismiss" @click="clearSuggestion">{{ $t('chat.dismiss') }}</button>
          </div>
        </div>
      </div>

      <div v-if="selectMode" class="select-bar">
        <span class="select-count">{{ $t('chat.selectedCount', { count: selectedIds.size }) }}</span>
        <div class="select-actions">
          <button class="btn-select-cancel" @click="exitSelectMode">{{ t('common.cancel') }}</button>
          <button class="btn-select-forward" @click="handleForwardClick" :disabled="selectedIds.size === 0">{{ t('chat.forward') }}</button>
        </div>
      </div>

      <div v-if="!selectMode" class="input-area">
        <div v-if="taskInputVisible && role === 'leader'" class="task-input-wrapper">
          <div class="task-input">
            <input v-model="taskContent" :placeholder="$t('chat.enterTask')" @keydown.enter="handleDispatchTask" />
            <button class="btn-icon btn-confirm" @click="handleDispatchTask" :title="$t('chat.dispatchTask')" :disabled="!taskContent.trim()"><SvgIcon name="lightning" :size="18" /></button>
            <button class="btn-icon btn-cancel" @click="taskInputVisible = false" :title="$t('common.cancel')"><SvgIcon name="close" :size="18" /></button>
          </div>
        </div>

        <div v-if="pendingFiles.length > 0" class="attachment-preview">
          <div v-for="(att, i) in pendingFiles" :key="i" class="preview-item">
            <div class="preview-file-icon"><SvgIcon name="file" :size="16" /></div>
            <div class="preview-info"><span class="preview-name">{{ att.file.name }}</span><span class="preview-size">{{ formatFileSize(att.file.size) }}</span></div>
            <button class="preview-remove" @click="removeFile(i)"><SvgIcon name="close" :size="12" /></button>
          </div>
        </div>

        <div v-if="pendingCloudRefs.length > 0" class="cloud-ref-preview">
          <div v-for="(ref, i) in pendingCloudRefs" :key="i" class="preview-item">
            <div class="preview-file-icon"><SvgIcon :name="ref.type === 'directory' ? 'folder' : 'file'" :size="16" /></div>
            <div class="preview-info"><span class="preview-name">{{ ref.name }}</span><span class="preview-size">{{ ref.type === 'file' ? formatFileSize(ref.size) : ref.type }}</span></div>
            <button class="preview-remove" @click="removeCloudRef(i)"><SvgIcon name="close" :size="12" /></button>
          </div>
        </div>
        <div v-if="attachmentError" class="attachment-error">{{ attachmentError }}</div>

        <div v-if="quotingMsg" class="quote-preview">
          <div class="quote-preview-content">
            <span class="quote-preview-sender">{{ getDisplayName(quotingMsg.from) }}</span>
            <span class="quote-preview-text">{{ generateSnapshotText(quotingMsg) }}</span>
          </div>
          <button class="quote-preview-close" @click="clearQuotingMsg"><SvgIcon name="close" :size="14" /></button>
        </div>

        <StickerPanel v-if="stickerPanelVisible" :my-id="myId" :team-name="teamName" @send="handleStickerSend" />
        <div class="toolbar">
          <div class="toolbar-left">
            <button v-if="role === 'leader'" class="btn-tool" @click="taskInputVisible = !taskInputVisible" :title="$t('chat.dispatchTask')"><SvgIcon name="check-circle" :size="18" /></button>
            <button class="btn-tool" @click="handlePickAttachment((f: File) => richEditorRef?.insertImage(f))" :title="$t('chat.addAttachment')"><SvgIcon name="paperclip" :size="18" /></button>
            <button class="btn-tool" :class="{ active: stickerPanelVisible }" @click="stickerPanelVisible = !stickerPanelVisible" :title="$t('chat.sticker')"><SvgIcon name="smile" :size="18" /></button>
            <button class="btn-tool" @click="handleAISuggest" :title="$t('chat.aiSuggestReply')" :disabled="!aiAvailable || isStreaming"><SvgIcon name="lightning" :size="18" /></button>
          </div>
          <button class="btn-send-toolbar" @click="richEditorRef?.send()" :title="$t('common.send')" :disabled="uploading">{{ $t('common.send') }}</button>
        </div>

        <div class="editor-wrapper" style="position: relative;">
          <MentionPopup v-if="isChannel" ref="mentionPopupRef" :visible="mentionPopupVisible" :members="members" :query="mentionQuery" :my-id="myId" @select="handleMentionSelect" @close="handleMentionClose" />
          <CloudMentionPopup ref="cloudPopupRef" :visible="cloudPopupVisible" :query="cloudQuery" :team-name="teamName" @select="(item: any) => handleCloudSelect(item, richEditorRef?.editor)" @close="handleCloudClose" />
          <RichEditor ref="richEditorRef" :enterSendDisabled="mentionPopupVisible || cloudPopupVisible" @send="handleSegmentedSend" @input="handleEditorInput(); handleCloudEditorInput(richEditorRef?.editor)" @keydown="handleEditorKeydown($event); handleCloudKeydown($event)" />
        </div>
      </div>
    </template>

    <ConfirmDialog :visible="confirmVisible" :title="confirmTitle" :message="confirmMessage" :danger="confirmDanger" @confirm="handleConfirm" @cancel="handleCancel" />
    <Toast :visible="toastVisible" :message="toastMessage" :type="toastType" @done="hideToast" />
    <ForwardDialog :visible="forwardDialogVisible" :members="members" :current-peer-id="peerId" @confirm="handleForwardConfirmWrapper" @cancel="forwardDialogVisible = false" />

    <Teleport to="body">
      <div v-if="contextMenuVisible" class="context-menu" :style="{ left: contextMenuX + 'px', top: contextMenuY + 'px' }" @click.stop>
        <button class="context-menu-item" @click="handleQuoteReply(() => richEditorRef?.focus())">
          <SvgIcon name="reply" :size="14" />
          {{ $t('chat.quote') }}
        </button>
        <button class="context-menu-item" @click="handleContextForward">
          <SvgIcon name="forward" :size="14" />
          {{ $t('chat.forward') }}
        </button>
        <button v-if="contextMenuMsg && canCopyMessage(contextMenuMsg)" class="context-menu-item" @click="handleCopy">
          <SvgIcon name="copy" :size="14" />
          {{ $t('chat.copy') }}
        </button>
        <button v-if="contextMenuMsg?.mine" class="context-menu-item danger" @click="handleRevoke(peerId)">
          <SvgIcon name="delete-back" :size="14" />
          {{ $t('chat.revoke') }}
        </button>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
@import './styles.css';
</style>
