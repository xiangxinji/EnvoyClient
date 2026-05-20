import { shallowRef } from "vue";
import type { useTeamClient } from "./useTeamClient";
import { useMemberSettings } from "./useMemberSettings";

export type TeamClientContext = ReturnType<typeof useTeamClient>;

const _instance = shallowRef<TeamClientContext | null>(null);
const _memberSettings = useMemberSettings();

export function setTeamClientInstance(ctx: TeamClientContext | null) {
  _instance.value = ctx;
}

export function getTeamClientInstance(): TeamClientContext | null {
  return _instance.value;
}

export function useTeamClientInstance() {
  return _instance;
}

export function getMemberSettings() {
  return _memberSettings;
}
