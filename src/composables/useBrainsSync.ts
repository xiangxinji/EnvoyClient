import { ref, type Ref } from "vue";
import { safeInvoke, isTauri } from "../utils/platform";
import { getErrorMessage } from "../utils/error";
import { getMemberSettings } from "./teamClientContext";
import { managerPost, managerFetch, apiUrl, getClientToken } from "../api";

interface SyncManifest {
  lastSyncAt: string | null;
  files: Record<string, { hash: string; syncedAt: string }>;
}

interface ScannedFile {
  path: string;
  hash: string;
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

function loadManifest(): SyncManifest {
  if (!isTauri) return { lastSyncAt: null, files: {} };
  try {
    const raw = localStorage.getItem(`brains_sync_manifest_${_username}`);
    if (raw) return JSON.parse(raw) as SyncManifest;
  } catch { /* corrupted, treat as empty */ }
  return { lastSyncAt: null, files: {} };
}

function saveManifest(manifest: SyncManifest): void {
  localStorage.setItem(`brains_sync_manifest_${_username}`, JSON.stringify(manifest));
}

function brainsHeaders(): Record<string, string> {
  const h: Record<string, string> = { team: _teamName };
  const token = getClientToken();
  if (token) h["X-Envoy-Token"] = token;
  return h;
}

async function doSync(): Promise<void> {
  if (syncing.value || !isTauri || !_username || !_teamName) return;
  syncing.value = true;
  syncError.value = null;
  syncPhase.value = "scanning";
  syncProgress.value = { current: 0, total: 0 };
  currentFile.value = "";

  try {
    // 1. Scan local files
    const result = await safeInvoke("scan_brains_files", { username: _username }) as { files: ScannedFile[] } | null;
    const localFiles = result?.files ?? [];

    // 2. Diff against manifest
    const manifest = loadManifest();
    const toUpload: { path: string; content: string }[] = [];
    const toDelete: string[] = [];

    for (const file of localFiles) {
      const entry = manifest.files[file.path];
      if (!entry || entry.hash !== file.hash) {
        currentFile.value = file.path;
        const fullPath = `~/.envoy/brains/${_username}/${file.path}`;
        const readResult = await safeInvoke("file_read", { path: fullPath }) as { content: string } | null;
        toUpload.push({ path: file.path, content: readResult?.content ?? "" });
      }
    }

    for (const path of Object.keys(manifest.files)) {
      if (!localFiles.some((f) => f.path === path)) {
        toDelete.push(path);
      }
    }

    // 3. Batch upload via POST /api/brains/sync
    syncPhase.value = "uploading";
    syncProgress.value = { current: 0, total: toUpload.length + toDelete.length };

    if (toUpload.length > 0) {
      currentFile.value = `(${toUpload.length} files)`;
      await managerPost("/api/brains/sync", { username: _username, files: toUpload }, brainsHeaders());
      for (const file of toUpload) {
        manifest.files[file.path] = { hash: "", syncedAt: new Date().toISOString() };
      }
      // Update hashes from scan result
      for (const file of localFiles) {
        if (toUpload.some((u) => u.path === file.path)) {
          manifest.files[file.path].hash = file.hash;
        }
      }
      syncProgress.value = { ...syncProgress.value, current: toUpload.length };
    }

    // 4. Rename deleted files via POST /api/brains/rename
    for (const path of toDelete) {
      currentFile.value = path;
      try {
        const backupPath = addBackupExtension(path);
        await managerPost("/api/brains/rename", { username: _username, path, newPath: backupPath }, brainsHeaders());
      } catch { /* best effort */ }
      delete manifest.files[path];
      syncProgress.value = { ...syncProgress.value, current: syncProgress.value.current + 1 };
    }

    manifest.lastSyncAt = new Date().toISOString();
    saveManifest(manifest);
    lastSyncAt.value = manifest.lastSyncAt;
    syncPhase.value = "done";
  } catch (e) {
    syncError.value = getErrorMessage(e);
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
    // 1. List backup files via GET /api/brains/files
    const res = await managerFetch(`/api/brains/files?username=${encodeURIComponent(_username)}`, { headers: brainsHeaders() });
    const listing = await res.json() as { files: Array<{ path: string; size: number }> };

    syncPhase.value = "uploading";
    syncProgress.value = { current: 0, total: listing.files.length };

    // 2. Download each file
    const restoreEntries: { path: string; content: string }[] = [];
    for (const item of listing.files) {
      currentFile.value = item.path;
      const downloadUrl = apiUrl(`/api/brains/download/${encodeURIComponent(item.path)}?username=${encodeURIComponent(_username)}`);
      const token = getClientToken();
      const dlRes = await fetch(downloadUrl, { headers: { ...brainsHeaders(), ...(token ? { "X-Envoy-Token": token } : {}) } });
      if (!dlRes.ok) throw new Error(`Failed to download ${item.path}`);
      const content = await dlRes.text();
      restoreEntries.push({ path: item.path, content });
      syncProgress.value = { ...syncProgress.value, current: syncProgress.value.current + 1 };
    }

    // 3. Write to local brains
    if (restoreEntries.length > 0) {
      await safeInvoke("restore_brains", { username: _username, files: restoreEntries });
    }

    // 4. Rebuild manifest
    const scanResult = await safeInvoke("scan_brains_files", { username: _username }) as { files: ScannedFile[] } | null;
    const manifest: SyncManifest = { lastSyncAt: new Date().toISOString(), files: {} };
    for (const f of (scanResult?.files ?? [])) {
      manifest.files[f.path] = { hash: f.hash, syncedAt: new Date().toISOString() };
    }
    saveManifest(manifest);
    lastSyncAt.value = manifest.lastSyncAt;
    syncPhase.value = "done";
  } catch (e) {
    syncError.value = getErrorMessage(e);
  } finally {
    syncing.value = false;
    currentFile.value = "";
  }
}

function addBackupExtension(path: string): string {
  const dotIndex = path.lastIndexOf(".");
  if (dotIndex > path.lastIndexOf("/")) {
    return path.substring(0, dotIndex) + ".backup" + path.substring(dotIndex);
  }
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
