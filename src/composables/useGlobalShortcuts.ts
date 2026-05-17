import { ref, onMounted, onUnmounted } from "vue";
import { getMemberSettings } from "./teamClientContext";
import type { TeamClientContext } from "./teamClientContext";
import type { TaskExecutionMode } from "./useMemberSettings";

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

export function useGlobalShortcuts(ctx: TeamClientContext) {
  const { settings, loadSettings, saveSettings } = getMemberSettings();

  onMounted(async () => {
    await loadSettings(ctx.myId);
    window.addEventListener("keydown", handleKeyDown);
  });

  function handleKeyDown(e: KeyboardEvent) {
    if (isRecordingShortcut.value) return;
    const target = e.target as HTMLElement;
    if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) return;

    const combo = buildCombo(e);
    if (!combo) return;

    const s = settings.value;

    if (s.shortcut_auto_reply && combo === s.shortcut_auto_reply) {
      e.preventDefault();
      const next = !s.ai_auto_reply;
      saveSettings(ctx.myId, { ai_auto_reply: next });
      if (!next) ctx.autoReplyDispose?.();
    }

    if (s.shortcut_execution_mode && combo === s.shortcut_execution_mode) {
      e.preventDefault();
      const next: TaskExecutionMode = s.task_execution_mode === "auto" ? "manual" : "auto";
      saveSettings(ctx.myId, { task_execution_mode: next });
    }
  }

  onUnmounted(() => window.removeEventListener("keydown", handleKeyDown));
}
