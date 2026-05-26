import { managerPost, managerFetch, managerDelete, apiUrl, getClientToken } from "../api";
import type { ServiceConfig, CloudFileItem, CloudDirListing, CloudSearchResult, CloudStats } from "./types";

export class CloudResourceService {
  constructor(
    private readonly getConfig: () => Readonly<ServiceConfig>,
  ) {}

  async listFiles(parentId?: string | null): Promise<CloudDirListing> {
    const { teamName } = this.getConfig();
    const query = parentId ? `?parentId=${encodeURIComponent(parentId)}` : "";
    const res = await managerFetch(`/api/cloud/files${query}`, { headers: { team: teamName } });
    return res.json() as Promise<CloudDirListing>;
  }

  uploadFile(file: File, parentId: string | null, onProgress?: (pct: number) => void): Promise<CloudFileItem> {
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
      if (parentId) formData.append("parentId", parentId);
      formData.append("uploadedBy", myId);
      xhr.send(formData);
    });
  }

  async createDirectory(name: string, parentId: string | null): Promise<CloudFileItem> {
    const { myId, teamName } = this.getConfig();
    const res = await managerPost("/api/cloud/directories", { name, parentId: parentId || null, createdBy: myId }, { team: teamName });
    const data = await res.json() as { ok: boolean; item: CloudFileItem };
    return data.item;
  }

  async deleteFile(id: string): Promise<void> {
    const { myId, teamName } = this.getConfig();
    await managerDelete(
      `/api/cloud/files/${encodeURIComponent(id)}?from=${encodeURIComponent(myId)}`,
      { team: teamName },
    );
  }

  downloadUrl(id: string): string {
    return apiUrl(`/api/cloud/files/${encodeURIComponent(id)}/download`);
  }

  async search(query: string): Promise<CloudSearchResult[]> {
    const { teamName } = this.getConfig();
    const res = await managerFetch(`/api/cloud/search?q=${encodeURIComponent(query)}`, { headers: { team: teamName } });
    return res.json() as Promise<CloudSearchResult[]>;
  }

  async validateIds(ids: readonly string[]): Promise<Record<string, boolean>> {
    if (ids.length === 0) return {};
    const { teamName } = this.getConfig();
    const res = await managerPost("/api/cloud/validate", { ids }, { team: teamName });
    return res.json() as Promise<Record<string, boolean>>;
  }

  async getBreadcrumb(id: string): Promise<Array<{ id: string; name: string }>> {
    const { teamName } = this.getConfig();
    const res = await managerFetch(`/api/cloud/breadcrumb?id=${encodeURIComponent(id)}`, { headers: { team: teamName } });
    return res.json() as Promise<Array<{ id: string; name: string }>>;
  }

  async getStats(): Promise<CloudStats> {
    const { teamName } = this.getConfig();
    const res = await managerFetch("/api/cloud/stats", { headers: { team: teamName } });
    return res.json() as Promise<CloudStats>;
  }
}
