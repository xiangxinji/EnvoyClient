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
  dispatchTask(props.peerId, content);
  taskContent.value = "";
  taskInputVisible.value = false;
}
</script>

<template>
  <div class="chat-panel">
    <div v-if="!peerId" class="empty-state">
      <p>Select a member to start chatting</p>
    </div>

    <template v-else>
      <div class="header">
        <span>{{ peerId }}</span>
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
            placeholder="Task description..."
            @keydown.enter="handleDispatchTask"
          />
          <button class="btn-confirm" @click="handleDispatchTask">Confirm</button>
          <button class="btn-cancel" @click="taskInputVisible = false">Cancel</button>
        </div>
        <div class="chat-input">
          <input
            v-model="inputText"
            placeholder="Type a message..."
            @keydown="handleKeydown"
          />
          <button class="btn-send" @click="handleSend">Send</button>
          <button v-if="role === 'leader'" class="btn-task" @click="taskInputVisible = !taskInputVisible">
            Task
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
  align-items: center;
  justify-content: center;
  color: var(--text-muted);
}

.header {
  padding: 10px 16px;
  border-bottom: 1px solid var(--border);
  font-weight: 600;
  color: var(--text-primary);
  background: var(--bg-tertiary);
}

.messages {
  flex: 1;
  overflow-y: auto;
  padding: 12px 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.input-area {
  border-top: 1px solid var(--border);
  background: var(--bg-tertiary);
}

.task-input {
  display: flex;
  gap: 6px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--border-light);
}

.task-input input {
  flex: 1;
  padding: 0.4em 0.6em;
  border: 1px solid var(--input-border);
  border-radius: 4px;
  background: var(--bg-input);
  color: var(--text-primary);
}

.chat-input {
  display: flex;
  gap: 6px;
  padding: 8px 12px;
}

.chat-input input {
  flex: 1;
  padding: 0.5em 0.8em;
  border: 1px solid var(--input-border);
  border-radius: 6px;
  font-size: 0.95em;
  background: var(--bg-input);
  color: var(--text-primary);
}

button {
  padding: 0.5em 1em;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.9em;
}

.btn-send {
  background: var(--accent);
  color: white;
}

.btn-send:hover {
  background: var(--accent-hover);
}

.btn-task {
  background: var(--task-btn-bg);
  color: var(--task-btn-text);
}

.btn-confirm {
  background: var(--accent);
  color: white;
}

.btn-cancel {
  background: var(--border);
  color: var(--text-secondary);
}
</style>
