<script setup lang="ts">
import { ref, onMounted, onUnmounted, type Ref } from "vue";
import { useI18n } from "vue-i18n";
import { getMemberSettings, getTeamClientInstance } from "../../composables/teamClientContext";
import { isRecordingShortcut, buildCombo } from "../../composables/useGlobalShortcuts";
import BackButton from "../BackButton";
import ShortcutRow from "../ShortcutRow/main.vue";

useI18n();

const emit = defineEmits<{
  back: [];
}>();

type ShortcutType = "auto_reply" | "execution_mode" | "lock_screen" | "sync_now" | "restore_brains";

const ctx = getTeamClientInstance()!;
const { settings, loadSettings, saveSettings } = getMemberSettings();
const username = ctx.myId;

const recording = ref<ShortcutType | null>(null);

// Shared field/ref mapping (defined once, used by both handleRecordingKey and clearShortcut)
const shortcutDefs: { type: ShortcutType; field: string }[] = [
  { type: "auto_reply", field: "shortcut_auto_reply" },
  { type: "execution_mode", field: "shortcut_execution_mode" },
  { type: "lock_screen", field: "shortcut_lock_screen" },
  { type: "sync_now", field: "shortcut_sync_now" },
  { type: "restore_brains", field: "shortcut_restore_brains" },
];

const shortcutRefs = Object.fromEntries(shortcutDefs.map((d) => [d.type, ref("")])) as Record<ShortcutType, Ref<string>>;

const shortcutItems: { type: ShortcutType; labelKey: string; descKey: string; section?: string }[] = [
  { type: "execution_mode", labelKey: "shortcut.aiTaskMode", descKey: "shortcut.aiTaskModeDesc" },
  { type: "auto_reply", labelKey: "shortcut.aiAutoReply", descKey: "shortcut.aiAutoReplyDesc" },
  { type: "sync_now", labelKey: "shortcut.syncNow", descKey: "shortcut.syncNowDesc" },
  { type: "restore_brains", labelKey: "shortcut.restoreBrains", descKey: "shortcut.restoreBrainsDesc" },
  { type: "lock_screen", labelKey: "shortcut.lockScreen", descKey: "shortcut.lockScreenDesc" },
];

const sections = [
  { labelKey: "shortcut.sectionAI", types: ["execution_mode", "auto_reply"] as ShortcutType[] },
  { labelKey: "shortcut.sectionKnowledge", types: ["sync_now", "restore_brains"] as ShortcutType[] },
  { labelKey: "shortcut.sectionSystem", types: ["lock_screen"] as ShortcutType[] },
];

onMounted(async () => {
  await loadSettings(username);
  for (const d of shortcutDefs) {
    shortcutRefs[d.type].value = (settings.value as unknown as Record<string, string>)[d.field] ?? "";
  }
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
  const def = shortcutDefs.find((d) => d.type === type)!;
  saveSettings(username, { [def.field]: combo });
  shortcutRefs[type].value = combo;

  cancelRecording();
}

function clearShortcut(type: ShortcutType) {
  const def = shortcutDefs.find((d) => d.type === type)!;
  saveSettings(username, { [def.field]: "" });
  shortcutRefs[type].value = "";
}
</script>

<template>
  <div class="quick-panel">
    <div class="quick-panel-header">
      <span class="header-title">{{ $t('shortcut.title') }}</span>
      <BackButton @click="emit('back')" />
    </div>

    <div class="quick-panel-body">
      <template v-for="(section, si) in sections" :key="si">
        <div class="shortcut-section-label">{{ $t(section.labelKey) }}</div>
        <ShortcutRow
          v-for="item in section.types"
          :key="item"
          :label="$t(shortcutItems.find(s => s.type === item)!.labelKey)"
          :desc="$t(shortcutItems.find(s => s.type === item)!.descKey)"
          :shortcut="shortcutRefs[item].value"
          :is-recording="recording === item"
          @record="startRecording(item)"
          @clear="clearShortcut(item)"
        />
      </template>

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
