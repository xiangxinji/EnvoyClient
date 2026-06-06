<script setup lang="ts">
import { computed, ref, onMounted } from "vue";
import { useI18n } from "vue-i18n";
import { getMemberSettings, getTeamClientInstance } from "../../composables/teamClientContext";
import BackButton from "../BackButton";
import GlassCheckbox from "../GlassCheckbox";
import GlassInput from "../GlassInput";

const { t } = useI18n();
const emit = defineEmits<{ back: [] }>();

const { settings, loadSettings, saveSettings } = getMemberSettings();
const ctx = getTeamClientInstance()!;
const username = ctx.myId;
const saving = ref(false);

onMounted(() => loadSettings(username));

const aiAutoReply = computed({
  get: () => settings.value.ai_auto_reply,
  set: async (val: boolean) => {
    if (val === settings.value.ai_auto_reply) return;
    saving.value = true;
    try {
      await saveSettings(username, { ai_auto_reply: val });
      if (!val) ctx.autoReplyDispose?.();
    } catch {
      // Rollback: getter will re-read settings.value
    }
    saving.value = false;
  },
});

const aiHistoryCount = computed({
  get: () => settings.value.ai_suggestion_history_count,
  set: async (val: number) => {
    const clamped = Math.max(1, Math.min(50, Math.floor(val) || 5));
    if (clamped === settings.value.ai_suggestion_history_count) return;
    saving.value = true;
    try {
      await saveSettings(username, { ai_suggestion_history_count: clamped });
    } catch {
      // Rollback: getter will re-read settings.value
    }
    saving.value = false;
  },
});

function commitHistoryCount() {
  const clamped = Math.max(1, Math.min(50, Math.floor(aiHistoryCount.value) || 5));
  aiHistoryCount.value = clamped;
}
</script>

<template>
  <div class="settings-panel">
    <div class="settings-header">
      <span class="header-title">{{ t('settings.groupAI') }}</span>
      <BackButton @click="emit('back')" />
    </div>

    <div class="settings-body">
      <section class="settings-section">
        <div class="section-body">
          <div class="setting-group">
            <label class="setting-label">{{ t('settings.aiAutoReply') }}</label>
            <GlassCheckbox v-model="aiAutoReply">{{ t('settings.aiAutoReplyDesc') }}</GlassCheckbox>
            <p class="setting-hint">{{ t('settings.aiAutoReplyHint') }}</p>
          </div>

          <div class="setting-group">
            <label class="setting-label">{{ t('settings.aiHistoryCount') }}</label>
            <GlassInput
              v-model.number="aiHistoryCount"
              type="number"
              min="1"
              max="50"
              @blur="commitHistoryCount"
              @keydown.enter="commitHistoryCount"
            />
            <p class="setting-hint">{{ t('settings.aiHistoryCountHint') }}</p>
          </div>
        </div>
      </section>
    </div>

    <div v-if="saving" class="saving-indicator">{{ t('settings.saving') }}</div>
  </div>
</template>

<style scoped>
@import '../SettingsPanel/styles.css';
</style>
