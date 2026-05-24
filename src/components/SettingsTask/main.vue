<script setup lang="ts">
import { ref, onMounted, watch, computed } from "vue";
import { useI18n } from "vue-i18n";
import { getMemberSettings, getTeamClientInstance, getBrainsSync } from "../../composables/teamClientContext";
import type { TaskExecutionMode } from "../../composables/useMemberSettings";
import { useToast } from "../../composables/useToast";
import { useConfirm } from "../../composables/useConfirm";
import { isTauri } from "../../utils/platform";
import BackButton from "../BackButton";
import GlassSelect from "../GlassSelect";
import GlassInput from "../GlassInput";
import GlassCheckbox from "../GlassCheckbox";
import GlassButton from "../GlassButton";
import Toast from "../Toast";
import ConfirmDialog from "../ConfirmDialog";

const { t } = useI18n();
const emit = defineEmits<{ back: [] }>();

const { settings, loadSettings, saveSettings } = getMemberSettings();
const ctx = getTeamClientInstance()!;
const username = ctx.myId;
const saving = ref(false);

const { toastVisible, toastMessage, toastType, showToast, hideToast } = useToast();
const { confirmVisible, confirmTitle, confirmMessage, confirmDanger, showConfirm, handleConfirm, handleCancel } = useConfirm();

const brainsSync = getBrainsSync();

const executionMode = ref<TaskExecutionMode>("auto");
const workingDirectory = ref("");
const syncInterval = ref(false);
const syncAfterTask = ref(false);
const syncIntervalHours = ref(1);

