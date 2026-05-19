<script setup lang="ts">
import { inject, ref, nextTick, watch, computed, onMounted, onBeforeUnmount } from "vue";
import { useI18n } from "vue-i18n";
import { TeamClientKey, getMemberSettings } from "../composables/teamClientContext";
import { useAI } from "../composables/useAI";
import MessageBubble from "./MessageBubble.vue";
import { useUserProfile } from "../composables/useUserProfile";
import TaskCard from "./TaskCard.vue";
import ConfirmDialog from "./ConfirmDialog.vue";
import Toast from "./Toast.vue";
import RichEditor from "./RichEditor.vue";
import ForwardDialog from "./ForwardDialog.vue";
import MentionPopup from "./MentionPopup.vue";
import type { TimelineItem, ChatMessage, MessageAttachment, TaskMessage, ForwardedRecord, QuoteInfo } from "../types";
import { isImageMime, formatFileSize, compressImage } from "../utils/imageCompress";
import { apiUrl } from "../api";

const { t } = useI18n();
const { getDisplayName } = useUserProfile();

const props = defineProps<{ peerId: string }>();

const emit = defineEmits<{
  selectTask: [task: TaskMessage];
}>();

const ctx = inject(TeamClientKey)!;
const { getConversation, sendChat, dispatchTask, role, myId, markRead, members, teamName, clearConversation, revokeMessage } = ctx;

const isChannel = computed(() => props.peerId === "__team__");
const memberIds = computed(() => members.value.map(m => m.id));

const headerTitle = computed(() => {
  if (isChannel.value) return "# General";
  return getDisplayName(props.peerId);
});

const peerStatus = computed(() => {
  if (isChannel.value) return undefined;
  const m = members.value.find((m) => m.id === props.peerId);
  return m?.status;
});

const taskInputVisible = ref(false);
const taskContent = ref("");
const messageList = ref<HTMLDivElement | null>(null);
const menuOpen = ref(false);
const confirmVisible = ref(false);

// @mention state for channel mode
const currentMentions = ref<string[]>([]);
const mentionPopupVisible = ref(false);
const mentionQuery = ref("");
const mentionPopupRef = ref<InstanceType<typeof MentionPopup> | null>(null);

function handleEditorInput() {
  if (!isChannel.value) return;
  const editor = richEditorRef.value?.editor;
  if (!editor) return;
  const text = editor.getText();
  const cursorPos = editor.state.selection.from;
  const textBefore = text.substring(0, Math.min(cursorPos, text.length));
  const atMatch = textBefore.match(/@(\w*)$/);
  if (atMatch) {
    mentionQuery.value = atMatch[1] ?? "";
    mentionPopupVisible.value = true;
  } else {
    mentionPopupVisible.value = false;
  }
}

function handleMentionSelect(memberId: string) {
  const editor = richEditorRef.value?.editor;
  if (!editor) return;
  const text = editor.getText();
  const cursorPos = editor.state.selection.from;
  const textBefore = text.substring(0, Math.min(cursorPos, text.length));
  const atMatch = textBefore.match(/@(\w*)$/);
  if (atMatch) {
    const from = cursorPos - (atMatch[0]?.length ?? 0);
    editor.chain().focus().deleteRange({ from, to: cursorPos }).insertContent(`@${memberId} `).run();
  }
  if (!currentMentions.value.includes(memberId)) {
    currentMentions.value.push(memberId);
  }
  mentionPopupVisible.value = false;
}

function handleMentionClose() {
  mentionPopupVisible.value = false;
}

function handleEditorKeydown(e: KeyboardEvent) {
  if (mentionPopupVisible.value) {
    const handled = ["ArrowDown", "ArrowUp", "Enter", "Tab", "Escape"];
    if (handled.includes(e.key)) {
      e.preventDefault();
      e.stopPropagation();
    }
    mentionPopupRef.value?.handleKeydown(e);
  }
}
const toastVisible = ref(false);
const toastMessage = ref("");
const richEditorRef = ref<InstanceType<typeof RichEditor> | null>(null);

// Non-image file attachments (handled separately from inline images)
interface PendingFileAttachment {
  file: File;
}

const pendingFiles = ref<PendingFileAttachment[]>([]);
const uploading = ref(false);
const attachmentError = ref("");

const PAGE_SIZE = 50;
const displayCount = ref(PAGE_SIZE);
const loadingMore = ref(false);

const conversation = computed<TimelineItem[]>(() => {
  if (!props.peerId) return [];
  return getConversation(props.peerId);
});

const visibleMessages = computed<TimelineItem[]>(() => {
  return conversation.value.slice(-displayCount.value);
});

const hasMoreHistory = computed(() => {
  return displayCount.value < conversation.value.length;
});

