import { managerPost, managerFetch, managerDelete, apiUrl, getClientToken } from "../api";
import type { ServiceConfig, CloudFileItem, CloudDirListing, CloudSearchResult, CloudStats } from "./types";

export class CloudResourceService {
  constructor(
    private readonly getConfig: () => Readonly<ServiceConfig>,
  ) {}

  async listFiles(path?: string): Promise<CloudDirListing> {
    const { teamName } = this.getConfig();
    const query = path ? `?path=${encodeURIComponent(path)}` : "";
    const res = await managerFetch(`/api/cloud/files${query}`, { headers: { team: teamName } });
    return res.json() as Promise<CloudDirListing>;
  }

  uploadFile(file: File, path: string, onProgress?: (pct: number) => void): Promise<CloudFileItem> {
    const { myId, teamName } = this.getConfig();
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", apiUrl("/api/cloud/files"));
      xhr.setRequestHeader("team", teamName);
      const token = getClientToken();
      if (token) xhr.setRequestHeader("X-Envoy-Token", token);

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && onProgress) {
          onProgress(Math.round((e.loaded / e.total) * 100));
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          const resp = JSON.parse(xhr.responseText) as { ok: boolean; item: CloudFileItem };
          resolve(resp.item);
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
      formData.append("uploadedBy", myId);
      xhr.send(formData);
    });
  }

  async createDirectory(name: string, path: string): Promise<CloudFileItem> {
    const { myId, teamName } = this.getConfig();
    const res = await managerPost("/api/cloud/directories", { name, path: path || undefined, createdBy: myId }, { team: teamName });
    const data = await res.json() as { ok: boolean; item: CloudFileItem };
    return data.item;
  }

  async deleteFile(filePath: string): Promise<void> {
    const { myId, teamName } = this.getConfig();
    await managerDelete(
      `/api/cloud/files?path=${encodeURIComponent(filePath)}&from=${encodeURIComponent(myId)}`,
      { team: teamName },
    );
  }

  downloadUrl(filePath: string): string {
    return apiUrl(`/api/cloud/download/${filePath}`);
  }

  async search(query: string): Promise<CloudSearchResult[]> {
    const { teamName } = this.getConfig();
    const res = await managerFetch(`/api/cloud/search?q=${encodeURIComponent(query)}`, { headers: { team: teamName } });
    return res.json() as Promise<CloudSearchResult[]>;
  }

  async validatePaths(paths: readonly string[]): Promise<Record<string, boolean>> {
    if (paths.length === 0) return {};
    const { teamName } = this.getConfig();
    const res = await managerPost("/api/cloud/validate", { paths }, { team: teamName });
    return res.json() as Promise<Record<string, boolean>>;
  }

  async getStats(): Promise<CloudStats> {
    const { teamName } = this.getConfig();
    const res = await managerFetch("/api/cloud/stats", { headers: { team: teamName } });
    return res.json() as Promise<CloudStats>;
  }
}