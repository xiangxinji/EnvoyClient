import { managerFetch, apiUrl, getClientToken } from "../api";
import type { ServiceConfig, UserProfile } from "./types";

export class UserProfileService {
  constructor(_getConfig: () => Readonly<ServiceConfig>) {}

  async fetchProfiles(usernames: readonly string[]): Promise<UserProfile[]> {
    const res = await managerFetch(`/api/users/profiles?names=${encodeURIComponent(usernames.join(","))}`);
    return res.json() as Promise<UserProfile[]>;
  }

  async updateProfile(username: string, data: Readonly<{ nickname?: string | null; responsibilities?: string; capabilities?: string }>): Promise<{ nickname: string | null; avatar_url: string | null; responsibilities: string; capabilities: string }> {
    const res = await managerFetch(`/api/users/${username}/profile`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return res.json() as Promise<{ nickname: string | null; avatar_url: string | null; responsibilities: string; capabilities: string }>;
  }

  async uploadAvatar(username: string, file: File): Promise<{ avatar_url: string }> {
    const token = getClientToken();
    const formData = new FormData();
    formData.append("avatar", file);
    const res = await fetch(apiUrl(`/api/users/${username}/avatar`), {
      method: "POST",
      headers: { ...(token ? { "X-Envoy-Token": token } : {}) },
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || "Upload failed");
    }
    return res.json() as Promise<{ avatar_url: string }>;
  }
}
