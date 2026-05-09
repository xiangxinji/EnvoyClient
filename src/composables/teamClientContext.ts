import type { InjectionKey } from "vue";
import type { useTeamClient } from "./useTeamClient";

export type TeamClientContext = ReturnType<typeof useTeamClient>;

export const TeamClientKey: InjectionKey<TeamClientContext> = Symbol("team-client");

let _instance: TeamClientContext | null = null;

export function setTeamClientInstance(ctx: TeamClientContext) {
  _instance = ctx;
}

export function getTeamClientInstance(): TeamClientContext | null {
  return _instance;
}
