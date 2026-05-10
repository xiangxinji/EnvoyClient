<script setup lang="ts">
import { inject, ref, nextTick, watch, computed } from "vue";
import { TeamClientKey } from "../composables/teamClientContext";
import MessageBubble from "./MessageBubble.vue";
import TaskCard from "./TaskCard.vue";
import type { TimelineItem } from "../types";

const props = defineProps<{ peerId: string }>();

const ctx = inject(TeamClientKey)!;
const { getConversation, sendChat, dispatchTask, role, myId, syncUnread } = ctx;

const inputText = ref("");
const taskInputVisible = ref(false);
const taskContent = ref("");
const messageList = ref<HTMLDivElement | null>(null);

const conversation = computed<TimelineItem[]>(() => {
  if (!props.peerId) return [];
  return getConversation(props.peerId);
});

watch(
  () => conversation.value.length,
  async () => {
    await nextTick();
    if (messageList.value) {
      messageList.value.scrollTop = messageList.value.scrollHeight;
    }
  }
);

watch(
  () => props.peerId,
  (newPeer) => {
    if (newPeer) syncUnread(newPeer, true);
    taskInputVisible.value = false;
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

      <div ref="messageList" class="messages">
        <template v-for="item in conversation" :key="item.id">
          <MessageBubble v-if="item.type === 'chat'" :message="item" :my-id="myId" />
          <TaskCard v-else :task="item" />
        </template>
      </div>

      <div class="input-area">
        <div v-if="taskInputVisible" class="task-input">
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
          <button class="btn-icon btn-cancel" @click="taskInputVisible = false" title="取消">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
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
</style>