function isNearBottom(el: HTMLElement, threshold = 100): boolean {
  return el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
}

watch(
  () => conversation.value.length,
  async () => {
    await nextTick();
    if (messageList.value && isNearBottom(messageList.value)) {
      messageList.value.scrollTop = messageList.value.scrollHeight;
    }
  }
);

function handleScroll() {
  const el = messageList.value;
  if (!el) return;

  if (el.scrollTop < 50 && hasMoreHistory.value && !loadingMore.value) {
    const prevScrollHeight = el.scrollHeight;
    loadingMore.value = true;
    displayCount.value += PAGE_SIZE;
    nextTick(() => {
      if (messageList.value) {
        messageList.value.scrollTop = messageList.value.scrollHeight - prevScrollHeight;
      }
      loadingMore.value = false;
    });
  }
}

// AI
const {
  suggestion,
  isStreaming,
  aiError,
  aiAvailable,
  suggestReply,
  acceptSuggestion,
  clearSuggestion,
} = useAI();

watch(
  () => props.peerId,
  (newPeer) => {
    if (newPeer) markRead(newPeer);
    displayCount.value = PAGE_SIZE;
    taskInputVisible.value = false;
    clearSuggestion();
  }
);

watch(
  () => props.peerId,
  () => {
    nextTick(() => {
      if (messageList.value) {
        messageList.value.scrollTop = messageList.value.scrollHeight;
      }
    });
  },
  { flush: 'post', immediate: true }
);

function handlePickAttachment() {
  const input = document.createElement("input");
  input.type = "file";
  input.multiple = true;
  input.onchange = async () => {
    const files = Array.from(input.files ?? []);
    for (const file of files) {
      if (file.type.startsWith("image/")) {
        richEditorRef.value?.insertImage(file);
      } else {
        pendingFiles.value.push({ file });
      }
    }
  };
  input.click();
}

function removeFile(index: number) {
  pendingFiles.value.splice(index, 1);
}

async function handleRichSend(text: string, images: { blob: Blob; name: string }[]) {
  if (!props.peerId) return;
  if (!text && images.length === 0 && pendingFiles.value.length === 0) return;

  attachmentError.value = "";

  const attachments: MessageAttachment[] = [];

  // Upload inline images from editor
  if (images.length > 0) {
    uploading.value = true;
    try {
      for (const img of images) {
        let blobToSend: Blob = img.blob;
        if (isImageMime(img.blob.type)) {
          const result = await compressImage(img.blob instanceof File ? img.blob : new File([img.blob], img.name));
          blobToSend = result.blob;
        }

        const formData = new FormData();
        formData.append("file", blobToSend, img.name);
        formData.append("from", myId);

        const res = await fetch(apiUrl("/api/messages/attachments"), {
          method: "POST",
          headers: { team: teamName },
          body: formData,
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: t('common.uploadFailed') }));
          throw new Error(err.error ?? t('common.uploadFailed'));
        }

        const data = await res.json() as MessageAttachment;
        data.url = apiUrl(data.url);
        attachments.push(data);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      attachmentError.value = t('chat.imgUploadFailed', { msg });
      uploading.value = false;
      return;
    }
    uploading.value = false;
  }

  // Upload non-image file attachments
  if (pendingFiles.value.length > 0) {
    uploading.value = true;
    try {
      for (const att of pendingFiles.value) {
        const formData = new FormData();
        formData.append("file", att.file, att.file.name);
        formData.append("from", myId);

        const res = await fetch(apiUrl("/api/messages/attachments"), {
          method: "POST",
          headers: { team: teamName },
          body: formData,
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: t('common.uploadFailed') }));
          throw new Error(err.error ?? t('common.uploadFailed'));
        }

        const data = await res.json() as MessageAttachment;
        data.url = apiUrl(data.url);
        attachments.push(data);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      attachmentError.value = t('chat.attUploadFailed', { msg });
      uploading.value = false;
      return;
    }
    uploading.value = false;

    pendingFiles.value = [];
  }

  const quoteInfo: QuoteInfo | undefined = quotingMsg.value
    ? { id: quotingMsg.value.id, from: quotingMsg.value.from, text: generateSnapshotText(quotingMsg.value), timestamp: quotingMsg.value.timestamp }
    : undefined;

  sendChat(props.peerId, text || " ", { attachments: attachments.length > 0 ? attachments : undefined, quote: quoteInfo, channel: isChannel.value ? "general" : undefined, mentions: isChannel.value ? currentMentions.value : undefined });

  currentMentions.value = [];
  mentionPopupVisible.value = false;
  if (quoteInfo) quotingMsg.value = null;
}

function handleClearChat() {
  menuOpen.value = false;
  confirmVisible.value = true;
}

