import { ref } from "vue";
import { isTauri, safeInvoke } from "../utils/platform";

export type TaskExecutionMode = "manual" | "auto";

export interface MemberSettings {
  working_directory: string;
  task_execution_mode: TaskExecutionMode;
  ai_suggestion_history_count: number;
  ai_auto_reply: boolean;
  shortcut_auto_reply: string;
  shortcut_execution_mode: string;
  shortcut_lock_screen: string;
  shortcut_sync_now: string;
  shortcut_restore_brains: string;
  brains_sync_triggers: ("interval" | "after_task")[];
  brains_sync_interval_hours: number;
  brains_sync_interval_minutes: number;
}

const DEFAULT_SETTINGS: MemberSettings = {
  working_directory: "",
  task_execution_mode: "auto",
  ai_suggestion_history_count: 5,
  ai_auto_reply: false,
  shortcut_auto_reply: "",
  shortcut_execution_mode: "",
  shortcut_lock_screen: "",
  shortcut_sync_now: "",
  shortcut_restore_brains: "",
  brains_sync_triggers: [],
  brains_sync_interval_hours: 1,
  brains_sync_interval_minutes: 30,
};

const _settings = ref<MemberSettings>({ ...DEFAULT_SETTINGS });

const _loaded = ref(false);

export function useMemberSettings() {
  async function loadSettings(username: string): Promise<MemberSettings> {
    if (!isTauri) {
      _settings.value = { ...DEFAULT_SETTINGS };
      _loaded.value = true;
      return _settings.value;
    }

    try {
      const raw = await safeInvoke("get_settings", {}) as Record<string, unknown> | null;
      const users = (raw?.users ?? {}) as Record<string, unknown>;
      const userSettings = (users[username] ?? {}) as Record<string, unknown>;

      _settings.value = {
        working_directory: (userSettings.working_directory as string) ?? DEFAULT_SETTINGS.working_directory,
        task_execution_mode: (userSettings.task_execution_mode as TaskExecutionMode) ?? DEFAULT_SETTINGS.task_execution_mode,
        ai_suggestion_history_count: typeof userSettings.ai_suggestion_history_count === "number"
          ? userSettings.ai_suggestion_history_count
          : DEFAULT_SETTINGS.ai_suggestion_history_count,
        ai_auto_reply: typeof userSettings.ai_auto_reply === "boolean"
          ? userSettings.ai_auto_reply
          : DEFAULT_SETTINGS.ai_auto_reply,
        shortcut_auto_reply: typeof userSettings.shortcut_auto_reply === "string"
          ? userSettings.shortcut_auto_reply
          : DEFAULT_SETTINGS.shortcut_auto_reply,
        shortcut_execution_mode: typeof userSettings.shortcut_execution_mode === "string"
          ? userSettings.shortcut_execution_mode
          : DEFAULT_SETTINGS.shortcut_execution_mode,
        shortcut_lock_screen: typeof userSettings.shortcut_lock_screen === "string"
          ? userSettings.shortcut_lock_screen
          : DEFAULT_SETTINGS.shortcut_lock_screen,
        shortcut_sync_now: typeof userSettings.shortcut_sync_now === "string"
          ? userSettings.shortcut_sync_now
          : DEFAULT_SETTINGS.shortcut_sync_now,
        shortcut_restore_brains: typeof userSettings.shortcut_restore_brains === "string"
          ? userSettings.shortcut_restore_brains
          : DEFAULT_SETTINGS.shortcut_restore_brains,
        brains_sync_triggers: Array.isArray(userSettings.brains_sync_triggers)
          ? userSettings.brains_sync_triggers
          : DEFAULT_SETTINGS.brains_sync_triggers,
        brains_sync_interval_hours: typeof userSettings.brains_sync_interval_hours === "number"
          ? userSettings.brains_sync_interval_hours
          : DEFAULT_SETTINGS.brains_sync_interval_hours,
        brains_sync_interval_minutes: typeof userSettings.brains_sync_interval_minutes === "number"
          ? userSettings.brains_sync_interval_minutes
          : DEFAULT_SETTINGS.brains_sync_interval_minutes,
      };
    } catch (e) {
      console.error(`[settings] loadSettings failed for ${username}:`, e);
      _settings.value = { ...DEFAULT_SETTINGS };
    }

    _loaded.value = true;
    return _settings.value;
  }

  async function saveSettings(username: string, updates: Partial<MemberSettings>): Promise<void> {
    // Always update in-memory settings immediately (even in browser mode)
    if (updates.ai_auto_reply !== undefined) {
      _settings.value.ai_auto_reply = updates.ai_auto_reply;
    }
    if (updates.ai_suggestion_history_count !== undefined) {
      _settings.value.ai_suggestion_history_count = updates.ai_suggestion_history_count;
    }
    if (updates.task_execution_mode !== undefined) {
      _settings.value.task_execution_mode = updates.task_execution_mode;
    }
    if (updates.working_directory !== undefined) {
      _settings.value.working_directory = updates.working_directory;
    }
    if (updates.shortcut_auto_reply !== undefined) {
      _settings.value.shortcut_auto_reply = updates.shortcut_auto_reply;
    }
    if (updates.shortcut_execution_mode !== undefined) {
      _settings.value.shortcut_execution_mode = updates.shortcut_execution_mode;
    }
    if (updates.shortcut_lock_screen !== undefined) {
      _settings.value.shortcut_lock_screen = updates.shortcut_lock_screen;
    }
    if (updates.shortcut_sync_now !== undefined) {
      _settings.value.shortcut_sync_now = updates.shortcut_sync_now;
    }
    if (updates.shortcut_restore_brains !== undefined) {
      _settings.value.shortcut_restore_brains = updates.shortcut_restore_brains;
    }
    if (updates.brains_sync_triggers !== undefined) {
      _settings.value.brains_sync_triggers = updates.brains_sync_triggers;
    }
    if (updates.brains_sync_interval_hours !== undefined) {
      _settings.value.brains_sync_interval_hours = updates.brains_sync_interval_hours;
    }
    if (updates.brains_sync_interval_minutes !== undefined) {
      _settings.value.brains_sync_interval_minutes = updates.brains_sync_interval_minutes;
    }

    if (!isTauri) return;

    const raw = await safeInvoke("get_settings", {}) as Record<string, unknown> | null;
    const settings = { ...(raw ?? {}) };
    const users = { ...((settings.users ?? {}) as Record<string, unknown>) };
    const existing = { ...((users[username] ?? {}) as Record<string, unknown>) };

    if (updates.working_directory !== undefined) existing.working_directory = updates.working_directory;
    if (updates.task_execution_mode !== undefined) existing.task_execution_mode = updates.task_execution_mode;
    if (updates.ai_suggestion_history_count !== undefined) existing.ai_suggestion_history_count = updates.ai_suggestion_history_count;
    if (updates.ai_auto_reply !== undefined) existing.ai_auto_reply = updates.ai_auto_reply;
    if (updates.shortcut_auto_reply !== undefined) existing.shortcut_auto_reply = updates.shortcut_auto_reply;
    if (updates.shortcut_execution_mode !== undefined) existing.shortcut_execution_mode = updates.shortcut_execution_mode;
    if (updates.shortcut_lock_screen !== undefined) existing.shortcut_lock_screen = updates.shortcut_lock_screen;
    if (updates.shortcut_sync_now !== undefined) existing.shortcut_sync_now = updates.shortcut_sync_now;
    if (updates.shortcut_restore_brains !== undefined) existing.shortcut_restore_brains = updates.shortcut_restore_brains;
    if (updates.brains_sync_triggers !== undefined) existing.brains_sync_triggers = updates.brains_sync_triggers;
    if (updates.brains_sync_interval_hours !== undefined) existing.brains_sync_interval_hours = updates.brains_sync_interval_hours;
    if (updates.brains_sync_interval_minutes !== undefined) existing.brains_sync_interval_minutes = updates.brains_sync_interval_minutes;

    users[username] = existing;
    settings.users = users;

    await safeInvoke("save_settings", { settings });
  }

  return {
    settings: _settings,
    loaded: _loaded,
    loadSettings,
    saveSettings,
    async toggleAutoReply(username: string, onDispose?: () => void) {
      const next = !_settings.value.ai_auto_reply;
      await saveSettings(username, { ai_auto_reply: next });
      if (!next) onDispose?.();
    },
    async toggleExecutionMode(username: string) {
      const next: TaskExecutionMode = _settings.value.task_execution_mode === "auto" ? "manual" : "auto";
      await saveSettings(username, { task_execution_mode: next });
    },
  };
}
