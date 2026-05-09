import { ref, onUnmounted } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { Leader } from "../../Envoy/packages/teams/leader.js";
import { Member } from "../../Envoy/packages/teams/member.js";
import type { ClientOptions } from "@envoy/client";
import type { Message } from "@envoy/core";
import type { MemberInfo, TimelineItem, ChatMessage, TaskMessage } from "../types";

const isTauri = "__TAURI_INTERNALS__" in window;

function safeInvoke(cmd: string, args: Record<string, unknown>) {
  if (!isTauri) return Promise.resolve();
  return invoke(cmd, args);
}

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
    safeInvoke("save_message", { myId, peerId, message: item });
  }

  function updateInConversation(peerId: string, item: TimelineItem) {
    const existing = messages.value.get(peerId) ?? [];
    messages.value.set(peerId, [...existing]);
    safeInvoke("save_message", { myId, peerId, message: item });
  }

  function syncUnread(peerId: string, isCurrentPeer: boolean) {
    if (!isCurrentPeer) {
      unreadCounts.value.set(peerId, (unreadCounts.value.get(peerId) ?? 0) + 1);
    }
  }

  async function loadHistory() {
    try {
      const all = await safeInvoke("load_all_history", { myId }) as Record<string, TimelineItem[]> | undefined;
      if (all) {
        for (const [peerId, items] of Object.entries(all)) {
          messages.value.set(peerId, items);
        }
      }
    } catch {
      // no history files yet, that's fine
    }
  }

  client.on("connected", () => {
    status.value = "connected";
    loadHistory();
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
        updateInConversation(peerId, taskMsg);
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

  // Member 端自动注册任务处理器
  client.doing(async (clientTask) => {
    alert(clientTask.serverTask.id)
    // 立即完成，实际场景可替换为真正的工作逻辑
    return { done: true, taskId: clientTask.serverTask.id };
  });

  async function exportHistory(peerId: string, targetPath: string) {
    await safeInvoke("export_history", { myId, peerId, targetPath });
  }

  async function importHistory(peerId: string, sourcePath: string) {
    await safeInvoke("import_history", { myId, peerId, sourcePath });
    const items = await safeInvoke("load_history", { myId, peerId }) as TimelineItem[] | undefined;
    if (items) {
      messages.value.set(peerId, items);
    }
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
    exportHistory,
    importHistory,
  };
}