function handleConfirmClear() {
  confirmVisible.value = false;
  if (!props.peerId) return;
  clearConversation(props.peerId);
  toastMessage.value = t('chat.cleared', { peer: props.peerId });
  toastVisible.value = true;
}

function handleCancelClear() {
  confirmVisible.value = false;
}

// AI dispatch: directly dispatch to current peer
function handleDispatchTask() {
  const content = taskContent.value.trim();
  if (!content) return;
  dispatchTask([props.peerId], content);
  taskContent.value = "";
  taskInputVisible.value = false;
}

const { settings: memberSettings } = getMemberSettings();

// AI suggest reply
function buildChatContext(): string {
  const peer = members.value.find((m) => m.id === props.peerId);
  const parts: string[] = [];
  parts.push(`当前团队：${teamName}`);
  parts.push(`你的角色：${role}`);
  if (peer) {
    parts.push(`聊天对象：${peer.id}（${peer.role}）`);
  }
  return parts.join("；");
}

function handleAISuggest() {
  const chatMsgs = conversation.value.filter(
    (m): m is ChatMessage => m.type === "chat"
  );
  const count = memberSettings.value.ai_suggestion_history_count;
  const recent = chatMsgs.slice(-count);
  suggestReply(recent, buildChatContext());
}

function handleAcceptSuggestion() {
  const text = acceptSuggestion();
  if (text) {
    sendChat(props.peerId, text);
  }
}

function closeMenuOnClickOutside(e: MouseEvent) {
  const target = e.target as HTMLElement;
  if (!target.closest(".header-actions")) {
    menuOpen.value = false;
  }
}

const toastType = ref<"success" | "error">("success");

// Context menu for message revoke / quote
const contextMenuVisible = ref(false);
const contextMenuX = ref(0);
const contextMenuY = ref(0);
const contextMenuMsg = ref<ChatMessage | null>(null);

// Quote reply state
const quotingMsg = ref<ChatMessage | null>(null);

function handleMessageContextmenu(rect: DOMRect, message: ChatMessage) {
  contextMenuMsg.value = message;
  contextMenuX.value = message.mine
    ? rect.right - 120
    : rect.left;
  contextMenuY.value = rect.bottom + 4;
  contextMenuVisible.value = true;
}

function handleQuoteReply() {
  contextMenuVisible.value = false;
  if (!contextMenuMsg.value) return;
  quotingMsg.value = contextMenuMsg.value;
  contextMenuMsg.value = null;
  nextTick(() => richEditorRef.value?.focus());
}

function handleContextForward() {
  contextMenuVisible.value = false;
  if (!contextMenuMsg.value) return;
  const id = contextMenuMsg.value.id;
  contextMenuMsg.value = null;
  selectMode.value = true;
  selectedIds.value = new Set([id]);
}

function clearQuotingMsg() {
  quotingMsg.value = null;
}

function handleScrollToQuote(quoteId: string) {
  const el = messageList.value;
  if (!el) return;

  let target = el.querySelector(`[data-id="${quoteId}"]`) as HTMLElement | null;

  if (!target) {
    // Target might be beyond loaded range — load all and retry
    const prevScrollHeight = el.scrollHeight;
    displayCount.value = conversation.value.length;
    nextTick(() => {
      target = el.querySelector(`[data-id="${quoteId}"]`) as HTMLElement | null;
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        highlightMessage(target);
      } else if (messageList.value) {
        messageList.value.scrollTop = messageList.value.scrollHeight - prevScrollHeight;
      }
    });
    return;
  }

  target.scrollIntoView({ behavior: 'smooth', block: 'center' });
  highlightMessage(target);
}

function highlightMessage(el: HTMLElement) {
  el.classList.add('quote-highlight');
  setTimeout(() => el.classList.remove('quote-highlight'), 1500);
}

const QUOTE_TEXT_LIMIT = 100;

function generateSnapshotText(msg: ChatMessage): string {
  if (msg.forwarded?.length) return t('chat.quotePlaceholderForwarded');
  if (!msg.text || !msg.text.trim()) {
    if (msg.attachments?.some(a => a.type === 'image')) return t('chat.quotePlaceholderImage');
    const file = msg.attachments?.find(a => a.type === 'file');
    if (file) return t('chat.quotePlaceholderFile') + ' ' + file.name;
    return '';
  }
  return msg.text.length > QUOTE_TEXT_LIMIT ? msg.text.slice(0, QUOTE_TEXT_LIMIT) : msg.text;
}

async function handleRevoke() {
  contextMenuVisible.value = false;
  if (!contextMenuMsg.value || !props.peerId) return;
  const ok = await revokeMessage(props.peerId, contextMenuMsg.value.id);
  if (ok) {
    toastMessage.value = t('chat.revokeSuccess');
    toastType.value = "success";
  } else {
    toastMessage.value = t('chat.revokeFailed');
    toastType.value = "error";
  }
  toastVisible.value = true;
  contextMenuMsg.value = null;
}

