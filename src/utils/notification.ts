import { isTauri } from "./platform";
import { i18n } from "../i18n";

let cachedIconPath: string | null = null;

async function resolveIconPath(): Promise<string | undefined> {
  if (cachedIconPath !== null) return cachedIconPath || undefined;
  if (!isTauri) {
    cachedIconPath = "";
    return undefined;
  }
  try {
    const { resolveResource } = await import("@tauri-apps/api/path");
    cachedIconPath = await resolveResource("icons/icon.png");
    return cachedIconPath;
  } catch {
    cachedIconPath = "";
    return undefined;
  }
}

export async function sendDesktopNotification(title: string, body: string): Promise<void> {
  if (!isTauri) return;
  try {
    const { sendNotification } = await import("@tauri-apps/plugin-notification");
    const iconPath = await resolveIconPath();
    if (sendNotification) {
      sendNotification({ title, body, icon: iconPath });
    }
  } catch {
    // Plugin not available, silently skip
  }
}

let attentionRequested = false;

/** Flash the taskbar button (Windows) / bounce the dock icon (macOS) to alert the user. */
export async function requestTaskbarAttention(): Promise<void> {
  if (!isTauri || attentionRequested) return;
  try {
    const { getCurrentWindow, UserAttentionType } = await import("@tauri-apps/api/window");
    await getCurrentWindow().requestUserAttention(UserAttentionType.Critical);
    attentionRequested = true;
  } catch {
    // Silently skip if not supported
  }
}

/** Stop taskbar flashing — call when the window gains focus. */
export async function cancelTaskbarAttention(): Promise<void> {
  if (!isTauri || !attentionRequested) return;
  try {
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    await getCurrentWindow().requestUserAttention(null);
    attentionRequested = false;
  } catch {
    // Silently skip
  }
}

/** Update the dock/taskbar badge with the total unread count (macOS Dock / Windows 10+). */
export async function updateDockBadge(count: number): Promise<void> {
  if (!isTauri) return;
  try {
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    await getCurrentWindow().setBadgeCount(count > 0 ? count : undefined);
  } catch {
    // Silently skip if not supported
  }
}

/** Reset all notification state (call on logout). */
export function resetNotificationState(): void {
  attentionRequested = false;
}

export async function downloadFileWithDialog(
  url: string,
  filename: string,
  headers?: Record<string, string>,
): Promise<boolean> {
  const res = await fetch(url, { headers: headers ?? {} });
  if (!res.ok) throw new Error(i18n.global.t('common.downloadFailed'));
  const blob = await res.blob();

  if (isTauri) {
    const [{ save }, { invoke }] = await Promise.all([
      import("@tauri-apps/plugin-dialog"),
      import("@tauri-apps/api/core"),
    ]);
    const filePath = await save({ defaultPath: filename });
    if (!filePath) return false;
    const buffer = await blob.arrayBuffer();
    const uint8 = new Uint8Array(buffer);
    let binary = "";
    for (let i = 0; i < uint8.length; i++) {
      binary += String.fromCharCode(uint8[i]!);
    }
    const b64 = btoa(binary);
    await invoke("save_binary_file", { path: filePath, dataB64: b64 });
    return true;
  }

  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
  return true;
}
