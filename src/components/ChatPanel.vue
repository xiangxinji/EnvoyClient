<script setup lang="ts">
import { inject, ref, nextTick, watch, computed, onMounted, onBeforeUnmount } from "vue";
import { TeamClientKey, getMemberSettings } from "../composables/teamClientContext";
import { useAI } from "../composables/useAI";
import MessageBubble from "./MessageBubble.vue";
import TaskCard from "./TaskCard.vue";
import ConfirmDialog from "./ConfirmDialog.vue";
import Toast from "./Toast.vue";
import RichEditor from "./RichEditor.vue";
import type { TimelineItem, ChatMessage, MessageAttachment, TaskMessage } from "../types";
import { isImageMime, formatFileSize, compressImage } from "../utils/imageCompress";
import { apiUrl } from "../api";

const props = defineProps<{ peerId: string }>();

const emit = defineEmits<{
  selectTask: [task: TaskMessage];
}>();

const ctx = inject(TeamClientKey)!;
const { getConversation, sendChat, dispatchTask, role, myId, markRead, members, teamName, clearConversation } = ctx;

const peerStatus = computed(() => {
  const m = members.value.find((m) => m.id === props.peerId);
  return m?.status;
});

const taskInputVisible = ref(false);
const taskContent = ref("");
const messageList = ref<HTMLDivElement | null>(null);
const menuOpen = ref(false);
const confirmVisible = ref(false);
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
          const err = await res.json().catch(() => ({ error: "上传失败" }));
          throw new Error(err.error ?? "上传失败");
        }

        const data = await res.json() as MessageAttachment;
        data.url = apiUrl(data.url);
        attachments.push(data);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      attachmentError.value = `图片上传失败: ${msg}`;
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
          const err = await res.json().catch(() => ({ error: "上传失败" }));
          throw new Error(err.error ?? "上传失败");
        }

        const data = await res.json() as MessageAttachment;
        data.url = apiUrl(data.url);
        attachments.push(data);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      attachmentError.value = `附件上传失败: ${msg}`;
      uploading.value = false;
      return;
    }
    uploading.value = false;

    pendingFiles.value = [];
  }

  sendChat(props.peerId, text || " ", { attachments: attachments.length > 0 ? attachments : undefined });
}

function handleClearChat() {
  menuOpen.value = false;
  confirmVisible.value = true;
}

function handleConfirmClear() {
  confirmVisible.value = false;
  if (!props.peerId) return;
  clearConversation(props.peerId);
  toastMessage.value = `已清除与 ${props.peerId} 的聊天记录`;
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

onMounted(() => document.addEventListener("click", closeMenuOnClickOutside));
onBeforeUnmount(() => document.removeEventListener("click", closeMenuOnClickOutside));
</script>

<template>
  <div class="chat-panel">
    <div v-if="!peerId" class="empty-state">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
      <p>选择一位成员开始聊天</p>
    </div>

    <template v-else>
      <div class="header">
        <span class="header-name">{{ peerId }}</span>
        <span v-if="peerStatus === 'offline'" class="header-status offline">离线</span>
        <div class="header-actions">
          <button class="btn-menu" @click="menuOpen = !menuOpen" title="操作">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>
          </button>
          <div v-if="menuOpen" class="dropdown" @click.stop>
            <button class="dropdown-item danger" @click="handleClearChat">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
              清除聊天记录
            </button>
          </div>
        </div>
      </div>

      <div ref="messageList" class="messages" @scroll="handleScroll">
        <div v-if="loadingMore" class="loading-more">
          <span class="spinner-small"></span> 加载中...
        </div>
        <div v-else-if="hasMoreHistory" class="load-hint">↑ 向上滚动加载更多</div>
        <template v-for="item in visibleMessages" :key="item.id">
          <MessageBubble v-if="item.type === 'chat'" :message="item" :my-id="myId" />
          <TaskCard v-else :task="item" :team-name="teamName" :my-id="myId" @select-task="emit('selectTask', $event)" />
        </template>

        <!-- AI suggestion overlay -->
        <div v-if="suggestion || isStreaming || aiError" class="ai-suggestion">
          <div class="ai-suggestion-label">AI 建议</div>
          <div class="ai-suggestion-text">
            {{ suggestion }}<span v-if="isStreaming" class="ai-cursor"></span>
          </div>
          <div v-if="aiError" class="ai-error-inline">{{ aiError }}</div>
          <div v-if="!isStreaming && (suggestion || aiError)" class="ai-suggestion-actions">
            <button v-if="suggestion" class="btn-ai-accept" @click="handleAcceptSuggestion">采纳</button>
            <button class="btn-ai-retry" @click="handleAISuggest">重新生成</button>
            <button class="btn-ai-dismiss" @click="clearSuggestion">忽略</button>
          </div>
        </div>
      </div>

      <div class="input-area">
        <!-- Task input (Leader only) -->
        <div v-if="taskInputVisible && role === 'leader'" class="task-input-wrapper">
          <div class="task-input">
            <input
              v-model="taskContent"
              placeholder="输入任务描述..."
              @keydown.enter="handleDispatchTask"
            />
            <button class="btn-icon btn-confirm" @click="handleDispatchTask" title="分派任务" :disabled="!taskContent.trim()">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
              </svg>
            </button>
            <button class="btn-icon btn-cancel" @click="taskInputVisible = false" title="取消">
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

        <!-- Toolbar (floating above editor) -->
        <div class="toolbar">
          <div class="toolbar-left">
            <button v-if="role === 'leader'" class="btn-tool" @click="taskInputVisible = !taskInputVisible" title="分派任务">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M9 11l3 3L22 4" />
                <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
              </svg>
            </button>
            <button class="btn-tool" @click="handlePickAttachment" title="添加附件">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
              </svg>
            </button>
            <button class="btn-tool" @click="handleAISuggest" title="AI 建议回复" :disabled="!aiAvailable || isStreaming">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
              </svg>
            </button>
          </div>
          <button class="btn-send-toolbar" @click="richEditorRef?.send()" title="发送" :disabled="uploading">
            发送
          </button>
        </div>

        <!-- Rich text editor -->
        <RichEditor ref="richEditorRef" @send="handleRichSend" />
      </div>
    </template>

    <ConfirmDialog
      :visible="confirmVisible"
      title="清除聊天记录"
      :message="`确认清除与 ${peerId} 的所有聊天记录？此操作不可撤销。`"
      confirm-text="清除"
      :danger="true"
      @confirm="handleConfirmClear"
      @cancel="handleCancelClear"
    />

    <Toast
      :visible="toastVisible"
      :message="toastMessage"
      type="success"
      @done="toastVisible = false"
    />
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
  background: var(--bg-secondary);
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
  background: var(--bg-secondary);
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
  background: var(--bg-secondary);
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
  color: white;
}

.btn-ai-accept:hover {
  background: var(--accent-hover);
}

.btn-ai-retry {
  background: var(--bg-primary);
  color: var(--text-secondary);
  border: 1px solid var(--border);
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
  background: var(--bg-primary);
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
  background: var(--bg-secondary);
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
  color: white;
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
  color: white;
}

.btn-confirm:hover {
  background: var(--accent-hover);
}

.btn-cancel {
  background: var(--bg-primary);
  color: var(--text-muted);
  border: 1px solid var(--border);
}

.btn-cancel:hover {
  color: var(--error);
}

.btn-ai {
  background: var(--bg-secondary);
  color: var(--accent);
  border: 1px solid var(--border);
}

.btn-ai:hover {
  background: var(--accent);
  color: white;
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
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  max-width: 200px;
}

.preview-file-icon {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-tertiary);
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
</style>