function closeContextMenu(e: MouseEvent) {
  const target = e.target as HTMLElement;
  if (!target.closest(".context-menu")) {
    contextMenuVisible.value = false;
  }
}

// Multi-select & forwarding
const selectMode = ref(false);
const selectedIds = ref<Set<string>>(new Set());
const forwardDialogVisible = ref(false);

function enterSelectMode() {
  selectMode.value = true;
  selectedIds.value = new Set();
}

function exitSelectMode() {
  selectMode.value = false;
  selectedIds.value = new Set();
}

function toggleMessageSelect(id: string) {
  const next = new Set(selectedIds.value);
  if (next.has(id)) {
    next.delete(id);
  } else {
    next.add(id);
  }
  selectedIds.value = next;
}

function handleSelectModeKeydown(e: KeyboardEvent) {
  if (e.key === "Escape") {
    if (selectMode.value) {
      exitSelectMode();
    } else if (quotingMsg.value) {
      quotingMsg.value = null;
    }
  }
}

function handleForwardClick() {
  if (selectedIds.value.size === 0) return;
  forwardDialogVisible.value = true;
}

async function handleForwardConfirm(targetId: string) {
  forwardDialogVisible.value = false;

  const selectedMsgs = conversation.value.filter(
    (item): item is ChatMessage => item.type === "chat" && selectedIds.value.has(item.id)
  );
  if (selectedMsgs.length === 0) return;

  const records: ForwardedRecord[] = selectedMsgs.map((m) => ({
    from: m.from,
    text: m.text,
    timestamp: m.timestamp,
    attachments: m.attachments,
  }));

  const summaryText = t('chat.chatHistory') + ` (${records.length})`;

  sendChat(targetId, summaryText, { forwarded: records });

  exitSelectMode();
  toastMessage.value = t('chat.forwardSuccess');
  toastType.value = "success";
  toastVisible.value = true;
}

onMounted(() => {
  document.addEventListener("click", closeMenuOnClickOutside);
  document.addEventListener("click", closeContextMenu);
  document.addEventListener("keydown", handleSelectModeKeydown);
});
onBeforeUnmount(() => {
  document.removeEventListener("click", closeMenuOnClickOutside);
  document.removeEventListener("click", closeContextMenu);
  document.removeEventListener("keydown", handleSelectModeKeydown);
});
</script>

