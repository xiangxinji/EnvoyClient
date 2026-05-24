import { ref, type Ref } from "vue";
import { safeInvoke, isTauri } from "../utils/platform";
import { getErrorMessage } from "../utils/error";
import { getMemberSettings } from "./teamClientContext";
import { managerPost, managerFetch, getManagerUrl, getClientToken } from "../api";

interface FileInfo {
  path: string;
  mtime_ms: number;
  size: number;
}

type SyncPhase = "scanning" | "uploading" | "done";

const syncing = ref(false);
const syncPhase = ref<SyncPhase>("done");
const syncProgress = ref({ current: 0, total: 0 });
const currentFile = ref("");
const lastSyncAt = ref<string | null>(null);
const syncError = ref<string | null>(null);

let _username = "";
let _teamName = "";
let _intervalTimer: ReturnType<typeof setInterval> | undefined;
let _onTaskComplete: ((task: { subscribe: string[]; status: string }) => void) | undefined;

function brainsHeaders(): Record<string, string> {
  const h: Record<string, string> = { team: _teamName };
  const token = getClientToken();
  if (token) h["X-Envoy-Token"] = token;
  return h;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 8192;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize) as unknown as number[]);
  }
  return btoa(binary);
}

function needsUpload(local: FileInfo, server: FileInfo | undefined): boolean {
  if (!server) return true;
  return local.mtime_ms !== server.mtime_ms || local.size !== server.size;
}

async function doSync(): Promise<{ uploaded: number; deleted: number } | null> {
  if (syncing.value || !isTauri || !_username || !_teamName) return null;
  syncing.value = true;
  syncError.value = null;
  syncPhase.value = "scanning";
  syncProgress.value = { current: 0, total: 0 };
  currentFile.value = "";

  try {
    // 1. Scan local files (stat only, no content read)
    const scanResult = await safeInvoke("scan_brains_files", { username: _username }) as { files: FileInfo[] } | null;
    const localFiles = scanResult?.files ?? [];

    // 2. Get server file list
    const serverRes = await managerFetch(`/api/brains/files?username=${encodeURIComponent(_username)}`, { headers: brainsHeaders() });
    const serverData = await serverRes.json() as { files: FileInfo[] };
    const serverMap = new Map(serverData.files.map((f) => [f.path, f]));

    // 3. Diff + upload one by one
    const localPaths = new Set(localFiles.map((f) => f.path));
    const toDelete: string[] = [];
    for (const serverFile of serverData.files) {
      if (!localPaths.has(serverFile.path)) {
        toDelete.push(serverFile.path);
      }
    }

    let uploaded = 0;
    let failedUploads = 0;
    syncPhase.value = "uploading";
    syncProgress.value = { current: 0, total: localFiles.length + toDelete.length };

    for (const file of localFiles) {
      if (needsUpload(file, serverMap.get(file.path))) {
        currentFile.value = file.path;
        try {
          await safeInvoke("upload_brains_file", {
            username: _username,
            path: file.path,
            mtimeMs: file.mtime_ms,
            size: file.size,
            serverUrl: getManagerUrl(),
            token: getClientToken(),
            team: _teamName,
          });
          uploaded++;
        } catch (e) {
          console.error(`upload_brains_file failed (${file.path}):`, getErrorMessage(e));
          failedUploads++;
        }
      }
      syncProgress.value = { ...syncProgress.value, current: syncProgress.value.current + 1 };
    }

    // 4. Rename deleted files on server
    for (const path of toDelete) {
      currentFile.value = path;
      try {
        const backupPath = addBackupExtension(path);
        await managerPost("/api/brains/rename", { username: _username, path, newPath: backupPath }, brainsHeaders());
      } catch { /* best effort */ }
      syncProgress.value = { ...syncProgress.value, current: syncProgress.value.current + 1 };
    }

    lastSyncAt.value = new Date().toISOString();
    syncPhase.value = "done";
    if (failedUploads > 0) {
      syncError.value = `${failedUploads} file(s) failed to upload`;
    }
    return { uploaded, deleted: toDelete.length };
  } catch (e) {
    syncError.value = getErrorMessage(e);
    return null;
  } finally {
    syncing.value = false;
    currentFile.value = "";
  }
}

async function doRestore(): Promise<void> {
  if (syncing.value || !isTauri || !_username || !_teamName) return;
  syncing.value = true;
  syncError.value = null;
  syncPhase.value = "scanning";
  syncProgress.value = { current: 0, total: 0 };
  currentFile.value = "";

  try {
    // 1. List server files (include backups for full restore)
    const res = await managerFetch(`/api/brains/files?username=${encodeURIComponent(_username)}&includeBackups=true`, { headers: brainsHeaders() });
    const listing = await res.json() as { files: FileInfo[] };

    syncPhase.value = "uploading";
    syncProgress.value = { current: 0, total: listing.files.length };

    // 2. Download and write each file
    const failedFiles: string[] = [];
    for (const item of listing.files) {
      currentFile.value = item.path;
      try {
        const encodedPath = item.path.split("/").map(encodeURIComponent).join("/");
        const dlPath = `/api/brains/download/${encodedPath}?username=${encodeURIComponent(_username)}`;
        const dlRes = await managerFetch(dlPath, { headers: brainsHeaders() });
        const buffer = await dlRes.arrayBuffer();
        const content = arrayBufferToBase64(buffer);
        await safeInvoke("restore_brains", {
          username: _username,
          files: [{ path: item.path, content, mtime_ms: item.mtime_ms }],
        });
      } catch {
        failedFiles.push(item.path);
      }
      syncProgress.value = { ...syncProgress.value, current: syncProgress.value.current + 1 };
    }

    if (failedFiles.length > 0) {
      syncError.value = `Failed to download ${failedFiles.length} file(s): ${failedFiles.join(", ")}`;
    }

    lastSyncAt.value = new Date().toISOString();
    syncPhase.value = "done";
  } catch (e) {
    syncError.value = getErrorMessage(e);
  } finally {
    syncing.value = false;
    currentFile.value = "";
  }
}

function addBackupExtension(path: string): string {
  return path + ".backup";
}

function setupTriggers(username: string): void {
  cleanupTriggers();
  _username = username;

  const { settings } = getMemberSettings();
  const triggers = settings.value.brains_sync_triggers;

  if (triggers.includes("interval")) {
    const hours = Math.max(0.5, Math.min(24, settings.value.brains_sync_interval_hours));
    _intervalTimer = setInterval(() => { void doSync(); }, hours * 3600 * 1000);
    void doSync();
  }
}

function setTeamName(teamName: string): void {
  _teamName = teamName;
}

function registerTaskListener(): void {
  _onTaskComplete = () => { void doSync(); };
}

function getTaskListener() {
  return _onTaskComplete;
}

function cleanupTriggers(): void {
  if (_intervalTimer) {
    clearInterval(_intervalTimer);
    _intervalTimer = undefined;
  }
  _onTaskComplete = undefined;
}

export function useBrainsSync() {
  return {
    syncing: syncing as Ref<boolean>,
    syncPhase: syncPhase as Ref<SyncPhase>,
    syncProgress: syncProgress as Ref<{ current: number; total: number }>,
    currentFile: currentFile as Ref<string>,
    lastSyncAt: lastSyncAt as Ref<string | null>,
    syncError: syncError as Ref<string | null>,
    doSync,
    doRestore,
    setupTriggers,
    setTeamName,
    registerTaskListener,
    getTaskListener,
    cleanupTriggers,
  };
}