onMounted(async () => {
  await loadSettings(username);
  executionMode.value = settings.value.task_execution_mode;
  workingDirectory.value = settings.value.working_directory;
  syncInterval.value = settings.value.brains_sync_triggers.includes("interval");
  syncAfterTask.value = settings.value.brains_sync_triggers.includes("after_task");
  syncIntervalHours.value = settings.value.brains_sync_interval_hours;
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

async function saveSyncTriggers() {
  const triggers: ("interval" | "after_task")[] = [];
  if (syncInterval.value) triggers.push("interval");
  if (syncAfterTask.value) triggers.push("after_task");

  const hours = Math.max(0.5, Math.min(24, syncIntervalHours.value));

  saving.value = true;
  try {
    await saveSettings(username, { brains_sync_triggers: triggers, brains_sync_interval_hours: hours });
    brainsSync.setupTriggers(username);
    brainsSync.registerTaskListener();
  } catch {
    syncInterval.value = settings.value.brains_sync_triggers.includes("interval");
    syncAfterTask.value = settings.value.brains_sync_triggers.includes("after_task");
    syncIntervalHours.value = settings.value.brains_sync_interval_hours;
  }
  saving.value = false;
}

async function saveSyncIntervalHours() {
  const val = Math.max(0.5, Math.min(24, syncIntervalHours.value));
  syncIntervalHours.value = val;
  if (val === settings.value.brains_sync_interval_hours) return;
  await saveSyncTriggers();
}

function triggerRestore() {
  showConfirm(
    t('settings.brainsRestoreConfirmTitle'),
    t('settings.brainsRestoreConfirmMsg'),
    async () => {
      await brainsSync.doRestore();
      if (!brainsSync.syncError.value) {
        showToast(t('settings.brainsRestoreSuccess'), "success");
      } else {
        showToast(t('common.operationFailed'), "error");
      }
    },
    true,
  );
}

function triggerRetry() {
  void brainsSync.doSync();
}

const syncProgressText = computed(() => {
  if (!brainsSync.syncing.value) return "";
  const { current, total } = brainsSync.syncProgress.value;
  return t('settings.brainsSyncProgress', { current, total });
});

const syncProgressPct = computed(() => {
  const { current, total } = brainsSync.syncProgress.value;
  if (total === 0) return 0;
  return Math.round((current / total) * 100);
});

const formattedLastSync = computed(() => {
  const iso = brainsSync.lastSyncAt.value;
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
});
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
            <GlassInput
              v-model="workingDirectory"
              type="text"
              :placeholder="t('settings.workingDirectoryPlaceholder')"
              @blur="saveWorkingDirectory"
              @keydown.enter="saveWorkingDirectory"
            />
            <p class="setting-hint">{{ t('settings.workingDirectoryHint') }}</p>
          </div>
        </div>
      </section>

      <!-- Brains Cloud Sync Section -->
      <section v-if="isTauri" class="settings-section">
        <h3 class="section-title">{{ t('settings.brainsSyncTitle') }}</h3>
        <div class="section-body">
          <div class="setting-group">
            <GlassCheckbox v-model="syncInterval" @change="saveSyncTriggers">{{ t('settings.brainsSyncInterval') }}</GlassCheckbox>
            <div v-if="syncInterval" class="sync-interval-row">
              <GlassInput
                v-model.number="syncIntervalHours"
                type="number"
                min="0.5"
                max="24"
                step="0.5"
                class="sync-interval-input"
                @blur="saveSyncIntervalHours"
                @keydown.enter="saveSyncIntervalHours"
              />
              <span class="setting-hint">{{ t('settings.brainsSyncHoursUnit') }}</span>
            </div>
          </div>

          <div class="setting-group">
            <GlassCheckbox v-model="syncAfterTask" @change="saveSyncTriggers">{{ t('settings.brainsSyncAfterTask') }}</GlassCheckbox>
            <p class="setting-hint">{{ t('settings.brainsSyncAfterTaskHint') }}</p>
          </div>

          <!-- Sync status -->
          <div class="sync-status">
            <!-- Syncing in progress -->
            <template v-if="brainsSync.syncing.value">
              <div class="sync-progress">
                <div class="sync-progress-bar" :style="{ width: syncProgressPct + '%' }"></div>
              </div>
              <p class="sync-status-text syncing-text">
                {{ syncProgressText }}
                <span v-if="brainsSync.currentFile.value" class="sync-current-file">{{ brainsSync.currentFile.value }}</span>
              </p>
            </template>

            <!-- Error state -->
            <template v-else-if="brainsSync.syncError.value">
              <p class="sync-status-text error-text">{{ brainsSync.syncError.value }}</p>
              <GlassButton size="small" @click="triggerRetry">{{ t('settings.brainsSyncRetry') }}</GlassButton>
            </template>

            <!-- Idle / success state -->
            <template v-else-if="formattedLastSync">
              <p class="sync-status-text success-text">
                {{ t('settings.brainsSyncLastSync', { time: formattedLastSync }) }}
              </p>
            </template>

            <div class="sync-actions">
              <GlassButton variant="danger" size="small" :disabled="brainsSync.syncing.value" @click="triggerRestore">
                {{ t('settings.brainsRestore') }}
              </GlassButton>
            </div>
          </div>
        </div>
      </section>
    </div>

    <div v-if="saving" class="saving-indicator">{{ t('settings.saving') }}</div>

    <Toast :visible="toastVisible" :message="toastMessage" :type="toastType" @done="hideToast" />
    <ConfirmDialog
      :visible="confirmVisible"
      :title="confirmTitle"
      :message="confirmMessage"
      :danger="confirmDanger"
      @confirm="handleConfirm"
      @cancel="handleCancel"
    />
  </div>
</template>

<style scoped>
@import '../SettingsPanel/styles.css';

.sync-interval-row {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  margin-top: var(--space-xs);
}

.sync-interval-input {
  width: 80px;
}

.sync-status {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  padding: var(--space-sm) 0;
}

.sync-progress {
  height: 3px;
  background: var(--glass-border);
  border-radius: 2px;
  overflow: hidden;
}

.sync-progress-bar {
  height: 100%;
  background: var(--accent);
  transition: width 0.2s;
  border-radius: 2px;
}

.sync-status-text {
  margin: 0;
  font-size: 0.78em;
  line-height: 1.4;
}

.sync-current-file {
  display: block;
  color: var(--text-muted);
  font-size: 0.9em;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
}

.syncing-text {
  color: var(--accent);
}

.error-text {
  color: var(--error);
}

.success-text {
  color: var(--text-muted);
}

.sync-actions {
  margin-top: var(--space-xs);
}
</style>