<template>
  <div class="chat-panel">
    <div v-if="!peerId" class="empty-state">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
      <p>{{ $t('chat.selectPeer') }}</p>
    </div>

    <template v-else>
      <div class="header">
        <span class="header-name">{{ headerTitle }}</span>
        <span v-if="isChannel" class="header-subtitle">{{ members.length }} {{ $t('chat.members', 'members') }}</span>
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
        <div v-if="loadingMore" class="loading-more">
          <span class="spinner-small"></span> {{ $t('common.loading') }}
        </div>
        <div v-else-if="hasMoreHistory" class="load-hint">{{ $t('chat.loadMore') }}</div>
        <template v-for="item in visibleMessages" :key="item.id">
          <div v-if="item.type === 'revoked'" class="revoked-notice">
            {{ $t('chat.revokedNotice', { from: item.from }) }}
          </div>
          <MessageBubble
            v-else-if="item.type === 'chat'"
            :message="item"
            :my-id="myId"
            :show-sender="isChannel"
            :member-ids="isChannel ? memberIds : undefined"
            :select-mode="selectMode"
            :selected="selectedIds.has(item.id)"
            :timeline="conversation"
            @contextmenu="handleMessageContextmenu"
            @toggle-select="toggleMessageSelect"
            @scroll-to-quote="handleScrollToQuote"
          />
          <TaskCard v-else :task="item" :team-name="teamName" :my-id="myId" @select-task="emit('selectTask', $event)" />
        </template>

        <!-- AI suggestion overlay -->
        <div v-if="suggestion || isStreaming || aiError" class="ai-suggestion">
          <div class="ai-suggestion-label">{{ $t('chat.aiSuggestion') }}</div>
          <div class="ai-suggestion-text">
            {{ suggestion }}<span v-if="isStreaming" class="ai-cursor"></span>
          </div>
          <div v-if="aiError" class="ai-error-inline">{{ aiError }}</div>
          <div v-if="!isStreaming && (suggestion || aiError)" class="ai-suggestion-actions">
            <button v-if="suggestion" class="btn-ai-accept" @click="handleAcceptSuggestion">{{ $t('chat.accept') }}</button>
            <button class="btn-ai-retry" @click="handleAISuggest">{{ $t('chat.retry') }}</button>
            <button class="btn-ai-dismiss" @click="clearSuggestion">{{ $t('chat.dismiss') }}</button>
          </div>
        </div>
      </div>

      <!-- Multi-select action bar -->
      <div v-if="selectMode" class="select-bar">
        <span class="select-count">{{ $t('chat.selectedCount', { count: selectedIds.size }) }}</span>
        <div class="select-actions">
          <button class="btn-select-cancel" @click="exitSelectMode">{{ t('common.cancel') }}</button>
          <button class="btn-select-forward" @click="handleForwardClick" :disabled="selectedIds.size === 0">{{ t('chat.forward') }}</button>
        </div>
      </div>

      <div v-if="!selectMode" class="input-area">
        <!-- Task input (Leader only) -->
        <div v-if="taskInputVisible && role === 'leader'" class="task-input-wrapper">
          <div class="task-input">
            <input
              v-model="taskContent"
              :placeholder="$t('chat.enterTask')"
              @keydown.enter="handleDispatchTask"
            />
            <button class="btn-icon btn-confirm" @click="handleDispatchTask" :title="$t('chat.dispatchTask')" :disabled="!taskContent.trim()">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
              </svg>
            </button>
            <button class="btn-icon btn-cancel" @click="taskInputVisible = false" :title="$t('common.cancel')">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        <!-- File attachment preview (non-image files) -->
        <div v-if="pendingFiles.length > 0" class="attachment-preview">
          <div v-for="(att, i) in pendingFiles" :key="i" class="preview-item">
            <div class="preview-file-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>
            </div>
            <div class="preview-info">
              <span class="preview-name">{{ att.file.name }}</span>
              <span class="preview-size">{{ formatFileSize(att.file.size) }}</span>
            </div>
            <button class="preview-remove" @click="removeFile(i)">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        </div>
        <div v-if="attachmentError" class="attachment-error">{{ attachmentError }}</div>

        <!-- Quote reply preview -->
        <div v-if="quotingMsg" class="quote-preview">
          <div class="quote-preview-content">
            <span class="quote-preview-sender">{{ getDisplayName(quotingMsg.from) }}</span>
            <span class="quote-preview-text">{{ generateSnapshotText(quotingMsg) }}</span>
          </div>
          <button class="quote-preview-close" @click="clearQuotingMsg">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <!-- Toolbar (floating above editor) -->
        <div class="toolbar">
          <div class="toolbar-left">
            <button v-if="role === 'leader'" class="btn-tool" @click="taskInputVisible = !taskInputVisible" :title="$t('chat.dispatchTask')">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M9 11l3 3L22 4" />
                <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
              </svg>
            </button>
            <button class="btn-tool" @click="handlePickAttachment" :title="$t('chat.addAttachment')">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
              </svg>
            </button>
            <button class="btn-tool" @click="handleAISuggest" :title="$t('chat.aiSuggestReply')" :disabled="!aiAvailable || isStreaming">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
              </svg>
            </button>
          </div>
          <button class="btn-send-toolbar" @click="richEditorRef?.send()" :title="$t('common.send')" :disabled="uploading">
            {{ $t('common.send') }}
          </button>
        </div>

        <!-- Rich text editor -->
        <div class="editor-wrapper" style="position: relative;">
          <MentionPopup
            v-if="isChannel"
            ref="mentionPopupRef"
            :visible="mentionPopupVisible"
            :members="members"
            :query="mentionQuery"
            :my-id="myId"
            @select="handleMentionSelect"
            @close="handleMentionClose"
          />
          <RichEditor ref="richEditorRef" @send="handleRichSend" @input="handleEditorInput" @keydown="handleEditorKeydown" />
        </div>
      </div>
    </template>

    <ConfirmDialog
      :visible="confirmVisible"
      :title="$t('chat.confirmClearTitle')"
      :message="$t('chat.confirmClearMsg', { peer: peerId })"
      :confirm-text="$t('chat.clearBtn')"
      :danger="true"
      @confirm="handleConfirmClear"
      @cancel="handleCancelClear"
    />

    <Toast
      :visible="toastVisible"
      :message="toastMessage"
      :type="toastType"
      @done="toastVisible = false"
    />

    <ForwardDialog
      :visible="forwardDialogVisible"
      :members="members"
      :current-peer-id="peerId"
      @confirm="handleForwardConfirm"
      @cancel="forwardDialogVisible = false"
    />

    <Teleport to="body">
      <div
        v-if="contextMenuVisible"
        class="context-menu"
        :style="{ left: contextMenuX + 'px', top: contextMenuY + 'px' }"
        @click.stop
      >
        <button class="context-menu-item" @click="handleQuoteReply">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 0 0-4-4H4"/></svg>
          {{ $t('chat.quote') }}
        </button>
        <button class="context-menu-item" @click="handleContextForward">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 3 21 3 21 9"/><path d="M21 3l-7 7"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>
          {{ $t('chat.forward') }}
        </button>
        <button v-if="contextMenuMsg?.mine" class="context-menu-item danger" @click="handleRevoke">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 4H8l-7 8 7 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z"/><line x1="18" y1="9" x2="12" y2="15"/><line x1="12" y1="9" x2="18" y2="15"/></svg>
          {{ $t('chat.revoke') }}
        </button>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.chat-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: transparent;
}

