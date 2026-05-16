import type { MemberInfo } from "../types";
import type { Message } from "@envoy/core";
import { useConnection } from "./useConnection";
import type { ConnectionStatus, ConnectionClientOptions } from "./useConnection";
import { useMessages } from "./useMessages";
import { useTaskExecution } from "./useTaskExecution";
import { managerPost } from "../api";

export type { ConnectionStatus };
export type { ConnectionClientOptions as TeamClientOptions };

export function useTeamClient(
  role: "leader" | "member",
  options: ConnectionClientOptions,
) {
  // 1. Connection layer
  const conn = useConnection(role, options);

  // 2. Message layer
  const msg = useMessages(conn.myId, conn.teamName);

  // 3. Task execution layer
  const taskExec = useTaskExecution({
    role,
    myId: conn.myId,
    teamName: conn.teamName,
  });

  // ─── Glue: bridge connection events to message layer ───

  conn.client.on("connected", () => {
    msg.loadHistory();
  });

  conn.client.on("message", (msgObj: Message) => {
    // team:members handled by connection layer
    if (msgObj.type === "notify" && msgObj.subtype === "team:members") {
      const payload = msgObj.payload as { members: MemberInfo[] };
      conn.onlineIds.value = new Set(payload.members.map((m) => m.id));
      if (conn.configuredMembers.value.length === 0) {
        conn.configuredMembers.value = payload.members.map((m) => ({
          ...m,
          status: "online" as const,
        }));
      }
      return;
    }
    msg.handleIncomingMessage(msgObj);
  });

  conn.client.on("task", msg.handleTaskUpdate);

  // Register task execution handler
  taskExec.registerHandler(conn.client);

  // ─── Public interface ───

  function dispatchTask(targetIds: string[], content: string) {
    managerPost("/api/tasks", {
      from: conn.myId,
      content,
      subscribe: targetIds,
      mode: "serial",
    }, { team: conn.teamName });
  }

  return {
    myId: conn.myId,
    role,
    teamName: conn.teamName,
    status: conn.status,
    members: conn.members,
    messages: msg.messages,
    unreadCounts: msg.unreadCounts,
    connect: conn.connect,
    disconnect: conn.disconnect,
    sendChat: msg.sendChat,
    dispatchTask,
    getConversation: msg.getConversation,
    incrementUnread: msg.incrementUnread,
    markRead: msg.markRead,
    clearConversation: msg.clearConversation,
  };
}
