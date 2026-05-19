let _managerUrl = "http://localhost:8080";
let _clientToken = "";

export function setManagerUrl(url: string) {
  _managerUrl = url;
}

export function setClientToken(token: string) {
  _clientToken = token;
}

export function getClientToken(): string {
  return _clientToken;
}

export function apiUrl(path: string): string {
  return `${_managerUrl}${path}`;
}

export async function managerFetch(path: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(apiUrl(path), {
    ...init,
    headers: {
      ...(init?.headers || {}),
      ...(_clientToken ? { "X-Envoy-Token": _clientToken } : {}),
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `Request failed: ${res.status}`);
  }
  return res;
}

export async function managerPost(path: string, body: unknown, headers?: Record<string, string>): Promise<Response> {
  return managerFetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

// ─── User Profile ──────────────────────────────────────────

export interface UserProfile {
  username: string;
  nickname: string | null;
  avatar_url: string | null;
}

export async function fetchProfiles(names: string[]): Promise<UserProfile[]> {
  const res = await managerFetch(`/api/users/profiles?names=${encodeURIComponent(names.join(","))}`);
  return res.json();
}

export async function updateProfile(username: string, data: { nickname?: string | null }): Promise<{ ok: boolean; nickname: string | null; avatar_url: string | null }> {
  const res = await managerFetch(`/api/users/${username}/profile`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function uploadAvatar(username: string, file: File): Promise<{ avatar_url: string }> {
  const formData = new FormData();
  formData.append("avatar", file);
  const res = await fetch(apiUrl(`/api/users/${username}/avatar`), {
    method: "POST",
    headers: { ...(_clientToken ? { "X-Envoy-Token": _clientToken } : {}) },
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || "Upload failed");
  }
  return res.json();
}

// ─── Cloud Resources ──────────────────────────────────────────

export interface CloudFileItem {
  id: string;
  name: string;
  type: "file" | "directory";
  size: number;
  uploadedBy: string;
  createdAt: number;
}

export interface CloudDirListing {
  path: string;
  items: CloudFileItem[];
}

export async function listCloudFiles(team: string, path?: string): Promise<CloudDirListing> {
  const query = path ? `?path=${encodeURIComponent(path)}` : "";
  const res = await managerFetch(`/api/cloud/files${query}`, {
    headers: { team },
  });
  return res.json();
}

export async function uploadCloudFile(team: string, file: File, path: string, uploadedBy: string, onProgress?: (pct: number) => void): Promise<{ ok: boolean; item: CloudFileItem }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", apiUrl("/api/cloud/files"));
    xhr.setRequestHeader("team", team);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(JSON.parse(xhr.responseText));
      } else {
        try {
          const err = JSON.parse(xhr.responseText);
          reject(new Error(err.error || `Upload failed: ${xhr.status}`));
        } catch {
          reject(new Error(`Upload failed: ${xhr.status}`));
        }
      }
    };

    xhr.onerror = () => reject(new Error("Upload failed: network error"));

    const formData = new FormData();
    formData.append("file", file);
    if (path) formData.append("path", path);
    formData.append("uploadedBy", uploadedBy);
    xhr.send(formData);
  });
}

export function cloudDownloadUrl(_team: string, filePath: string): string {
  return apiUrl(`/api/cloud/download/${filePath}`);
}

export async function createCloudDirectory(team: string, name: string, path: string, createdBy: string): Promise<{ ok: boolean; item: CloudFileItem }> {
  return managerPost("/api/cloud/directories", { name, path: path || undefined, createdBy }, { team }).then(r => r.json());
}

export async function deleteCloudFile(team: string, path: string, from: string): Promise<{ ok: boolean }> {
  const res = await managerFetch(`/api/cloud/files?path=${encodeURIComponent(path)}&from=${encodeURIComponent(from)}`, {
    method: "DELETE",
    headers: { team },
  });
  return res.json();
}

export interface CloudStats {
  totalFiles: number;
  totalSize: number;
  totalDirs: number;
  byUser: Array<{ user: string; fileCount: number; totalSize: number }>;
}

export async function getCloudStats(team: string): Promise<CloudStats> {
  const res = await managerFetch("/api/cloud/stats", {
    headers: { team },
  });
  return res.json();
}
