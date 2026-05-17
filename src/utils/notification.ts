const isTauri = "__TAURI_INTERNALS__" in window;

export async function sendDesktopNotification(title: string, body: string): Promise<void> {
  if (!isTauri) return;
  try {
    const { sendNotification } = await import("@tauri-apps/plugin-notification");
    if (sendNotification) {
      sendNotification({ title, body });
    }
  } catch {
    // Plugin not available, silently skip
  }
}
