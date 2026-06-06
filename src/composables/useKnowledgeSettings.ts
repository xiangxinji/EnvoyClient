import { ref, onMounted, computed } from "vue";
import { getMemberSettings, getTeamClientInstance, getBrainsSync } from "./teamClientContext";
import { useToast } from "./useToast";
import { useConfirm } from "./useConfirm";

export function useKnowledgeSettings(deps: { t: (key: string, params?: Record<string, unknown>) => string }) {
  const { t } = deps;
  const { settings, loadSettings, saveSettings } = getMemberSettings();
  const ctx = getTeamClientInstance()!;
  const username = ctx.myId;
  const brainsSync = getBrainsSync();
  const saving = ref(false);

  const { showToast, ...toastRest } = useToast();
  const { showConfirm, ...confirmRest } = useConfirm();

  // UI state (local, not synced until Apply is clicked)
  const syncInterval = ref(false);
  const syncAfterTask = ref(false);
  const syncIntervalHours = ref(1);
  const syncIntervalMinutes = ref(30);
  const reflectionMemory = ref(false);

  // Track if there are unsaved changes
  const hasChanges = computed(() => {
    const savedTriggers = settings.value.brains_sync_triggers;
    return (
      syncInterval.value !== savedTriggers.includes("interval") ||
      syncAfterTask.value !== savedTriggers.includes("after_task") ||
      syncIntervalHours.value !== settings.value.brains_sync_interval_hours ||
      syncIntervalMinutes.value !== settings.value.brains_sync_interval_minutes ||
      reflectionMemory.value !== settings.value.task_reflection_memory_enabled
    );
  });

  onMounted(async () => {
    await loadSettings(username);
    syncInterval.value = settings.value.brains_sync_triggers.includes("interval");
    syncAfterTask.value = settings.value.brains_sync_triggers.includes("after_task");
    syncIntervalHours.value = settings.value.brains_sync_interval_hours;
    syncIntervalMinutes.value = settings.value.brains_sync_interval_minutes;
    reflectionMemory.value = settings.value.task_reflection_memory_enabled;
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
        task_reflection_memory_enabled: reflectionMemory.value,
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
      reflectionMemory.value = settings.value.task_reflection_memory_enabled;
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
    brainsSync.doSync().then((result: { uploaded: number; deleted: number } | null) => {
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

  return {
    // State
    syncInterval, syncAfterTask, syncIntervalHours, syncIntervalMinutes,
    reflectionMemory, hasChanges, saving,
    // Sync progress
    brainsSync,
    syncProgressText, syncProgressPct, formattedLastSync,
    // Actions
    applySettings, triggerRestore, triggerSync,
    // Toast UI
    ...toastRest,
    ...confirmRest,
  };
}
