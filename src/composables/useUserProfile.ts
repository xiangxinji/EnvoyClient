import { ref, type Ref } from "vue";
import { getUserProfileService } from "./teamClientContext";
import { apiUrl } from "../api";
import { getErrorMessage } from "../utils/error";
import type { UserProfile } from "../services/types";

interface ProfileEntry extends UserProfile {
  _v: number;
}

const profiles: Ref<Record<string, ProfileEntry>> = ref({});

export function useUserProfile() {
  const profileService = getUserProfileService();

  async function loadProfiles(usernames: string[]): Promise<void> {
    if (usernames.length === 0) return;
    try {
      const list = await profileService.fetchProfiles(usernames);
      const next = { ...profiles.value };
      for (const p of list) {
        const existing = next[p.username];
        next[p.username] = { ...p, _v: existing?._v ?? Date.now() };
      }
      profiles.value = next;
    } catch (e: unknown) {
      console.error("[useUserProfile] fetchProfiles failed:", getErrorMessage(e));
    }
  }

  function getDisplayName(username: string): string {
    const p = profiles.value[username];
    if (p?.nickname) return p.nickname;
    return username;
  }

  function getInitial(name: string): string {
    return name.charAt(0).toUpperCase();
  }

  function getAvatarUrl(username: string): string | null {
    const p = profiles.value[username];
    if (!p?.avatar_url) return null;
    return apiUrl(p.avatar_url) + `?v=${p._v}`;
  }

  function getProfile(username: string): UserProfile | undefined {
    return profiles.value[username];
  }

  async function updateMyProfile(username: string, data: { nickname?: string | null; responsibilities?: string; capabilities?: string }): Promise<{ nickname: string | null; avatar_url: string | null; responsibilities: string; capabilities: string }> {
    const result = await profileService.updateProfile(username, data);
    const existing = profiles.value[username];
    const next = { ...profiles.value };
    if (existing) {
      next[username] = {
        ...existing,
        nickname: result.nickname,
        responsibilities: result.responsibilities,
        capabilities: result.capabilities,
      };
    } else {
      next[username] = {
        username,
        nickname: result.nickname,
        avatar_url: null,
        responsibilities: result.responsibilities,
        capabilities: result.capabilities,
        _v: 0,
      };
    }
    profiles.value = next;
    return result;
  }

  async function uploadMyAvatar(username: string, file: File): Promise<void> {
    const result = await profileService.uploadAvatar(username, file);
    const existing = profiles.value[username];
    const next = { ...profiles.value };
    if (existing) {
      next[username] = { ...existing, avatar_url: result.avatar_url, _v: Date.now() };
    } else {
      next[username] = {
        username,
        nickname: null,
        avatar_url: result.avatar_url,
        responsibilities: "",
        capabilities: "",
        _v: Date.now(),
      };
    }
    profiles.value = next;
  }

  return {
    profiles,
    loadProfiles,
    getDisplayName,
    getInitial,
    getAvatarUrl,
    getProfile,
    updateMyProfile,
    uploadMyAvatar,
  };
}
