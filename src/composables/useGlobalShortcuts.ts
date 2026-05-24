import { ref, watch, onMounted, onUnmounted } from "vue";
import { i18n } from "../i18n";
import { getMemberSettings } from "./teamClientContext";
import type { TeamClientContext } from "./teamClientContext";
import type { TaskExecutionMode } from "./useMemberSettings";
import { useLockScreen } from "./useLockScreen";
import { sendDesktopNotification } from "../utils/notification";
import { getErrorMessage } from "../utils/error";

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

import { isTauri } from "../utils/platform";

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

  const { settings, loadSettings, toggleAutoReply, toggleExecutionMode } = getMemberSettings();
  const { lock } = useLockScreen();

  const registeredShortcuts = new Set<string>();

  async function updateRegistrations() {
    const mod = await getShortcutModule();
    if (!mod) return;

    const s = settings.value;
    const desired = new Set<string>();

    if (s.shortcut_auto_reply) desired.add(s.shortcut_auto_reply);
    if (s.shortcut_execution_mode) desired.add(s.shortcut_execution_mode);
    if (s.shortcut_lock_screen) desired.add(s.shortcut_lock_screen);
    if (s.shortcut_sync_now) desired.add(s.shortcut_sync_now);
    if (s.shortcut_restore_brains) desired.add(s.shortcut_restore_brains);

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
            void handleShortcutFired(combo);
          });
          registeredShortcuts.add(combo);
        } catch (e: unknown) {
          console.warn("Failed to register global shortcut:", combo, getErrorMessage(e));
        }
      }
    }
  }

  async function handleShortcutFired(combo: string) {
    const s = settings.value;

    if (s.shortcut_auto_reply && combo === s.shortcut_auto_reply) {
      const next = !s.ai_auto_reply;
      await toggleAutoReply(ctx.myId, ctx.autoReplyDispose);
      sendDesktopNotification(i18n.global.t('notification.shortcutTitle'), i18n.global.t('notification.aiAutoReplyChanged', { status: next ? i18n.global.t('notification.aiAutoReplyOn') : i18n.global.t('notification.aiAutoReplyOff') }));
    }

    if (s.shortcut_execution_mode && combo === s.shortcut_execution_mode) {
      const next: TaskExecutionMode = s.task_execution_mode === "auto" ? "manual" : "auto";
      await toggleExecutionMode(ctx.myId);
      sendDesktopNotification(i18n.global.t('notification.shortcutTitle'), i18n.global.t('notification.taskModeChanged', { mode: next === "auto" ? i18n.global.t('notification.modeAuto') : i18n.global.t('notification.modeManual') }));
    }

    if (s.shortcut_lock_screen && combo === s.shortcut_lock_screen) {
      lock();
    }

    if (s.shortcut_sync_now && combo === s.shortcut_sync_now) {
      try {
        const { getBrainsSync } = await import("./useBrainsSync");
        const brainsSync = getBrainsSync();
        const result = await brainsSync.doSync();
        if (result && result.uploaded === 0 && result.deleted === 0) {
          sendDesktopNotification(i18n.global.t('notification.shortcutTitle'), i18n.global.t('settings.brainsSyncNoChange'));
        } else {
          sendDesktopNotification(i18n.global.t('notification.shortcutTitle'), i18n.global.t('notification.syncNowTriggered'));
        }
      } catch {
        sendDesktopNotification(i18n.global.t('notification.shortcutTitle'), i18n.global.t('common.operationFailed'));
      }
    }

    if (s.shortcut_restore_brains && combo === s.shortcut_restore_brains) {
      try {
        const { getBrainsSync } = await import("./useBrainsSync");
        const brainsSync = getBrainsSync();
        await brainsSync.doRestore();
        if (brainsSync.syncError.value) {
          sendDesktopNotification(i18n.global.t('notification.shortcutTitle'), i18n.global.t('common.operationFailed') + ': ' + brainsSync.syncError.value);
        } else {
          sendDesktopNotification(i18n.global.t('notification.shortcutTitle'), i18n.global.t('notification.restoreBrainsTriggered'));
        }
      } catch {
        sendDesktopNotification(i18n.global.t('notification.shortcutTitle'), i18n.global.t('common.operationFailed'));
      }
    }
  }

  // Watch settings changes and re-register
  let stopWatch: (() => void) | null = null;

  onMounted(async () => {
    await loadSettings(ctx.myId);
    await updateRegistrations();

    stopWatch = watch(
      () => [settings.value.shortcut_auto_reply, settings.value.shortcut_execution_mode, settings.value.shortcut_lock_screen, settings.value.shortcut_sync_now, settings.value.shortcut_restore_brains],
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
