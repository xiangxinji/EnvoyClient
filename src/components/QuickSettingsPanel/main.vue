<script setup lang="ts">
import { inject, ref, onMounted, onUnmounted } from "vue";
import { useI18n } from "vue-i18n";
import { getMemberSettings, TeamClientKey } from "../../composables/teamClientContext";
import { isRecordingShortcut, buildCombo } from "../../composables/useGlobalShortcuts";
import BackButton from "../BackButton";

useI18n();

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
      <span class="header-title">{{ $t('shortcut.title') }}</span>
      <BackButton @click="emit('back')" />
    </div>

    <div class="quick-panel-body">
      <div class="shortcut-card">
        <div class="shortcut-info">
          <span class="shortcut-label">{{ $t('shortcut.aiTaskMode') }}</span>
          <span class="shortcut-desc">{{ $t('shortcut.aiTaskModeDesc') }}</span>
        </div>
        <div class="shortcut-actions">
          <button
            class="key-badge"
            :class="{ recording: recording === 'execution_mode' }"
            @click="startRecording('execution_mode')"
          >
            <template v-if="recording === 'execution_mode'">
              <span class="recording-dot" />
              {{ $t('shortcut.pressing') }}
            </template>
            <template v-else-if="shortcutExecutionMode">
              {{ shortcutExecutionMode }}
            </template>
            <template v-else>
              {{ $t('shortcut.clickToRecord') }}
            </template>
          </button>
          <button
            v-if="shortcutExecutionMode && recording !== 'execution_mode'"
            class="clear-btn"
            :title="$t('shortcut.clearShortcut')"
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
          <span class="shortcut-label">{{ $t('shortcut.aiAutoReply') }}</span>
          <span class="shortcut-desc">{{ $t('shortcut.aiAutoReplyDesc') }}</span>
        </div>
        <div class="shortcut-actions">
          <button
            class="key-badge"
            :class="{ recording: recording === 'auto_reply' }"
            @click="startRecording('auto_reply')"
          >
            <template v-if="recording === 'auto_reply'">
              <span class="recording-dot" />
              {{ $t('shortcut.pressing') }}
            </template>
            <template v-else-if="shortcutAutoReply">
              {{ shortcutAutoReply }}
            </template>
            <template v-else>
              {{ $t('shortcut.clickToRecord') }}
            </template>
          </button>
          <button
            v-if="shortcutAutoReply && recording !== 'auto_reply'"
            class="clear-btn"
            :title="$t('shortcut.clearShortcut')"
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
        {{ $t('shortcut.recordHint') }}
      </p>
    </div>
  </div>
</template>

<style scoped>
@import './styles.css';
</style>
