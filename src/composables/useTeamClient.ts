import { i18n } from "../i18n";
import type { MemberInfo } from "../types";
import type { Message } from "@envoy/core";
import type { Task } from "../../envoy/packages/core/task.js";
import { useConnection } from "./useConnection";
import type { ConnectionStatus, ConnectionClientOptions } from "./useConnection";
import { useMessages } from "./useMessages";
import { useTaskExecution } from "./useTaskExecution";
import { useAutoReply } from "./useAutoReply";
import { getMemberSettings, setTeamClientInstance } from "./teamClientContext";
import { managerPost } from "../api";
import { sendDesktopNotification } from "../utils/notification";

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

  // 4. Auto-reply layer
  const autoReply = useAutoReply({
    myId: conn.myId,
    teamName: conn.teamName,
    role,
    getConversation: msg.getConversation,
    sendChat: msg.sendChat,
  });

  const { settings: memberSettings } = getMemberSettings();

  // ─── Glue: bridge connection events to message layer ───

  let isFirstConnect = true;

  conn.client.on("connected", () => {
    if (isFirstConnect) {
      isFirstConnect = false;
      msg.loadHistory();
      return;
    }

    // Reconnect recovery: rejoin team + sync missed data
    const joinRole = role === "leader" ? "leader" : "member";
    conn.client.send("team:join", { role: joinRole });
    msg.loadHistory();
    conn.loadConfiguredMembers();
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

    // Trigger auto-reply if enabled and message is from someone else
    if (msgObj.type === "message" && msgObj.subtype === "chat" && msgObj.from !== conn.myId) {
      if (memberSettings.value.ai_auto_reply) {
        autoReply.trigger(msgObj.from, memberSettings.value.ai_suggestion_history_count);
      }
    }
  });

  conn.client.on("task", msg.handleTaskUpdate);

  // Track previous task statuses for notification dedup
  const prevTaskStatus = new Map<string, string>();

  conn.client.on("task", (task: Task) => {
    const prev = prevTaskStatus.get(task.id);
    prevTaskStatus.set(task.id, task.status);

    // Skip notification if no previous status (first load) or status unchanged
    if (!prev || prev === task.status) return;

    const content = task.content.length > 30 ? task.content.slice(0, 30) + "..." : task.content;
    const myId = conn.myId;

    switch (task.status) {
      case "running": {
        // Dispatched to members — notify assigned members (not self if Leader)
        const isSubscriber = task.subscribe.includes(myId);
        if (isSubscriber && prev === "pending") {
          sendDesktopNotification(i18n.global.t('notification.newTask'), content);
        }
        break;
      }
      case "completed": {
        // Notify creator + all subscribers, but skip if I triggered it
        // (Leader approved → skip notifying self)
        const isRelevant = task.createBy === myId || task.subscribe.includes(myId);
        if (isRelevant) {
          sendDesktopNotification(i18n.global.t('notification.taskCompleted'), content);
        }
        break;
      }
      case "failed": {
        const isRelevant = task.createBy === myId || task.subscribe.includes(myId);
        if (isRelevant) {
          sendDesktopNotification(i18n.global.t('notification.taskFailed'), content);
        }
        break;
      }
      case "reviewing": {
        // Notify creator (Leader), but skip if I'm the one who just completed
        if (task.createBy === myId) {
          sendDesktopNotification(i18n.global.t('notification.taskReviewing'), content);
        }
        break;
      }
    }
  });

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

  function logout() {
    conn.disconnect();
    autoReply.dispose();
    setTeamClientInstance(null);
  }

  return {
    myId: conn.myId,
    role,
    teamName: conn.teamName,
    status: conn.status,
    reconnectAttempt: conn.reconnectAttempt,
    members: conn.members,
    client: conn.client,
    messages: msg.messages,
    unreadCounts: msg.unreadCounts,
    connect: conn.connect,
    disconnect: conn.disconnect,
    logout,
    sendChat: msg.sendChat,
    dispatchTask,
    getConversation: msg.getConversation,
    incrementUnread: msg.incrementUnread,
    markRead: msg.markRead,
    clearConversation: msg.clearConversation,
    revokeMessage: msg.revokeMessage,
    autoReplyDispose: autoReply.dispose,
  };
}
