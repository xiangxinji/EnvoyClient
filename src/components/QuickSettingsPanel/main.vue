<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";
import { useI18n } from "vue-i18n";
import { getMemberSettings, getTeamClientInstance } from "../../composables/teamClientContext";
import { isRecordingShortcut, buildCombo } from "../../composables/useGlobalShortcuts";
import BackButton from "../BackButton";
import SvgIcon from "../SvgIcon";

useI18n();

const emit = defineEmits<{
  back: [];
}>();

type ShortcutType = "auto_reply" | "execution_mode" | "lock_screen" | "sync_now" | "restore_brains";

const ctx = getTeamClientInstance()!;
const { settings, loadSettings, saveSettings } = getMemberSettings();
const username = ctx.myId;

const recording = ref<ShortcutType | null>(null);
const shortcutAutoReply = ref("");
const shortcutExecutionMode = ref("");
const shortcutLockScreen = ref("");
const shortcutSyncNow = ref("");
const shortcutRestoreBrains = ref("");

onMounted(async () => {
  await loadSettings(username);
  shortcutAutoReply.value = settings.value.shortcut_auto_reply;
  shortcutExecutionMode.value = settings.value.shortcut_execution_mode;
  shortcutLockScreen.value = settings.value.shortcut_lock_screen;
  shortcutSyncNow.value = settings.value.shortcut_sync_now;
  shortcutRestoreBrains.value = settings.value.shortcut_restore_brains;
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
  const fieldMap: Record<ShortcutType, string> = {
    auto_reply: "shortcut_auto_reply",
    execution_mode: "shortcut_execution_mode",
    lock_screen: "shortcut_lock_screen",
    sync_now: "shortcut_sync_now",
    restore_brains: "shortcut_restore_brains",
  };
  const refMap: Record<ShortcutType, typeof shortcutAutoReply> = {
    auto_reply: shortcutAutoReply,
    execution_mode: shortcutExecutionMode,
    lock_screen: shortcutLockScreen,
    sync_now: shortcutSyncNow,
    restore_brains: shortcutRestoreBrains,
  };
  saveSettings(username, { [fieldMap[type]]: combo });
  refMap[type].value = combo;

  cancelRecording();
}

function clearShortcut(type: ShortcutType) {
  const fieldMap: Record<ShortcutType, string> = {
    auto_reply: "shortcut_auto_reply",
    execution_mode: "shortcut_execution_mode",
    lock_screen: "shortcut_lock_screen",
    sync_now: "shortcut_sync_now",
    restore_brains: "shortcut_restore_brains",
  };
  const refMap: Record<ShortcutType, typeof shortcutAutoReply> = {
    auto_reply: shortcutAutoReply,
    execution_mode: shortcutExecutionMode,
    lock_screen: shortcutLockScreen,
    sync_now: shortcutSyncNow,
    restore_brains: shortcutRestoreBrains,
  };
  saveSettings(username, { [fieldMap[type]]: "" });
  refMap[type].value = "";
}
</script>

<template>
  <div class="quick-panel">
    <div class="quick-panel-header">
      <span class="header-title">{{ $t('shortcut.title') }}</span>
      <BackButton @click="emit('back')" />
    </div>

    <div class="quick-panel-body">
      <!-- AI Section -->
      <div class="shortcut-section-label">{{ $t('shortcut.sectionAI') }}</div>

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
            <SvgIcon name="close" :size="12" />
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
            <SvgIcon name="close" :size="12" />
          </button>
        </div>
      </div>

      <!-- Knowledge Base Section -->
      <div class="shortcut-section-label">{{ $t('shortcut.sectionKnowledge') }}</div>

      <div class="shortcut-card">
        <div class="shortcut-info">
          <span class="shortcut-label">{{ $t('shortcut.syncNow') }}</span>
          <span class="shortcut-desc">{{ $t('shortcut.syncNowDesc') }}</span>
        </div>
        <div class="shortcut-actions">
          <button
            class="key-badge"
            :class="{ recording: recording === 'sync_now' }"
            @click="startRecording('sync_now')"
          >
            <template v-if="recording === 'sync_now'">
              <span class="recording-dot" />
              {{ $t('shortcut.pressing') }}
            </template>
            <template v-else-if="shortcutSyncNow">
              {{ shortcutSyncNow }}
            </template>
            <template v-else>
              {{ $t('shortcut.clickToRecord') }}
            </template>
          </button>
          <button
            v-if="shortcutSyncNow && recording !== 'sync_now'"
            class="clear-btn"
            :title="$t('shortcut.clearShortcut')"
            @click="clearShortcut('sync_now')"
          >
            <SvgIcon name="close" :size="12" />
          </button>
        </div>
      </div>

      <div class="shortcut-card">
        <div class="shortcut-info">
          <span class="shortcut-label">{{ $t('shortcut.restoreBrains') }}</span>
          <span class="shortcut-desc">{{ $t('shortcut.restoreBrainsDesc') }}</span>
        </div>
        <div class="shortcut-actions">
          <button
            class="key-badge"
            :class="{ recording: recording === 'restore_brains' }"
            @click="startRecording('restore_brains')"
          >
            <template v-if="recording === 'restore_brains'">
              <span class="recording-dot" />
              {{ $t('shortcut.pressing') }}
            </template>
            <template v-else-if="shortcutRestoreBrains">
              {{ shortcutRestoreBrains }}
            </template>
            <template v-else>
              {{ $t('shortcut.clickToRecord') }}
            </template>
          </button>
          <button
            v-if="shortcutRestoreBrains && recording !== 'restore_brains'"
            class="clear-btn"
            :title="$t('shortcut.clearShortcut')"
            @click="clearShortcut('restore_brains')"
          >
            <SvgIcon name="close" :size="12" />
          </button>
        </div>
      </div>

      <!-- System Section -->
      <div class="shortcut-section-label">{{ $t('shortcut.sectionSystem') }}</div>

      <div class="shortcut-card">
        <div class="shortcut-info">
          <span class="shortcut-label">{{ $t('shortcut.lockScreen') }}</span>
          <span class="shortcut-desc">{{ $t('shortcut.lockScreenDesc') }}</span>
        </div>
        <div class="shortcut-actions">
          <button
            class="key-badge"
            :class="{ recording: recording === 'lock_screen' }"
            @click="startRecording('lock_screen')"
          >
            <template v-if="recording === 'lock_screen'">
              <span class="recording-dot" />
              {{ $t('shortcut.pressing') }}
            </template>
            <template v-else-if="shortcutLockScreen">
              {{ shortcutLockScreen }}
            </template>
            <template v-else>
              {{ $t('shortcut.clickToRecord') }}
            </template>
          </button>
          <button
            v-if="shortcutLockScreen && recording !== 'lock_screen'"
            class="clear-btn"
            :title="$t('shortcut.clearShortcut')"
            @click="clearShortcut('lock_screen')"
          >
            <SvgIcon name="close" :size="12" />
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

.shortcut-section-label {
  font-size: 0.85em;
  font-weight: 600;
  color: var(--text-muted);
  margin-bottom: var(--space-sm);
  margin-top: var(--space-md);
}

.shortcut-section-label:first-child {
  margin-top: 0;
}
</style>
