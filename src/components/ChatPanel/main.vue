<script setup lang="ts">
import { inject, ref, nextTick, watch, computed, onMounted, onBeforeUnmount } from "vue";
import { useI18n } from "vue-i18n";
import { TeamClientKey, getMemberSettings } from "../../composables/teamClientContext";
import { useAI } from "../../composables/useAI";
import { useMessagePagination } from "../../composables/useMessagePagination";
import { useFileUpload } from "../../composables/useFileUpload";
import { useMentionSystem } from "../../composables/useMentionSystem";
import { useMultiSelect } from "../../composables/useMultiSelect";
import { useMessageContextMenu } from "../../composables/useMessageContextMenu";
import MessageBubble from "../MessageBubble";
import { useUserProfile } from "../../composables/useUserProfile";
import TaskCard from "../TaskCard";
import ConfirmDialog from "../ConfirmDialog";
import Toast from "../Toast";
import RichEditor from "../RichEditor";
import ForwardDialog from "../ForwardDialog";
import MentionPopup from "../MentionPopup";
import StickerPanel from "../StickerPanel";
import { useToast } from "../../composables/useToast";
import { useConfirm } from "../../composables/useConfirm";
import type { TimelineItem, ChatMessage, MessageAttachment, TaskMessage, QuoteInfo } from "../../types";
import { formatFileSize } from "../../utils/imageCompress";

const { t } = useI18n();
const { getDisplayName } = useUserProfile();

const props = defineProps<{ peerId: string }>();
const emit = defineEmits<{ selectTask: [task: TaskMessage] }>();

const ctx = inject(TeamClientKey)!;
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
const { pendingFiles, uploading, attachmentError, handlePickAttachment, removeFile, uploadImages, uploadPendingFiles } = useFileUpload(myId, teamName);
const { currentMentions, mentionPopupVisible, mentionQuery, mentionPopupRef, handleEditorInput, handleMentionSelect, handleMentionClose, handleEditorKeydown, clearMentions } = useMentionSystem(() => isChannel.value, () => members.value, richEditorRef);
const { selectMode, selectedIds, forwardDialogVisible, enterSelectMode, exitSelectMode, toggleMessageSelect, handleForwardClick, handleForwardConfirm } = useMultiSelect(conversation, sendChat, showToast);
const { contextMenuVisible, contextMenuX, contextMenuY, contextMenuMsg, quotingMsg, handleMessageContextmenu, handleQuoteReply, handleContextForward, clearQuotingMsg, generateSnapshotText, handleRevoke, handleScrollToQuote, closeContextMenu } = useMessageContextMenu(messageList, loadAll, revokeMessage, enterSelectMode, (ids) => { selectMode.value = true; selectedIds.value = ids; }, showToast);

// AI
const { suggestion, isStreaming, aiError, aiAvailable, suggestReply, acceptSuggestion, clearSuggestion } = useAI();
const { settings: memberSettings } = getMemberSettings();

watch(() => props.peerId, (newPeer) => { if (newPeer) markRead(newPeer); resetDisplayCount(); taskInputVisible.value = false; clearSuggestion(); });
watch(() => props.peerId, () => { nextTick(() => { if (messageList.value) messageList.value.scrollTop = messageList.value.scrollHeight; }); }, { flush: 'post', immediate: true });

async function handleRichSend(text: string, images: { blob: Blob; name: string }[]) {
  if (!props.peerId) return;
  if (!text && images.length === 0 && pendingFiles.value.length === 0) return;
  attachmentError.value = "";
  const attachments: MessageAttachment[] = [];

  if (images.length > 0) {
    uploading.value = true;
    try { attachments.push(...await uploadImages(images)); } catch (e: unknown) { attachmentError.value = t('chat.imgUploadFailed', { msg: e instanceof Error ? e.message : String(e) }); uploading.value = false; return; }
    uploading.value = false;
  }

  if (pendingFiles.value.length > 0) {
    uploading.value = true;
    try { attachments.push(...await uploadPendingFiles()); } catch (e: unknown) { attachmentError.value = t('chat.attUploadFailed', { msg: e instanceof Error ? e.message : String(e) }); uploading.value = false; return; }
    uploading.value = false;
  }

  const quoteInfo: QuoteInfo | undefined = quotingMsg.value ? { id: quotingMsg.value.id, from: quotingMsg.value.from, text: generateSnapshotText(quotingMsg.value), timestamp: quotingMsg.value.timestamp } : undefined;
  sendChat(props.peerId, text || " ", { attachments: attachments.length > 0 ? attachments : undefined, quote: quoteInfo, channel: isChannel.value ? "general" : undefined, mentions: isChannel.value ? currentMentions.value : undefined });
  clearMentions();
  if (quoteInfo) quotingMsg.value = null;
}

function handleClearChat() { menuOpen.value = false; showConfirm(t('chat.confirmClearTitle'), t('chat.confirmClearMsg', { peer: props.peerId }), () => { if (!props.peerId) return; clearConversation(props.peerId); showToast(t('chat.cleared', { peer: props.peerId }), "success"); }, true); }
function handleDispatchTask() { const c = taskContent.value.trim(); if (!c) return; dispatchTask([props.peerId], c); taskContent.value = ""; taskInputVisible.value = false; }
function handleAISuggest() { const chatMsgs = conversation.value.filter((m): m is ChatMessage => m.type === "chat"); suggestReply(chatMsgs.slice(-memberSettings.value.ai_suggestion_history_count), `当前团队：${teamName}；你的角色：${role}`); }
function handleAcceptSuggestion() { const text = acceptSuggestion(); if (text) sendChat(props.peerId, text); }
function handleForwardConfirmWrapper(targetId: string) { handleForwardConfirm(targetId, t('chat.chatHistory')); }

