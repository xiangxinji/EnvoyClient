import { ref, watch, onMounted, onUnmounted } from "vue";
import { getMemberSettings } from "./teamClientContext";
import type { TeamClientContext } from "./teamClientContext";
import type { TaskExecutionMode } from "./useMemberSettings";
import { sendDesktopNotification } from "../utils/notification";

export const isRecordingShortcut = ref(false);

const MODIFIER_KEYS = new Set(["Control", "Alt", "Shift", "Meta"]);

function codeToDisplay(code: string): string {
  if (code.startsWith("Key")) return code.slice(3);
  if (code.startsWith("Digit")) return code.slice(5);
  if (code === "Space") return "Space";
  if (code === "Minus") return "-";
  if (code === "Equal") return "=";
  if (code === "BracketLeft") return "[";
  if (code === "BracketRight") return "]";
  if (code === "Semicolon") return ";";
  if (code === "Quote") return "'";
  if (code === "Backquote") return "`";
  if (code === "Backslash") return "\\";
  if (code === "Slash") return "/";
  if (code === "Period") return ".";
  if (code === "Comma") return ",";
  return code;
}

export function buildCombo(e: KeyboardEvent): string | null {
  if (MODIFIER_KEYS.has(e.key)) return null;
  if (!e.ctrlKey && !e.altKey && !e.metaKey) return null;

  const parts: string[] = [];
  if (e.ctrlKey) parts.push("Ctrl");
  if (e.altKey) parts.push("Alt");
  if (e.shiftKey) parts.push("Shift");
  if (e.metaKey) parts.push("Meta");
  parts.push(codeToDisplay(e.code));
  return parts.join("+");
}

/** Convert display combo like "Ctrl+Alt+R" to Tauri shortcut format "CommandOrControl+Alt+R" */
function comboToTauriShortcut(combo: string): string {
  return combo.replace(/\bCtrl\b/, "CommandOrControl").replace(/\+/g, "+");
}

const isTauri = "__TAURI_INTERNALS__" in window;

type GlobalShortcutModule = typeof import("@tauri-apps/plugin-global-shortcut");

let shortcutModule: GlobalShortcutModule | null = null;

async function getShortcutModule(): Promise<GlobalShortcutModule | null> {
  if (shortcutModule) return shortcutModule;
  if (!isTauri) return null;
  try {
    shortcutModule = await import("@tauri-apps/plugin-global-shortcut");
    return shortcutModule;
  } catch {
    return null;
  }
}

export function useGlobalShortcuts(ctx: TeamClientContext) {
  const { settings, loadSettings, saveSettings } = getMemberSettings();

  const registeredShortcuts = new Set<string>();

  async function updateRegistrations() {
    const mod = await getShortcutModule();
    if (!mod) return;

    const s = settings.value;
    const desired = new Set<string>();

    if (s.shortcut_auto_reply) desired.add(s.shortcut_auto_reply);
    if (s.shortcut_execution_mode) desired.add(s.shortcut_execution_mode);

    // Unregister removed shortcuts
    for (const combo of registeredShortcuts) {
      if (!desired.has(combo)) {
        try {
          await mod.unregister(comboToTauriShortcut(combo));
        } catch { /* ignore */ }
        registeredShortcuts.delete(combo);
      }
    }

    // Register new shortcuts
    for (const combo of desired) {
      if (!registeredShortcuts.has(combo)) {
        try {
          await mod.register(comboToTauriShortcut(combo), (event) => {
            if (event.state !== "Pressed") return;
            handleShortcutFired(combo);
          });
          registeredShortcuts.add(combo);
        } catch (e: unknown) {
          console.warn("Failed to register global shortcut:", combo, e instanceof Error ? e.message : String(e));
        }
      }
    }
  }

  async function handleShortcutFired(combo: string) {
    const s = settings.value;

    if (s.shortcut_auto_reply && combo === s.shortcut_auto_reply) {
      const next = !s.ai_auto_reply;
      await saveSettings(ctx.myId, { ai_auto_reply: next });
      if (!next) ctx.autoReplyDispose?.();
      sendDesktopNotification("Envoy 快捷键", `AI 自动回复已${next ? "开启" : "关闭"}`);
    }

    if (s.shortcut_execution_mode && combo === s.shortcut_execution_mode) {
      const next: TaskExecutionMode = s.task_execution_mode === "auto" ? "manual" : "auto";
      await saveSettings(ctx.myId, { task_execution_mode: next });
      sendDesktopNotification("Envoy 快捷键", `任务执行模式切换为「${next === "auto" ? "自动" : "手动"}」`);
    }
  }

  // Watch settings changes and re-register
  let stopWatch: (() => void) | null = null;

  onMounted(async () => {
    await loadSettings(ctx.myId);
    await updateRegistrations();

    stopWatch = watch(
      () => [settings.value.shortcut_auto_reply, settings.value.shortcut_execution_mode],
      () => updateRegistrations(),
    );
  });

  onUnmounted(async () => {
    stopWatch?.();

    const mod = await getShortcutModule();
    if (mod) {
      for (const combo of registeredShortcuts) {
        try {
          await mod.unregister(comboToTauriShortcut(combo));
        } catch { /* ignore */ }
      }
    }
    registeredShortcuts.clear();
  });
}
