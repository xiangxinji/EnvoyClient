import { ref, computed, onUnmounted } from "vue";
import { Leader } from "../../envoy/packages/teams/leader.js";
import { Member } from "../../envoy/packages/teams/member.js";
import type { ClientOptions } from "@envoy/client";
import type { MemberInfo } from "../types";
import { managerFetch } from "../api";

export type ConnectionStatus =
  | "disconnected"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "reconnect_failed";

export interface ConnectionClientOptions extends ClientOptions {
  teamName: string;
}

export function useConnection(
  role: "leader" | "member",
  options: ConnectionClientOptions,
) {
  const clientOpts = { ...options };
  const client = role === "leader"
    ? new Leader(clientOpts)
    : new Member(clientOpts);
  const teamName = options.teamName;
  const myId = options.id;

  const status = ref<ConnectionStatus>("disconnected");
  const reconnectAttempt = ref(0);
  const configuredMembers = ref<MemberInfo[]>([]);
  const onlineIds = ref<Set<string>>(new Set());

  const members = computed<MemberInfo[]>(() => {
    return configuredMembers.value
      .map((m) => ({
        ...m,
        status: onlineIds.value.has(m.id) ? "online" as const : "offline" as const,
      }))
      .filter((m) => m.id !== myId);
  });

  async function loadConfiguredMembers() {
    try {
      const url = `/api/teams/${encodeURIComponent(teamName)}/configured-members`;
      console.log("[useConnection] fetching configured members:", url);
      const res = await managerFetch(url);
      const data = await res.json() as {
        leader: { username: string; nickname?: string | null; avatar_url?: string | null };
        members: { username: string; role?: string; nickname?: string | null; avatar_url?: string | null; responsibilities?: string; capabilities?: string }[];
      };
      console.log("[useConnection] configured members response:", data);
      const list: MemberInfo[] = [
        { id: data.leader.username, role: "leader", status: "offline", nickname: data.leader.nickname, avatar_url: data.leader.avatar_url },
        ...data.members.map((m) => ({
          id: m.username,
          role: (m.role === "leader" ? "leader" : "member") as "leader" | "member",
          status: "offline" as const,
          nickname: m.nickname ?? null,
          avatar_url: m.avatar_url ?? null,
          responsibilities: m.responsibilities,
          capabilities: m.capabilities,
        })),
      ];
      console.log("[useConnection] member list:", list);
      configuredMembers.value = list;
    } catch (e) {
      console.error("[useConnection] loadConfiguredMembers failed:", e);
    }
  }

  client.on("connected", () => {
    status.value = "connected";
    reconnectAttempt.value = 0;
  });

  client.on("disconnected", () => {
    status.value = "disconnected";
  });

  client.on("reconnecting", (attempt: number) => {
    status.value = "reconnecting";
    reconnectAttempt.value = attempt;
  });

  client.on("reconnect_failed", () => {
    status.value = "reconnect_failed";
  });

  async function connect() {
    status.value = "connecting";
    await client.connect();
    await loadConfiguredMembers();
  }

  function disconnect() {
    return client.disconnect();
  }

  onUnmounted(() => {
    client.disconnect();
  });

  return {
    client,
    myId,
    role,
    teamName,
    status,
    reconnectAttempt,
    configuredMembers,
    onlineIds,
    members,
    connect,
    disconnect,
    loadConfiguredMembers,
  };
}