function handleStickerSend(stickerUrl: string, stickerName: string) {
  sendChat(props.peerId, " ", { sticker: { url: stickerUrl, name: stickerName } });
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
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
      <p>{{ $t('chat.selectPeer') }}</p>
    </div>

    <template v-else>
      <div class="header">
        <span class="header-name">{{ headerTitle }}</span>
        <span v-if="isChannel" class="header-subtitle">{{ members.length }} {{ t('chat.members') }}</span>
        <span v-else-if="peerStatus === 'offline'" class="header-status offline">{{ $t('chat.offline') }}</span>
        <div class="header-actions">
          <button class="btn-menu" @click="menuOpen = !menuOpen" :title="$t('chat.actions')">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>
          </button>
          <div v-if="menuOpen" class="dropdown" @click.stop>
            <button class="dropdown-item" @click="menuOpen = false; enterSelectMode()">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
              {{ $t('chat.multiSelect') }}
            </button>
            <button class="dropdown-item danger" @click="handleClearChat">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
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
          <MessageBubble v-else-if="item.type === 'chat'" :message="item" :my-id="myId" :show-sender="isChannel" :member-ids="isChannel ? memberIds : undefined" :is-channel="isChannel" :members="isChannel ? members : undefined" :select-mode="selectMode" :selected="selectedIds.has(item.id)" :timeline="conversation" @contextmenu="handleMessageContextmenu" @toggle-select="toggleMessageSelect" @scroll-to-quote="handleScrollToQuote" />
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
            <button class="btn-icon btn-confirm" @click="handleDispatchTask" :title="$t('chat.dispatchTask')" :disabled="!taskContent.trim()"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg></button>
            <button class="btn-icon btn-cancel" @click="taskInputVisible = false" :title="$t('common.cancel')"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg></button>
          </div>
        </div>

        <div v-if="pendingFiles.length > 0" class="attachment-preview">
          <div v-for="(att, i) in pendingFiles" :key="i" class="preview-item">
            <div class="preview-file-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg></div>
            <div class="preview-info"><span class="preview-name">{{ att.file.name }}</span><span class="preview-size">{{ formatFileSize(att.file.size) }}</span></div>
            <button class="preview-remove" @click="removeFile(i)"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
          </div>
        </div>
        <div v-if="attachmentError" class="attachment-error">{{ attachmentError }}</div>

        <div v-if="quotingMsg" class="quote-preview">
          <div class="quote-preview-content">
            <span class="quote-preview-sender">{{ getDisplayName(quotingMsg.from) }}</span>
            <span class="quote-preview-text">{{ generateSnapshotText(quotingMsg) }}</span>
          </div>
          <button class="quote-preview-close" @click="clearQuotingMsg"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
        </div>

        <StickerPanel v-if="stickerPanelVisible" :my-id="myId" :team-name="teamName" @send="handleStickerSend" />
        <div class="toolbar">
          <div class="toolbar-left">
            <button v-if="role === 'leader'" class="btn-tool" @click="taskInputVisible = !taskInputVisible" :title="$t('chat.dispatchTask')"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></svg></button>
            <button class="btn-tool" @click="handlePickAttachment((f: File) => richEditorRef?.insertImage(f))" :title="$t('chat.addAttachment')"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg></button>
            <button class="btn-tool" :class="{ active: stickerPanelVisible }" @click="stickerPanelVisible = !stickerPanelVisible" :title="$t('chat.sticker')"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg></button>
            <button class="btn-tool" @click="handleAISuggest" :title="$t('chat.aiSuggestReply')" :disabled="!aiAvailable || isStreaming"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg></button>
          </div>
          <button class="btn-send-toolbar" @click="richEditorRef?.send()" :title="$t('common.send')" :disabled="uploading">{{ $t('common.send') }}</button>
        </div>

        <div class="editor-wrapper" style="position: relative;">
          <MentionPopup v-if="isChannel" ref="mentionPopupRef" :visible="mentionPopupVisible" :members="members" :query="mentionQuery" :my-id="myId" @select="handleMentionSelect" @close="handleMentionClose" />
          <RichEditor ref="richEditorRef" @send="handleRichSend" @input="handleEditorInput" @keydown="handleEditorKeydown" />
        </div>
      </div>
    </template>

    <ConfirmDialog :visible="confirmVisible" :title="confirmTitle" :message="confirmMessage" :danger="confirmDanger" @confirm="handleConfirm" @cancel="handleCancel" />
    <Toast :visible="toastVisible" :message="toastMessage" :type="toastType" @done="hideToast" />
    <ForwardDialog :visible="forwardDialogVisible" :members="members" :current-peer-id="peerId" @confirm="handleForwardConfirmWrapper" @cancel="forwardDialogVisible = false" />

    <Teleport to="body">
      <div v-if="contextMenuVisible" class="context-menu" :style="{ left: contextMenuX + 'px', top: contextMenuY + 'px' }" @click.stop>
        <button class="context-menu-item" @click="handleQuoteReply(() => richEditorRef?.focus())">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 0 0-4-4H4"/></svg>
          {{ $t('chat.quote') }}
        </button>
        <button class="context-menu-item" @click="handleContextForward">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 3 21 3 21 9"/><path d="M21 3l-7 7"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>
          {{ $t('chat.forward') }}
        </button>
        <button v-if="contextMenuMsg?.mine" class="context-menu-item danger" @click="handleRevoke(peerId)">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 4H8l-7 8 7 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z"/><line x1="18" y1="9" x2="12" y2="15"/><line x1="12" y1="9" x2="18" y2="15"/></svg>
          {{ $t('chat.revoke') }}
        </button>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
@import './styles.css';
</style>
