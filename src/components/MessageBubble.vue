<script setup lang="ts">
import type { ChatMessage } from "../types";

defineProps<{
  message: ChatMessage;
  myId: string;
}>();

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
</script>

<template>
  <div class="bubble" :class="{ mine: message.mine }">
    <div class="meta">
      <span class="sender">{{ message.mine ? "You" : message.from }}</span>
      <span class="time">{{ formatTime(message.timestamp) }}</span>
    </div>
    <div class="content">{{ message.text }}</div>
  </div>
</template>

<style scoped>
.bubble {
  max-width: 70%;
  padding: 8px 12px;
  border-radius: 8px;
  background: var(--bubble-other);
  color: var(--bubble-other-text);
  align-self: flex-start;
}

.bubble.mine {
  background: var(--accent);
  color: white;
  align-self: flex-end;
}

.meta {
  display: flex;
  gap: 8px;
  font-size: 0.75em;
  margin-bottom: 4px;
  opacity: 0.7;
}

.bubble.mine .meta {
  justify-content: flex-end;
}

.content {
  word-break: break-word;
  line-height: 1.4;
}
</style>