.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-md);
  color: var(--text-muted);
}

.empty-state svg {
  color: var(--empty-icon);
}

.empty-state p {
  margin: 0;
  font-size: 0.9em;
}

.header {
  position: relative;
  z-index: 10;
  height: 52px;
  box-sizing: border-box;
  padding: var(--space-md) var(--space-lg);
  border-bottom: 1px solid var(--glass-border);
  background: var(--glass-bg-heavy);
  backdrop-filter: blur(var(--glass-blur));
  -webkit-backdrop-filter: blur(var(--glass-blur));
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.header-name {
  font-weight: 600;
  color: var(--text-primary);
}

.header-status {
  font-size: 0.7em;
  padding: 2px 8px;
  border-radius: 10px;
  font-weight: 500;
}

.header-status.offline {
  background: var(--glass-bg-light);
  color: var(--text-muted);
}

.header-actions {
  margin-left: auto;
  position: relative;
}

.btn-menu {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  transition: all 0.15s;
}

.btn-menu:hover {
  background: var(--glass-bg-light);
  color: var(--text-primary);
}

.dropdown {
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: 4px;
  min-width: 160px;
  background: var(--glass-bg-heavy);
  backdrop-filter: blur(var(--glass-blur));
  -webkit-backdrop-filter: blur(var(--glass-blur));
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-sm);
  box-shadow: var(--glass-shadow);
  z-index: 100;
  overflow: hidden;
}

.dropdown-item {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  width: 100%;
  padding: var(--space-sm) var(--space-md);
  border: none;
  background: none;
  color: var(--text-primary);
  font-size: 0.85em;
  cursor: pointer;
  text-align: left;
  transition: background 0.1s;
}

.dropdown-item:hover {
  background: var(--glass-bg-light);
}

.dropdown-item.danger {
  color: var(--error);
}

.dropdown-item.danger:hover {
  background: var(--task-failed-bg);
}

.messages {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-lg);
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.loading-more,
.load-hint {
  text-align: center;
  color: var(--text-muted);
  font-size: 0.8em;
  padding: var(--space-xs) 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-xs);
}

/* AI suggestion */
.ai-suggestion {
  margin-top: var(--space-sm);
  padding: var(--space-md);
  background: var(--glass-bg);
  backdrop-filter: blur(var(--glass-blur));
  -webkit-backdrop-filter: blur(var(--glass-blur));
  border: 1px dashed var(--border);
  border-radius: var(--radius-md);
}

