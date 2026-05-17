<script setup lang="ts">
import { inject, ref, onMounted, onUnmounted } from "vue";
import { getMemberSettings, TeamClientKey } from "../composables/teamClientContext";
import { isRecordingShortcut, buildCombo } from "../composables/useGlobalShortcuts";
import BackButton from "./BackButton.vue";

const emit = defineEmits<{
  back: [];
}>();

type ShortcutType = "auto_reply" | "execution_mode";

const ctx = inject(TeamClientKey)!;
const { settings, loadSettings, saveSettings } = getMemberSettings();
const username = ctx.myId;

const recording = ref<ShortcutType | null>(null);
const shortcutAutoReply = ref("");
const shortcutExecutionMode = ref("");

onMounted(async () => {
  await loadSettings(username);
  shortcutAutoReply.value = settings.value.shortcut_auto_reply;
  shortcutExecutionMode.value = settings.value.shortcut_execution_mode;
  window.addEventListener("keydown", handleRecordingKey, true);
});

onUnmounted(() => {
  window.removeEventListener("keydown", handleRecordingKey, true);
  cancelRecording();
});

function startRecording(type: ShortcutType) {
  recording.value = type;
  isRecordingShortcut.value = true;
}

function cancelRecording() {
  recording.value = null;
  isRecordingShortcut.value = false;
}

function handleRecordingKey(e: KeyboardEvent) {
  if (!recording.value) return;

  e.preventDefault();
  e.stopPropagation();

  if (e.key === "Escape") {
    cancelRecording();
    return;
  }

  const combo = buildCombo(e);
  if (!combo) return;

  const type = recording.value;
  const field = type === "auto_reply" ? "shortcut_auto_reply" : "shortcut_execution_mode";
  saveSettings(username, { [field]: combo });

  if (type === "auto_reply") shortcutAutoReply.value = combo;
  else shortcutExecutionMode.value = combo;

  cancelRecording();
}

function clearShortcut(type: ShortcutType) {
  const field = type === "auto_reply" ? "shortcut_auto_reply" : "shortcut_execution_mode";
  saveSettings(username, { [field]: "" });
  if (type === "auto_reply") shortcutAutoReply.value = "";
  else shortcutExecutionMode.value = "";
}
</script>

<template>
  <div class="quick-panel">
    <div class="quick-panel-header">
      <span class="header-title">快捷键</span>
      <BackButton @click="emit('back')" />
    </div>

    <div class="quick-panel-body">
      <div class="shortcut-card">
        <div class="shortcut-info">
          <span class="shortcut-label">AI 托管任务</span>
          <span class="shortcut-desc">切换自动 / 手动执行模式</span>
        </div>
        <div class="shortcut-actions">
          <button
            class="key-badge"
            :class="{ recording: recording === 'execution_mode' }"
            @click="startRecording('execution_mode')"
          >
            <template v-if="recording === 'execution_mode'">
              <span class="recording-dot" />
              按下快捷键...
            </template>
            <template v-else-if="shortcutExecutionMode">
              {{ shortcutExecutionMode }}
            </template>
            <template v-else>
              点击录制
            </template>
          </button>
          <button
            v-if="shortcutExecutionMode && recording !== 'execution_mode'"
            class="clear-btn"
            title="清除快捷键"
            @click="clearShortcut('execution_mode')"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>

      <div class="shortcut-card">
        <div class="shortcut-info">
          <span class="shortcut-label">AI 自动回复</span>
          <span class="shortcut-desc">开关 AI 自动回复聊天消息</span>
        </div>
        <div class="shortcut-actions">
          <button
            class="key-badge"
            :class="{ recording: recording === 'auto_reply' }"
            @click="startRecording('auto_reply')"
          >
            <template v-if="recording === 'auto_reply'">
              <span class="recording-dot" />
              按下快捷键...
            </template>
            <template v-else-if="shortcutAutoReply">
              {{ shortcutAutoReply }}
            </template>
            <template v-else>
              点击录制
            </template>
          </button>
          <button
            v-if="shortcutAutoReply && recording !== 'auto_reply'"
            class="clear-btn"
            title="清除快捷键"
            @click="clearShortcut('auto_reply')"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>

      <p class="shortcut-hint">
        需要至少一个修饰键（Ctrl / Alt / Meta），按 Esc 取消录制
      </p>
    </div>
  </div>
</template>

<style scoped>
.quick-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: transparent;
}

.quick-panel-header {
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

.header-title {
  font-weight: 600;
  color: var(--text-primary);
}

.quick-panel-body {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-lg);
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.shortcut-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-md);
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
}

.shortcut-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.key-badge {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 12px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--glass-border);
  background: var(--glass-bg-light);
  color: var(--text-secondary);
  font-size: 0.82em;
  font-family: monospace;
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
}

.key-badge:hover {
  border-color: var(--accent);
  color: var(--text-primary);
}

.key-badge.recording {
  border-color: var(--accent);
  color: var(--accent);
  animation: pulse-border 1.2s ease-in-out infinite;
}

.recording-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--accent);
  animation: blink 0.8s ease-in-out infinite;
}

@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}

@keyframes pulse-border {
  0%, 100% { border-color: var(--accent); }
  50% { border-color: transparent; }
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

.shortcut-hint {
  margin: 0;
  font-size: 0.75em;
  color: var(--text-muted);
  text-align: center;
  line-height: 1.4;
}
</style>
