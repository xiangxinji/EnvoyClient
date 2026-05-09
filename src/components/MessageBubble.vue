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
    <div class="content">{{ message.text }}</div>
  </div>
  <div class="time-row" :class="{ mine: message.mine }">
    <span class="time">{{ formatTime(message.timestamp) }}</span>
  </div>
</template>

<style scoped>
.bubble {
  max-width: 75%;
  padding: 10px 14px;
  border-radius: 18px;
  background: var(--bubble-other);
  color: var(--bubble-other-text);
  align-self: flex-start;
  box-shadow: var(--shadow-sm);
}

.bubble.mine {
  background: var(--bubble-mine);
  color: var(--bubble-mine-text);
  align-self: flex-end;
  border-bottom-right-radius: 4px;
}

.bubble:not(.mine) {
  border-bottom-left-radius: 4px;
}

.content {
  word-break: break-word;
  line-height: 1.45;
  font-size: 0.92em;
}

.time-row {
  padding: 0 4px;
  margin-top: -2px;
  margin-bottom: 2px;
}

.time-row.mine {
  text-align: right;
}

.time {
  font-size: 0.7em;
  color: var(--text-muted);
}
</style>