.ai-suggestion-label {
  font-size: 0.75em;
  font-weight: 600;
  color: var(--accent);
  margin-bottom: var(--space-xs);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.ai-suggestion-text {
  color: var(--text-secondary);
  font-size: 0.9em;
  line-height: 1.5;
  white-space: pre-wrap;
}

.ai-cursor {
  display: inline-block;
  width: 2px;
  height: 1em;
  background: var(--accent);
  margin-left: 1px;
  animation: blink 0.8s ease-in-out infinite;
}

@keyframes blink {
  0%, 50% { opacity: 1; }
  51%, 100% { opacity: 0; }
}

.ai-suggestion-actions {
  display: flex;
  gap: var(--space-sm);
  margin-top: var(--space-sm);
}

.btn-ai-accept,
.btn-ai-retry,
.btn-ai-dismiss {
  padding: 4px 12px;
  border-radius: var(--radius-sm);
  border: none;
  font-size: 0.8em;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-ai-accept {
  background: var(--accent);
  color: var(--text-on-accent);
}

.btn-ai-accept:hover {
  background: var(--accent-hover);
}

.btn-ai-retry {
  background: var(--glass-bg-light);
  color: var(--text-secondary);
  border: 1px solid var(--glass-border);
}

.btn-ai-retry:hover {
  border-color: var(--accent);
  color: var(--accent);
}

.btn-ai-dismiss {
  background: none;
  color: var(--text-muted);
}

.btn-ai-dismiss:hover {
  color: var(--error);
}

.ai-error-inline {
  color: var(--error);
  font-size: 0.8em;
  margin-top: var(--space-xs);
}

/* AI task plan */
.ai-plan {
  margin-bottom: var(--space-sm);
  padding: var(--space-md);
  background: var(--glass-bg);
  backdrop-filter: blur(var(--glass-blur));
  -webkit-backdrop-filter: blur(var(--glass-blur));
  border-radius: var(--radius-md);
  border: 1px solid var(--glass-border);
}

.ai-plan-header {
  margin-bottom: var(--space-sm);
}

.ai-plan-label {
  font-size: 0.75em;
  font-weight: 600;
  color: var(--accent);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.ai-plan-loading {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  color: var(--text-muted);
  font-size: 0.85em;
  padding: var(--space-md);
}

.spinner-small {
  width: 12px;
  height: 12px;
  border: 2px solid var(--border);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

.ai-plan-summary {
  font-size: 0.85em;
  color: var(--text-primary);
  margin-bottom: var(--space-md);
  padding-bottom: var(--space-sm);
  border-bottom: 1px solid var(--border);
}

.ai-plan-assignment {
  padding: var(--space-sm);
  margin-bottom: var(--space-sm);
  background: var(--glass-bg-light);
  border-radius: var(--radius-sm);
}

.ai-plan-assignee {
  font-size: 0.8em;
  font-weight: 600;
  color: var(--accent);
  margin-bottom: var(--space-xs);
}

.ai-plan-desc {
  font-size: 0.85em;
  color: var(--text-secondary);
  margin-bottom: var(--space-xs);
}

.ai-plan-cmd {
  display: block;
  font-family: monospace;
  font-size: 0.8em;
  color: var(--text-primary);
  background: var(--glass-bg-light);
  padding: 2px 6px;
  border-radius: 3px;
  margin: 2px 0;
}

.ai-plan-actions {
  display: flex;
  gap: var(--space-sm);
  margin-top: var(--space-md);
}

.ai-error {
  color: var(--error);
  font-size: 0.8em;
  margin-top: var(--space-sm);
}

/* Multi-select action bar */
.select-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-sm) var(--space-lg);
  background: var(--glass-bg-heavy);
  backdrop-filter: blur(var(--glass-blur));
  -webkit-backdrop-filter: blur(var(--glass-blur));
  border-top: 1px solid var(--glass-border);
}

.select-count {
  font-size: 0.85em;
  color: var(--text-secondary);
}

.select-actions {
  display: flex;
  gap: var(--space-sm);
}

.btn-select-cancel {
  padding: 6px 16px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--glass-border);
  background: transparent;
  color: var(--text-secondary);
  font-size: 0.85em;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-select-cancel:hover {
  background: var(--glass-bg-light);
}

.btn-select-forward {
  padding: 6px 16px;
  border-radius: var(--radius-sm);
  border: none;
  background: var(--accent);
  color: var(--text-on-accent);
  font-size: 0.85em;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-select-forward:hover {
  background: var(--accent-hover);
}

.btn-select-forward:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Input area */
.input-area {
  padding: var(--space-md) var(--space-lg);
  background: transparent;
}

.task-input {
  display: flex;
  gap: var(--space-sm);
  margin-bottom: var(--space-sm);
  padding: var(--space-sm);
  background: var(--glass-bg-light);
  border-radius: var(--radius-md);
}

.task-input input {
  flex: 1;
  padding: 8px var(--space-md);
  border: 1px solid var(--input-border);
  border-radius: var(--radius-sm);
  background: var(--bg-input);
  color: var(--text-primary);
  outline: none;
}

.task-input input:focus {
  border-color: var(--accent);
}

.task-input-wrapper {
  margin-bottom: var(--space-sm);
}

/* Dispatch preview panel */
.dispatch-preview {
  padding: var(--space-md);
  background: var(--glass-bg);
  backdrop-filter: blur(var(--glass-blur));
  -webkit-backdrop-filter: blur(var(--glass-blur));
  border-radius: var(--radius-md);
  border: 1px solid var(--glass-border);
  margin-top: var(--space-sm);
}

.dispatch-preview-header {
  margin-bottom: var(--space-sm);
}

.dispatch-preview-label {
  font-size: 0.75em;
  font-weight: 600;
  color: var(--accent);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.dispatch-preview-content {
  font-size: 0.85em;
  color: var(--text-primary);
  line-height: 1.4;
  margin-bottom: var(--space-md);
  padding-bottom: var(--space-sm);
  border-bottom: 1px solid var(--border);
}

.dispatch-preview-members {
  margin-bottom: var(--space-md);
}

.dispatch-members-label {
  font-size: 0.8em;
  color: var(--text-muted);
  display: block;
  margin-bottom: var(--space-xs);
}

.dispatch-member-list {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-xs);
}

.dispatch-member-chip {
  display: inline-flex;
  align-items: center;
  gap: var(--space-xs);
  padding: 3px 10px;
  border-radius: var(--radius-sm);
  background: var(--accent-light);
  color: var(--accent);
  font-size: 0.8em;
  font-weight: 500;
}

.dispatch-preview-actions {
  display: flex;
  gap: var(--space-sm);
}

/* Toolbar */
.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-xs) var(--space-xs);
  margin-bottom: var(--space-xs);
}

.toolbar-left {
  display: flex;
  gap: var(--space-xs);
}

.btn-tool {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border-radius: var(--radius-sm);
  border: none;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  transition: all 0.15s;
}

.btn-tool:hover {
  background: var(--bg-tertiary);
  color: var(--accent);
}

.btn-tool:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.btn-send-toolbar {
  padding: 6px 20px;
  border-radius: var(--radius-sm);
  border: none;
  background: var(--accent);
  color: var(--text-on-accent);
  font-size: 0.85em;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-send-toolbar:hover {
  background: var(--accent-hover);
}

.btn-send-toolbar:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Buttons shared (task input, AI, etc.) */
.btn-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  border-radius: 50%;
  border: none;
  cursor: pointer;
  flex-shrink: 0;
  transition: all 0.15s;
}

.btn-confirm {
  background: var(--accent);
  color: var(--text-on-accent);
}

.btn-confirm:hover {
  background: var(--accent-hover);
}

.btn-cancel {
  background: var(--glass-bg-light);
  color: var(--text-muted);
  border: 1px solid var(--glass-border);
}

.btn-cancel:hover {
  color: var(--error);
}

.btn-ai {
  background: var(--glass-bg-light);
  color: var(--accent);
  border: 1px solid var(--glass-border);
}

.btn-ai:hover {
  background: var(--accent);
  color: var(--text-on-accent);
}

/* Attachment preview */
.attachment-preview {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-sm);
  padding: var(--space-sm) 0;
  margin-bottom: var(--space-xs);
}

