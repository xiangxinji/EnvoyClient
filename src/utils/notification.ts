const isTauri = "__TAURI_INTERNALS__" in window;

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

export async function downloadFileWithDialog(
  url: string,
  filename: string,
  headers?: Record<string, string>,
): Promise<boolean> {
  const res = await fetch(url, { headers: headers ?? {} });
  if (!res.ok) throw new Error("下载失败");
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
