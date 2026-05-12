<script setup lang="ts">
import { inject, ref, nextTick, watch, computed } from "vue";
import { TeamClientKey } from "../composables/teamClientContext";
import { useAI } from "../composables/useAI";
import MessageBubble from "./MessageBubble.vue";
import TaskCard from "./TaskCard.vue";
import type { TimelineItem, ChatMessage, TaskPlan } from "../types";

const props = defineProps<{ peerId: string }>();

const ctx = inject(TeamClientKey)!;
const { getConversation, sendChat, dispatchTask, role, myId, markRead, members } = ctx;

const inputText = ref("");
const taskInputVisible = ref(false);
const taskContent = ref("");
const messageList = ref<HTMLDivElement | null>(null);

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
  planTask,
} = useAI();

// AI task plan
const aiPlanVisible = ref(false);
const aiPlan = ref<TaskPlan | null>(null);
const aiPlanLoading = ref(false);

watch(
  () => props.peerId,
  (newPeer) => {
    if (newPeer) markRead(newPeer);
    displayCount.value = PAGE_SIZE;
    taskInputVisible.value = false;
    clearSuggestion();
    aiPlanVisible.value = false;
    aiPlan.value = null;
  }
);

function handleSend() {
  const text = inputText.value.trim();
  if (!text || !props.peerId) return;
  sendChat(props.peerId, text);
  inputText.value = "";
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    handleSend();
  }
}

function handleDispatchTask() {
  const content = taskContent.value.trim();
  if (!content || !props.peerId) return;
  dispatchTask([props.peerId], content);
  taskContent.value = "";
  taskInputVisible.value = false;
}

// AI suggest reply
function handleAISuggest() {
  const chatMsgs = conversation.value.filter(
    (m): m is ChatMessage => m.type === "chat"
  );
  suggestReply(chatMsgs);
}

function handleAcceptSuggestion() {
  const text = acceptSuggestion();
  if (text) {
    inputText.value = text;
  }
}

// AI task generation (Leader only)
async function handleAITaskGenerate() {
  if (!taskContent.value.trim()) return;
  aiPlanLoading.value = true;
  aiPlanVisible.value = true;
  aiPlan.value = null;

  const plan = await planTask(taskContent.value.trim(), members);
  aiPlan.value = plan;
  aiPlanLoading.value = false;
}

function handleConfirmAIPlan() {
  if (!aiPlan.value) return;

  for (const assignment of aiPlan.value.assignments) {
    const commands = assignment.commands.join(" && ");
    dispatchTask([assignment.memberId], commands);
  }

  aiPlanVisible.value = false;
  aiPlan.value = null;
  taskContent.value = "";
  taskInputVisible.value = false;
}

function handleCancelAIPlan() {
  aiPlanVisible.value = false;
  aiPlan.value = null;
}
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
      </div>

      <div ref="messageList" class="messages" @scroll="handleScroll">
        <div v-if="loadingMore" class="loading-more">
          <span class="spinner-small"></span> 加载中...
        </div>
        <div v-else-if="hasMoreHistory" class="load-hint">↑ 向上滚动加载更多</div>
        <template v-for="item in visibleMessages" :key="item.id">
          <MessageBubble v-if="item.type === 'chat'" :message="item" :my-id="myId" />
          <TaskCard v-else :task="item" />
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
        <!-- AI task plan panel (Leader only) -->
        <div v-if="aiPlanVisible && role === 'leader'" class="ai-plan">
          <div class="ai-plan-header">
            <span class="ai-plan-label">AI 任务规划</span>
          </div>
          <div v-if="aiPlanLoading" class="ai-plan-loading">
            <span class="spinner-small"></span> AI 正在分析...
          </div>
          <template v-else-if="aiPlan">
            <div class="ai-plan-summary">{{ aiPlan.summary }}</div>
            <div v-for="(a, i) in aiPlan.assignments" :key="i" class="ai-plan-assignment">
              <div class="ai-plan-assignee">{{ a.memberId }}</div>
              <div class="ai-plan-desc">{{ a.description }}</div>
              <code v-for="cmd in a.commands" :key="cmd" class="ai-plan-cmd">{{ cmd }}</code>
            </div>
            <div class="ai-plan-actions">
              <button class="btn-ai-accept" @click="handleConfirmAIPlan">确认分派</button>
              <button class="btn-ai-dismiss" @click="handleCancelAIPlan">取消</button>
            </div>
          </template>
          <div v-if="aiError" class="ai-error">{{ aiError }}</div>
        </div>

        <!-- Task input (Leader only) -->
        <div v-if="taskInputVisible && role === 'leader' && !aiPlanVisible" class="task-input">
          <input
            v-model="taskContent"
            placeholder="输入任务描述..."
            @keydown.enter="handleDispatchTask"
          />
          <button class="btn-icon btn-confirm" @click="handleDispatchTask" title="确认">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </button>
          <button class="btn-icon btn-ai" @click="handleAITaskGenerate" title="AI 生成命令" :disabled="!aiAvailable">
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

        <!-- Chat input -->
        <div class="chat-input">
          <button v-if="role === 'leader'" class="btn-icon btn-task" @click="taskInputVisible = !taskInputVisible" title="分派任务">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M9 11l3 3L22 4" />
              <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
            </svg>
          </button>
          <input
            v-model="inputText"
            placeholder="输入消息..."
            @keydown="handleKeydown"
          />
          <button class="btn-icon btn-ai" @click="handleAISuggest" title="AI 建议回复" :disabled="!aiAvailable || isStreaming">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
          </button>
          <button class="btn-icon btn-send" @click="handleSend" title="发送">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.chat-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--bg-primary);
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
  padding: var(--space-md) var(--space-lg);
  border-bottom: 1px solid var(--border);
  background: var(--bg-primary);
}

.header-name {
  font-weight: 600;
  color: var(--text-primary);
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
  background: var(--bg-secondary);
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
  background: var(--bg-secondary);
  border-radius: var(--radius-md);
  border: 1px solid var(--border);
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
  background: var(--bg-primary);
}

.task-input {
  display: flex;
  gap: var(--space-sm);
  margin-bottom: var(--space-sm);
  padding: var(--space-sm);
  background: var(--bg-secondary);
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

.chat-input {
  display: flex;
  gap: var(--space-sm);
  align-items: center;
}

.chat-input input {
  flex: 1;
  padding: 10px var(--space-md);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: var(--bg-secondary);
  color: var(--text-primary);
  outline: none;
}

.chat-input input:focus {
  border-color: var(--accent);
}

.chat-input input::placeholder {
  color: var(--text-muted);
}

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

.btn-send {
  background: var(--accent);
  color: white;
}

.btn-send:hover {
  background: var(--accent-hover);
}

.btn-task {
  background: var(--bg-secondary);
  color: var(--task-btn-bg);
  border: 1px solid var(--border);
}

.btn-task:hover {
  background: var(--task-btn-bg);
  color: var(--task-btn-text);
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

.btn-ai:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
