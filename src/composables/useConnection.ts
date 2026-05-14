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
  | "reconnecting";

export interface ConnectionClientOptions extends ClientOptions {
  teamName: string;
}

export function useConnection(
  role: "leader" | "member",
  options: ConnectionClientOptions,
) {
  const clientOpts = { ...options, autoSendResult: false };
  const client = role === "leader"
    ? new Leader(clientOpts)
    : new Member(clientOpts);
  const teamName = options.teamName;
  const myId = options.id;

  const status = ref<ConnectionStatus>("disconnected");
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
      const res = await managerFetch(
        `/api/teams/${encodeURIComponent(teamName)}/configured-members`,
      );
      const data = await res.json() as {
        leader: string;
        members: { username: string; responsibilities?: string; capabilities?: string }[];
      };
      const list: MemberInfo[] = [
        { id: data.leader, role: "leader", status: "offline" },
        ...data.members.map((m) => ({
          id: m.username,
          role: "member" as const,
          status: "offline" as const,
          responsibilities: m.responsibilities,
          capabilities: m.capabilities,
        })),
      ];
      configuredMembers.value = list;
    } catch {
      // API unavailable, fallback to WS-only members
    }
  }

  client.on("connected", () => {
    status.value = "connected";
    loadConfiguredMembers();
  });

  client.on("disconnected", () => {
    status.value = "disconnected";
  });

  client.on("reconnecting", (_attempt: number) => {
    status.value = "reconnecting";
  });

  function connect() {
    status.value = "connecting";
    return client.connect();
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
    configuredMembers,
    onlineIds,
    members,
    connect,
    disconnect,
  };
}
