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
}

const DEFAULT_SETTINGS: MemberSettings = {
  working_directory: "",
  task_execution_mode: "auto",
  ai_suggestion_history_count: 5,
  ai_auto_reply: false,
  shortcut_auto_reply: "",
  shortcut_execution_mode: "",
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
      };
    } catch (e) {
      console.error(`[settings] loadSettings failed for ${username}:`, e);
      _settings.value = { ...DEFAULT_SETTINGS };
    }

    _loaded.value = true;
    return _settings.value;
  }

  async function saveSettings(username: string, updates: Partial<MemberSettings>): Promise<void> {
    if (!isTauri) return;

    const raw = await safeInvoke("get_settings", {}) as Record<string, unknown> | null;
    const settings = { ...(raw ?? {}) };
    const users = { ...((settings.users ?? {}) as Record<string, unknown>) };
    const existing = { ...((users[username] ?? {}) as Record<string, unknown>) };

    if (updates.working_directory !== undefined) {
      existing.working_directory = updates.working_directory;
      _settings.value.working_directory = updates.working_directory;
    }
    if (updates.task_execution_mode !== undefined) {
      existing.task_execution_mode = updates.task_execution_mode;
      _settings.value.task_execution_mode = updates.task_execution_mode;
    }
    if (updates.ai_suggestion_history_count !== undefined) {
      existing.ai_suggestion_history_count = updates.ai_suggestion_history_count;
      _settings.value.ai_suggestion_history_count = updates.ai_suggestion_history_count;
    }
    if (updates.ai_auto_reply !== undefined) {
      existing.ai_auto_reply = updates.ai_auto_reply;
      _settings.value.ai_auto_reply = updates.ai_auto_reply;
    }
    if (updates.shortcut_auto_reply !== undefined) {
      existing.shortcut_auto_reply = updates.shortcut_auto_reply;
      _settings.value.shortcut_auto_reply = updates.shortcut_auto_reply;
    }
    if (updates.shortcut_execution_mode !== undefined) {
      existing.shortcut_execution_mode = updates.shortcut_execution_mode;
      _settings.value.shortcut_execution_mode = updates.shortcut_execution_mode;
    }

    users[username] = existing;
    settings.users = users;

    await safeInvoke("save_settings", { settings });
  }

  return {
    settings: _settings,
    loaded: _loaded,
    loadSettings,
    saveSettings,
  };
}
