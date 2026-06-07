<script setup lang="ts">
import SvgIcon from "../SvgIcon";

defineProps<{
  label: string;
  desc: string;
  shortcut: string;
  isRecording: boolean;
}>();

defineEmits<{
  record: [];
  clear: [];
}>();
</script>

<template>
  <div class="shortcut-card">
    <div class="shortcut-info">
      <span class="shortcut-label">{{ label }}</span>
      <span class="shortcut-desc">{{ desc }}</span>
    </div>
    <div class="shortcut-actions">
      <button
        type="button"
        class="key-badge"
        :class="{ recording: isRecording }"
        :title="isRecording ? $t('shortcut.pressing') : (shortcut || $t('shortcut.clickToRecord'))"
        @click="$emit('record')"
      >
        <template v-if="isRecording">
          <span class="recording-dot" />
          <span class="key-label">{{ $t('shortcut.pressing') }}</span>
        </template>
        <template v-else-if="shortcut">
          <span class="key-label">{{ shortcut }}</span>
        </template>
        <template v-else>
          <span class="key-label">{{ $t('shortcut.clickToRecord') }}</span>
        </template>
      </button>
      <button
        v-if="shortcut && !isRecording"
        type="button"
        class="clear-btn"
        :title="$t('shortcut.clearShortcut')"
        @click="$emit('clear')"
      >
        <SvgIcon name="close" :size="12" />
      </button>
    </div>
  </div>
</template>

<style scoped>
.shortcut-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-md);
  min-height: 72px;
  box-sizing: border-box;
  padding: var(--space-md);
  border-radius: var(--radius-md);
  background: var(--glass-bg);
  backdrop-filter: blur(var(--glass-blur));
  -webkit-backdrop-filter: blur(var(--glass-blur));
  border: 1px solid var(--glass-border);
}

.shortcut-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  min-width: 0;
}

.shortcut-label {
  font-size: 0.9em;
  font-weight: 600;
  color: var(--text-primary);
}

.shortcut-desc {
  font-size: 0.78em;
  color: var(--text-muted);
  line-height: 1.4;
  overflow-wrap: anywhere;
}

.shortcut-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
  min-width: 0;
}

.key-badge {
  appearance: none;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: auto;
  min-width: 112px;
  max-width: 176px;
  height: 32px;
  box-sizing: border-box;
  padding: 0 12px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--glass-border);
  background: var(--glass-bg-light);
  color: var(--text-secondary);
  font-size: 0.82em;
  font-weight: 600;
  font-family: var(--font-sans);
  line-height: 1;
  cursor: pointer;
  transition:
    border-color 0.15s,
    background 0.15s,
    color 0.15s,
    box-shadow 0.15s;
  white-space: nowrap;
  user-select: none;
  overflow: hidden;
}

.key-badge:hover {
  border-color: var(--accent);
  color: var(--text-primary);
  background: var(--glass-bg-heavy);
}

.key-badge:focus-visible {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-light);
}

.key-badge.recording {
  border-color: var(--accent);
  color: var(--accent);
  background: var(--accent-light);
  box-shadow: 0 0 0 3px var(--accent-light);
}

.key-label {
  display: block;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}

.recording-dot {
  width: 6px;
  height: 6px;
  flex: 0 0 6px;
  border-radius: 50%;
  background: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-light);
  animation: blink 0.8s ease-in-out infinite;
}

.clear-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  transition: all 0.15s;
  flex-shrink: 0;
}

.clear-btn:hover {
  background: var(--glass-bg-light);
  color: var(--error);
}

@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}

@media (max-width: 420px) {
  .shortcut-card {
    align-items: stretch;
    flex-direction: column;
    gap: var(--space-sm);
  }

  .shortcut-actions {
    width: 100%;
  }

  .key-badge {
    flex: 1;
    max-width: none;
  }
}
</style>
