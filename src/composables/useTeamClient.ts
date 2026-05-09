import { ref, onUnmounted } from "vue";
import { Leader } from "../../Envoy/packages/teams/leader.js";
import { Member } from "../../Envoy/packages/teams/member.js";
import type { ClientOptions } from "@envoy/client";
import type { Message } from "@envoy/core";
import type { MemberInfo, TimelineItem, ChatMessage, TaskMessage } from "../types";

export type ConnectionStatus =
  | "disconnected"
  | "connecting"
  | "connected"
  | "reconnecting";

export function useTeamClient(role: "leader" | "member", options: ClientOptions) {
  const client = role === "leader" ? new Leader(options) : new Member(options);
  const myId = options.id;

  const status = ref<ConnectionStatus>("disconnected");
  const members = ref<MemberInfo[]>([]);
  const messages = ref<Map<string, TimelineItem[]>>(new Map());
  const unreadCounts = ref<Map<string, number>>(new Map());

  function getConversation(peerId: string): TimelineItem[] {
    return messages.value.get(peerId) ?? [];
  }

  function addToConversation(peerId: string, item: TimelineItem) {
    const conv = messages.value.get(peerId) ?? [];
    conv.push(item);
    messages.value.set(peerId, conv);
  }

  function syncUnread(peerId: string, isCurrentPeer: boolean) {
    if (!isCurrentPeer) {
      unreadCounts.value.set(peerId, (unreadCounts.value.get(peerId) ?? 0) + 1);
    }
  }

  client.on("connected", () => {
    status.value = "connected";
  });

  client.on("disconnected", () => {
    status.value = "disconnected";
  });

  client.on("reconnecting", (_attempt: number) => {
    status.value = "reconnecting";
  });

  client.on("message", (msg: Message) => {
    if (msg.type === "notify" && msg.subtype === "team:members") {
      const payload = msg.payload as { members: MemberInfo[] };
      members.value = payload.members.filter((m) => m.id !== myId);
      return;
    }

    if (msg.type === "message" && msg.subtype === "chat") {
      const chatMsg: ChatMessage = {
        type: "chat",
        id: msg.id,
        from: msg.from,
        to: msg.to,
        text: (msg.payload as { text: string }).text,
        timestamp: msg.timestamp,
        mine: msg.from === myId,
      };
      const peerId = msg.from === myId ? msg.to : msg.from;
      addToConversation(peerId, chatMsg);
      return;
    }

    if (msg.type === "task") {
      const task = msg.payload as {
        id: string;
        createBy: string;
        content: string;
        status: string;
        resources: unknown[];
      };
      const taskMsg: TaskMessage = {
        type: "task",
        id: msg.id,
        taskId: task.id,
        from: task.createBy,
        content: task.content,
        status: task.status as TaskMessage["status"],
        timestamp: msg.timestamp,
      };
      const peerId = task.createBy === myId ? (msg.to !== "server" ? msg.to : task.createBy) : task.createBy;
      const existing = getConversation(peerId);
      const idx = existing.findIndex((t) => t.type === "task" && "taskId" in t && t.taskId === task.id);
      if (idx >= 0) {
        existing[idx] = taskMsg;
        messages.value.set(peerId, [...existing]);
      } else {
        addToConversation(peerId, taskMsg);
      }
      return;
    }
  });

  function connect() {
    status.value = "connecting";
    return client.connect();
  }

  function disconnect() {
    return client.disconnect();
  }

  function sendChat(targetId: string, text: string) {
    const chatMsg: ChatMessage = {
      type: "chat",
      id: `${Date.now()}-local`,
      from: myId,
      to: targetId,
      text,
      timestamp: Date.now(),
      mine: true,
    };
    addToConversation(targetId, chatMsg);
    client.sendTo(targetId, "chat", { text });
  }

  function dispatchTask(targetId: string, content: string) {
    client.submit({
      content,
      subscribe: [targetId],
      mode: "serial",
    });
  }

  onUnmounted(() => {
    client.disconnect();
  });

  return {
    myId,
    role,
    status,
    members,
    messages,
    unreadCounts,
    connect,
    disconnect,
    sendChat,
    dispatchTask,
    getConversation,
    syncUnread,
  };
}
