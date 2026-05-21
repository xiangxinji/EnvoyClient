<script setup lang="ts">
import { ref, onMounted, watch } from "vue";
import { useI18n } from "vue-i18n";
import { getMemberSettings, getTeamClientInstance } from "../../composables/teamClientContext";
import type { TaskExecutionMode } from "../../composables/useMemberSettings";
import BackButton from "../BackButton";
import GlassSelect from "../GlassSelect";

const { t } = useI18n();
const emit = defineEmits<{ back: [] }>();

const { settings, loadSettings, saveSettings } = getMemberSettings();
const ctx = getTeamClientInstance()!;
const username = ctx.myId;
const saving = ref(false);

const executionMode = ref<TaskExecutionMode>("auto");
const workingDirectory = ref("");

onMounted(async () => {
  await loadSettings(username);
  executionMode.value = settings.value.task_execution_mode;
  workingDirectory.value = settings.value.working_directory;
});

watch(executionMode, async (val) => {
  if (val === settings.value.task_execution_mode) return;
  saving.value = true;
  try {
    await saveSettings(username, { task_execution_mode: val });
  } catch {
    executionMode.value = settings.value.task_execution_mode;
  }
  saving.value = false;
});

async function saveWorkingDirectory() {
  if (workingDirectory.value === settings.value.working_directory) return;
  saving.value = true;
  try {
    await saveSettings(username, { working_directory: workingDirectory.value });
  } catch {
    workingDirectory.value = settings.value.working_directory;
  }
  saving.value = false;
}
</script>

<template>
  <div class="settings-panel">
    <div class="settings-header">
      <span class="header-title">{{ t('settings.groupTask') }}</span>
      <BackButton @click="emit('back')" />
    </div>

    <div class="settings-body">
      <section class="settings-section">
        <div class="section-body">
          <div class="setting-group">
            <label class="setting-label">{{ t('settings.taskMode') }}</label>
            <GlassSelect v-model="executionMode">
              <option value="manual">{{ t('settings.manual') }}</option>
              <option value="auto">{{ t('settings.auto') }}</option>
            </GlassSelect>
            <p class="setting-hint">
              {{ executionMode === 'auto' ? t('settings.autoHint') : t('settings.manualHint') }}
            </p>
          </div>

          <div class="setting-group">
            <label class="setting-label">{{ t('settings.workingDirectory') }}</label>
            <input
              v-model="workingDirectory"
              type="text"
              class="setting-input"
              :placeholder="t('settings.workingDirectoryPlaceholder')"
              @blur="saveWorkingDirectory"
              @keydown.enter="saveWorkingDirectory"
            />
            <p class="setting-hint">{{ t('settings.workingDirectoryHint') }}</p>
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
