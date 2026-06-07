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
  shortcut_screenshot: string;
  brains_sync_triggers: ("interval" | "after_task")[];
  brains_sync_interval_hours: number;
  brains_sync_interval_minutes: number;
  task_reflection_memory_enabled: boolean;
}

type FieldType = "string" | "number" | "boolean" | "array";
type SettingKey = keyof MemberSettings;

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
  shortcut_screenshot: "Alt+A",
  brains_sync_triggers: [],
  brains_sync_interval_hours: 1,
  brains_sync_interval_minutes: 30,
  task_reflection_memory_enabled: true,
};

const FIELD_TYPES: Record<SettingKey, FieldType> = {
  working_directory: "string",
  task_execution_mode: "string",
  ai_suggestion_history_count: "number",
  ai_auto_reply: "boolean",
  shortcut_auto_reply: "string",
  shortcut_execution_mode: "string",
  shortcut_lock_screen: "string",
  shortcut_sync_now: "string",
  shortcut_restore_brains: "string",
  shortcut_screenshot: "string",
  brains_sync_triggers: "array",
  brains_sync_interval_hours: "number",
  brains_sync_interval_minutes: "number",
  task_reflection_memory_enabled: "boolean",
};

const SETTING_KEYS = Object.keys(FIELD_TYPES) as SettingKey[];

function parseFieldValue(key: SettingKey, raw: unknown): unknown {
  const type = FIELD_TYPES[key];
  const def = DEFAULT_SETTINGS[key];
  if (type === "number") return typeof raw === "number" ? (key.includes("interval") ? Math.round(raw) : raw) : def;
  if (type === "boolean") return typeof raw === "boolean" ? raw : def;
  if (type === "array") return Array.isArray(raw) ? raw : def;
  return (raw as string) ?? def;
}

function applyPartial(target: Record<string, unknown>, updates: Partial<MemberSettings>) {
  for (const key of SETTING_KEYS) {
    if (updates[key] !== undefined) target[key] = updates[key];
  }
}

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

      const parsed: Record<string, unknown> = { ...DEFAULT_SETTINGS };
      for (const key of SETTING_KEYS) {
        parsed[key] = parseFieldValue(key, userSettings[key]);
      }
      _settings.value = parsed as unknown as MemberSettings;
    } catch (e) {
      console.error(`[settings] loadSettings failed for ${username}:`, e);
      _settings.value = { ...DEFAULT_SETTINGS };
    }

    _loaded.value = true;
    return _settings.value;
  }

  async function saveSettings(username: string, updates: Partial<MemberSettings>): Promise<void> {
    // Always update in-memory settings immediately (even in browser mode)
    applyPartial(_settings.value as unknown as Record<string, unknown>, updates);

    if (!isTauri) return;

    const raw = await safeInvoke("get_settings", {}) as Record<string, unknown> | null;
    const settings = { ...(raw ?? {}) };
    const users = { ...((settings.users ?? {}) as Record<string, unknown>) };
    const existing = { ...((users[username] ?? {}) as Record<string, unknown>) };

    applyPartial(existing, updates);

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
