<script setup lang="ts">
import { ref, onMounted, watch, computed } from "vue";
import { useI18n } from "vue-i18n";
import { getMemberSettings, getTeamClientInstance, getBrainsSync } from "../../composables/teamClientContext";
import { useToast } from "../../composables/useToast";
import { useConfirm } from "../../composables/useConfirm";
import { isTauri } from "../../utils/platform";
import BackButton from "../BackButton";
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

// UI state (local, not synced until Apply is clicked)
const syncInterval = ref(false);
const syncAfterTask = ref(false);
const syncIntervalHours = ref(1);
const syncIntervalMinutes = ref(30);

// Track if there are unsaved changes
const hasChanges = computed(() => {
  const savedTriggers = settings.value.brains_sync_triggers;
  return (
    syncInterval.value !== savedTriggers.includes("interval") ||
    syncAfterTask.value !== savedTriggers.includes("after_task") ||
    syncIntervalHours.value !== settings.value.brains_sync_interval_hours ||
    syncIntervalMinutes.value !== settings.value.brains_sync_interval_minutes
  );
});

onMounted(async () => {
  await loadSettings(username);
  syncInterval.value = settings.value.brains_sync_triggers.includes("interval");
  syncAfterTask.value = settings.value.brains_sync_triggers.includes("after_task");
  syncIntervalHours.value = settings.value.brains_sync_interval_hours;
  syncIntervalMinutes.value = settings.value.brains_sync_interval_minutes;
});

async function applySettings() {
  const triggers: ("interval" | "after_task")[] = [];
  if (syncInterval.value) triggers.push("interval");
  if (syncAfterTask.value) triggers.push("after_task");

  const hours = Math.max(0, Math.min(23, syncIntervalHours.value));
  const minutes = Math.max(0, Math.min(59, syncIntervalMinutes.value));

  // Validate: if interval trigger is enabled, at least some time must be set
  if (syncInterval.value && hours === 0 && minutes === 0) {
    showToast(t("settings.intervalMustBePositive"), "error");
    return;
  }

  saving.value = true;
  try {
    await saveSettings(username, {
      brains_sync_triggers: triggers,
      brains_sync_interval_hours: hours,
      brains_sync_interval_minutes: minutes,
    });
    // Only start the timer after Apply is clicked
    brainsSync.setupTriggers(username);
    brainsSync.registerTaskListener();
    showToast(t("settings.settingsApplied"), "success");
  } catch {
    syncInterval.value = settings.value.brains_sync_triggers.includes("interval");
    syncAfterTask.value = settings.value.brains_sync_triggers.includes("after_task");
    syncIntervalHours.value = settings.value.brains_sync_interval_hours;
    syncIntervalMinutes.value = settings.value.brains_sync_interval_minutes;
  }
  saving.value = false;
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
        showToast(t('common.operationFailed') + ': ' + brainsSync.syncError.value, "error");
        brainsSync.syncError.value = null;
      }
    },
    true,
  );
}

function triggerSync() {
  brainsSync.doSync().then((result) => {
    if (result && result.uploaded === 0 && result.deleted === 0) {
      showToast(t('settings.brainsSyncNoChange'), "info");
    }
  });
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
      <span class="header-title">{{ t('settings.groupKnowledge') }}</span>
      <BackButton @click="emit('back')" />
    </div>

    <div class="settings-body">
      <section v-if="isTauri" class="settings-section">
        <h3 class="section-title">{{ t('settings.brainsSyncTitle') }}</h3>
        <div class="section-body">
          <div class="setting-group">
            <GlassCheckbox v-model="syncInterval">{{ t('settings.brainsSyncInterval') }}</GlassCheckbox>
            <div v-if="syncInterval" class="sync-interval-row">
              <GlassInput
                v-model.number="syncIntervalHours"
                type="number"
                min="0"
                max="23"
                step="1"
                class="sync-interval-input"
              />
              <span class="setting-hint">{{ t('settings.brainsSyncHoursUnit') }}</span>
              <GlassInput
                v-model.number="syncIntervalMinutes"
                type="number"
                min="0"
                max="59"
                step="5"
                class="sync-interval-input"
              />
              <span class="setting-hint">{{ t('settings.brainsSyncMinutesUnit') }}</span>
            </div>
          </div>

          <div class="setting-group">
            <GlassCheckbox v-model="syncAfterTask">{{ t('settings.brainsSyncAfterTask') }}</GlassCheckbox>
            <p class="setting-hint">{{ t('settings.brainsSyncAfterTaskHint') }}</p>
          </div>

          <!-- Apply button -->
          <div class="setting-group apply-row">
            <GlassButton :disabled="!hasChanges || saving" @click="applySettings">
              {{ saving ? t('settings.saving') : t('settings.apply') }}
            </GlassButton>
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
              <GlassButton @click="triggerSync">{{ t('settings.brainsSyncRetry') }}</GlassButton>
            </template>

            <!-- Idle / success state -->
            <template v-else>
              <GlassButton :disabled="brainsSync.syncing.value" @click="triggerSync">
                {{ t('settings.brainsSyncNow') }}
              </GlassButton>
              <p v-if="formattedLastSync" class="sync-status-text success-text">
                {{ t('settings.brainsSyncLastSync', { time: formattedLastSync }) }}
              </p>
            </template>
          </div>

          <!-- Restore (danger, separate) -->
          <div class="setting-group">
            <label class="setting-label">{{ t('settings.brainsRestore') }}</label>
            <p class="setting-hint">{{ t('settings.brainsRestoreHint') }}</p>
            <GlassButton variant="danger" :disabled="brainsSync.syncing.value" @click="triggerRestore">
              {{ t('settings.brainsRestore') }}
            </GlassButton>
          </div>
        </div>
      </section>
    </div>

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
  flex-wrap: wrap;
}

.sync-interval-input {
  width: 70px;
}

.apply-row {
  margin-top: var(--space-md);
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
</style>
