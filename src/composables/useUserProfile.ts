import { ref } from "vue";
import { fetchProfiles, updateProfile, uploadAvatar, apiUrl, type UserProfile } from "../api";
import { getErrorMessage } from "../utils/error";

const profiles = ref<Map<string, UserProfile>>(new Map());

export function useUserProfile() {
  async function loadProfiles(usernames: string[]): Promise<void> {
    if (usernames.length === 0) return;
    try {
      const list = await fetchProfiles(usernames);
      const newMap = new Map(profiles.value);
      for (const p of list) newMap.set(p.username, p);
      profiles.value = newMap;
    } catch (e: unknown) {
      console.error("[useUserProfile] fetchProfiles failed:", getErrorMessage(e));
    }
  }

  function getDisplayName(username: string): string {
    const p = profiles.value.get(username);
    if (p?.nickname) return p.nickname;
    return username;
  }

  function getAvatarUrl(username: string): string | null {
    const p = profiles.value.get(username);
    if (!p?.avatar_url) return null;
    return apiUrl(p.avatar_url);
  }

  function getProfile(username: string): UserProfile | undefined {
    return profiles.value.get(username);
  }

  async function updateMyProfile(username: string, data: { nickname?: string | null }): Promise<void> {
    const result = await updateProfile(username, data);
    const existing = profiles.value.get(username);
    if (existing) {
      profiles.value.set(username, { ...existing, nickname: result.nickname });
    }
  }

  async function uploadMyAvatar(username: string, file: File): Promise<void> {
    const result = await uploadAvatar(username, file);
    const existing = profiles.value.get(username);
    if (existing) {
      profiles.value.set(username, { ...existing, avatar_url: result.avatar_url });
    }
  }

  return {
    profiles,
    loadProfiles,
    getDisplayName,
    getAvatarUrl,
    getProfile,
    updateMyProfile,
    uploadMyAvatar,
  };
}
