import { ref, onUnmounted } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { Leader } from "../../envoy/packages/teams/leader.js";
import { Member } from "../../envoy/packages/teams/member.js";
import type { ClientOptions } from "@envoy/client";
import type { Message } from "@envoy/core";
import type { MemberInfo, TimelineItem, ChatMessage, TaskMessage, TaskResource } from "../types";
import { useAgent } from "./useAgent";
import { getDefaultTools, createUploadResourceTool, createQueryResourcesTool, createReadResourceTool } from "../agent/tools";
import { managerPost } from "../api";

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

export interface TeamClientOptions extends ClientOptions {
  teamName: string;
}

export function useTeamClient(role: "leader" | "member", options: TeamClientOptions) {
  const clientOpts = { ...options, autoSendResult: false };
  const client = role === "leader" ? new Leader(clientOpts) : new Member(clientOpts);
  const myId = options.id;
  const teamName = options.teamName;

  function postToManager(path: string, body: Record<string, unknown>) {
    return managerPost(path, body, { team: teamName });
  }

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

  function incrementUnread(peerId: string) {
    unreadCounts.value.set(peerId, (unreadCounts.value.get(peerId) ?? 0) + 1);
  }

  function markRead(peerId: string) {
    unreadCounts.value.set(peerId, 0);
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
      if (msg.from !== myId) {
        incrementUnread(peerId);
      }
      return;
    }
  });

  function handleTaskUpdate(task: {
    id: string;
    createBy: string;
    content: string;
    status: string;
    resources: TaskResource[];
    subscribe?: string[];
  }) {
    const taskMsg: TaskMessage = {
      type: "task",
      id: `task-${task.id}`,
      taskId: task.id,
      from: task.createBy,
      content: task.content,
      status: task.status as TaskMessage["status"],
      resources: task.resources,
      subscribe: task.subscribe,
      timestamp: Date.now(),
    };

    let updated = false;
    for (const [peerId, items] of messages.value) {
      const idx = items.findIndex((t) => t.type === "task" && "taskId" in t && t.taskId === task.id);
      if (idx >= 0) {
        items[idx] = taskMsg;
        messages.value.set(peerId, [...items]);
        safeInvoke("save_message", { myId, peerId, message: taskMsg });
        updated = true;
      }
    }

    if (!updated) {
      const targetPeers = task.createBy === myId
        ? (task.subscribe ?? [])
        : [task.createBy];
      for (const peerId of targetPeers) {
        addToConversation(peerId, taskMsg);
        incrementUnread(peerId);
      }
    }
  }

  client.on("task", handleTaskUpdate);

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
    postToManager("/api/messages", { from: myId, to: targetId, text });
  }

  function dispatchTask(targetIds: string[], content: string) {
    postToManager("/api/tasks", {
      from: myId,
      content,
      subscribe: targetIds,
      mode: "serial",
    });
  }

  const agent = useAgent();

  client.doing(async (clientTask) => {
    const taskId = clientTask.serverTask.id;
    const taskContent = clientTask.serverTask.content;

    if (!isTauri) {
      const result = { taskId, note: "browser mode, no agent tools" };
      postToManager(`/api/tasks/${taskId}/result`, { from: myId, success: true, data: result });
      return result;
    }

    try {
      const uploadTool = createUploadResourceTool({ teamName, taskId, myId });
      const queryResTool = createQueryResourcesTool({ teamName });
      const readResTool = createReadResourceTool({ teamName });
      const tools = [...getDefaultTools(), uploadTool, queryResTool, readResTool];
      const result = await agent.runAgent(taskContent, tools);
      let parsed;
      try {
        parsed = JSON.parse(result);
      } catch {
        parsed = { result };
      }
      postToManager(`/api/tasks/${taskId}/result`, { from: myId, success: true, data: parsed });
      return parsed;
    } catch (e) {
      const error = String(e);
      postToManager(`/api/tasks/${taskId}/result`, { from: myId, success: false, error });
      return { error };
    }
  });

  async function exportHistory(peerId: string, targetPath: string) {
    await safeInvoke("export_history", { myId, peerId, targetPath });
  }

  async function importHistory(peerId: string, sourcePath: string) {
    await safeInvoke("importHistory", { myId, peerId, sourcePath });
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
    incrementUnread,
    markRead,
    exportHistory,
    importHistory,
  };
}