.preview-item {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-xs) var(--space-sm);
  background: var(--glass-bg-light);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-sm);
  max-width: 200px;
}

.preview-file-icon {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--glass-bg);
  border-radius: 4px;
  color: var(--text-muted);
  flex-shrink: 0;
}

.preview-info {
  display: flex;
  flex-direction: column;
  min-width: 0;
  flex: 1;
}

.preview-name {
  font-size: 0.75em;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.preview-size {
  font-size: 0.68em;
  color: var(--text-muted);
}

.preview-remove {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  flex-shrink: 0;
}

.preview-remove:hover {
  background: var(--task-failed-bg);
  color: var(--error);
}

.attachment-error {
  font-size: 0.8em;
  color: var(--error);
  padding: var(--space-xs) 0;
  margin-bottom: var(--space-xs);
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Context menu */
.context-menu {
  position: fixed;
  z-index: 10000;
  min-width: 120px;
  background: var(--glass-bg-heavy);
  backdrop-filter: blur(var(--glass-blur));
  -webkit-backdrop-filter: blur(var(--glass-blur));
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-sm);
  box-shadow: var(--glass-shadow);
  overflow: hidden;
}

.context-menu-item {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  width: 100%;
  padding: var(--space-sm) var(--space-md);
  border: none;
  background: none;
  color: var(--text-primary);
  font-size: 0.85em;
  cursor: pointer;
  text-align: left;
  transition: background 0.1s;
}

.context-menu-item:hover {
  background: var(--glass-bg-light);
}

.context-menu-item.danger {
  color: var(--error);
}

.context-menu-item.danger:hover {
  background: var(--task-failed-bg);
}

/* Revoked notice */
.revoked-notice {
  align-self: center;
  font-size: 0.78em;
  color: var(--text-muted);
  padding: var(--space-xs) var(--space-md);
}

/* Quote preview bar */
.quote-preview {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-xs) var(--space-sm);
  margin-bottom: var(--space-xs);
  background: var(--glass-bg-light);
  border: 1px solid var(--glass-border);
  border-left: 3px solid var(--accent);
  border-radius: var(--radius-sm);
}

.quote-preview-content {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: baseline;
  gap: var(--space-xs);
  overflow: hidden;
}

.quote-preview-sender {
  font-size: 0.78em;
  font-weight: 600;
  color: var(--accent);
  white-space: nowrap;
  flex-shrink: 0;
}

.quote-preview-text {
  font-size: 0.78em;
  color: var(--text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.quote-preview-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  flex-shrink: 0;
  transition: all 0.15s;
}

.quote-preview-close:hover {
  background: var(--glass-bg);
  color: var(--text-primary);
}

/* Quote highlight */
.quote-highlight {
  animation: quote-highlight-pulse 1.5s ease-out;
}

@keyframes quote-highlight-pulse {
  0% { box-shadow: 0 0 0 0 var(--accent); }
  30% { box-shadow: 0 0 0 3px var(--accent); }
  100% { box-shadow: 0 0 0 0 transparent; }
}
</style>
