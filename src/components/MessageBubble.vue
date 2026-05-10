<script setup lang="ts">
import { computed } from "vue";
import { marked, type Tokens } from "marked";
import DOMPurify from "dompurify";
import type { ChatMessage } from "../types";

const props = defineProps<{
  message: ChatMessage;
  myId: string;
}>();

marked.setOptions({
  gfm: true,
  breaks: true,
});

const renderer = {
  link({ href, title, text }: Tokens.Link) {
    const titleAttr = title ? ` title="${title}"` : "";
    return `<a target="_blank" rel="noopener noreferrer" href="${href}"${titleAttr}>${text}</a>`;
  },
};
marked.use({ renderer });

const renderedHtml = computed(() => {
  const raw = marked.parse(props.message.text) as string;
  return DOMPurify.sanitize(raw);
});

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
</script>

<template>
  <div class="bubble" :class="{ mine: message.mine }">
    <div class="content" v-html="renderedHtml"></div>
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

.content :deep(p) {
  margin: 0 0 0.4em;
}

.content :deep(p:last-child) {
  margin-bottom: 0;
}

.content :deep(strong) {
  font-weight: 600;
}

.content :deep(em) {
  font-style: italic;
}

.content :deep(code) {
  font-family: "SF Mono", Menlo, Consolas, monospace;
  font-size: 0.88em;
  background: var(--md-code-bg);
  color: var(--md-code-text);
  padding: 1px 5px;
  border-radius: 4px;
}

.content :deep(pre) {
  margin: 0.5em 0;
  padding: 10px 12px;
  background: var(--md-pre-bg);
  border-radius: var(--radius-sm);
  overflow-x: auto;
}

.content :deep(pre code) {
  background: none;
  color: var(--md-pre-text);
  padding: 0;
  font-size: 0.85em;
  line-height: 1.5;
}

.content :deep(a) {
  color: var(--md-link-color);
  text-decoration: none;
}

.content :deep(a:hover) {
  text-decoration: underline;
}

.content :deep(ul),
.content :deep(ol) {
  margin: 0.4em 0;
  padding-left: 1.5em;
}

.content :deep(li) {
  margin: 0.15em 0;
}

.content :deep(blockquote) {
  margin: 0.5em 0;
  padding: 4px 12px;
  border-left: 3px solid var(--md-blockquote-border);
  color: var(--md-blockquote-text);
}

.content :deep(blockquote p) {
  margin: 0;
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
