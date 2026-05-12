import { ref } from "vue";
import type { InjectionKey } from "vue";
import type { useTeamClient } from "./useTeamClient";

export type TeamClientContext = ReturnType<typeof useTeamClient>;

export const TeamClientKey: InjectionKey<TeamClientContext> = Symbol("team-client");

const _instance = ref<TeamClientContext | null>(null);

export function setTeamClientInstance(ctx: TeamClientContext) {
  _instance.value = ctx;
}

export function getTeamClientInstance(): TeamClientContext | null {
  return _instance.value;
}

export function useTeamClientInstance() {
  return _instance;
}
