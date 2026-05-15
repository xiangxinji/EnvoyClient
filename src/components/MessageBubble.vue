<script setup lang="ts">
import { computed, ref } from "vue";
import { marked, type Tokens } from "marked";
import DOMPurify from "dompurify";
import type { ChatMessage, MessageAttachment } from "../types";

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

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Fullscreen image viewer
const fullscreenUrl = ref<string | null>(null);

function openFullscreen(att: MessageAttachment) {
  if (att.type === "image") fullscreenUrl.value = att.url;
}

function closeFullscreen() {
  fullscreenUrl.value = null;
}
</script>

<template>
  <div class="bubble" :class="{ mine: message.mine }">
    <div class="content" v-html="renderedHtml"></div>

    <!-- Attachments -->
    <div v-if="message.attachments?.length" class="attachments">
      <template v-for="(att, i) in message.attachments" :key="i">
        <!-- Image card -->
        <div v-if="att.type === 'image'" class="image-card" @click="openFullscreen(att)">
          <img :src="att.url" :alt="att.name" loading="lazy" />
        </div>
        <!-- File card -->
        <a v-else :href="att.url" class="file-card" target="_blank" rel="noopener">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>
          <div class="file-info">
            <span class="file-name">{{ att.name }}</span>
            <span class="file-size">{{ formatSize(att.size) }}</span>
          </div>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        </a>
      </template>
    </div>
  </div>
  <div class="time-row" :class="{ mine: message.mine }">
    <span class="time">{{ formatTime(message.timestamp) }}</span>
  </div>

  <!-- Fullscreen image overlay -->
  <Teleport to="body">
    <div v-if="fullscreenUrl" class="fullscreen-overlay" @click="closeFullscreen">
      <img :src="fullscreenUrl" class="fullscreen-image" @click.stop />
    </div>
  </Teleport>
</template>

<style scoped>
.bubble {
  max-width: 75%;
  padding: 10px 14px;
  border-radius: 18px;
  background: var(--glass-bg);
  backdrop-filter: blur(var(--glass-blur));
  -webkit-backdrop-filter: blur(var(--glass-blur));
  color: var(--bubble-other-text);
  align-self: flex-start;
  border: 1px solid var(--glass-border);
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

/* Attachments */
.attachments {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
  margin-top: var(--space-sm);
}

.image-card {
  border-radius: 8px;
  overflow: hidden;
  cursor: pointer;
  max-width: 320px;
}

.image-card img {
  display: block;
  max-width: 100%;
  border-radius: 8px;
}

.file-card {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-sm) var(--space-md);
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  color: var(--text-primary);
  text-decoration: none;
  font-size: 0.85em;
  transition: border-color 0.15s;
}

.file-card:hover {
  border-color: var(--accent);
}

.file-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.file-name {
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-size {
  font-size: 0.8em;
  color: var(--text-muted);
}

/* Fullscreen overlay */
.fullscreen-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: rgba(0, 0, 0, 0.85);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.fullscreen-image {
  max-width: 90vw;
  max-height: 90vh;
  object-fit: contain;
  border-radius: 4px;
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
