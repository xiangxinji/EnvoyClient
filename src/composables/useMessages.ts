import { ref } from "vue";
import { invoke } from "@tauri-apps/api/core";
import type { Message } from "@envoy/core";
import type { TimelineItem, ChatMessage, TaskMessage, TaskResource, MessageAttachment } from "../types";
import { managerPost, apiUrl } from "../api";

const isTauri = "__TAURI_INTERNALS__" in window;

function safeInvoke(cmd: string, args: Record<string, unknown>) {
  if (!isTauri) return Promise.resolve();
  return invoke(cmd, args);
}

export function useMessages(
  myId: string,
  teamName: string,
) {
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
      // no history files yet
    }
  }

  function handleIncomingMessage(msg: Message): boolean {
    if (msg.type === "message" && msg.subtype === "chat") {
      const payload = msg.payload as { text: string; attachments?: MessageAttachment[] };
      if (payload.attachments) {
        for (const att of payload.attachments) {
          if (att.url.startsWith("/")) att.url = apiUrl(att.url);
        }
      }
      const chatMsg: ChatMessage = {
        type: "chat",
        id: msg.id,
        from: msg.from,
        to: msg.to,
        text: payload.text,
        timestamp: msg.timestamp,
        mine: msg.from === myId,
        attachments: payload.attachments,
      };
      const peerId = msg.from === myId ? msg.to : msg.from;
      addToConversation(peerId, chatMsg);
      if (msg.from !== myId) {
        incrementUnread(peerId);
      }
      return true;
    }
    return false;
  }

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

  function sendChat(targetId: string, text: string, attachments?: MessageAttachment[]) {
    const chatMsg: ChatMessage = {
      type: "chat",
      id: `${Date.now()}-local`,
      from: myId,
      to: targetId,
      text,
      timestamp: Date.now(),
      mine: true,
      attachments: attachments?.length ? attachments : undefined,
    };
    addToConversation(targetId, chatMsg);
    const body: Record<string, unknown> = { from: myId, to: targetId, text };
    if (attachments?.length) body.attachments = attachments;
    managerPost("/api/messages", body, { team: teamName });
  }

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

  async function clearConversation(peerId: string) {
    const newMessages = new Map(messages.value);
    newMessages.delete(peerId);
    messages.value = newMessages;

    const newUnread = new Map(unreadCounts.value);
    newUnread.delete(peerId);
    unreadCounts.value = newUnread;

    await safeInvoke("delete_history", { myId, peerId });
  }

  return {
    messages,
    unreadCounts,
    getConversation,
    addToConversation,
    incrementUnread,
    markRead,
    loadHistory,
    handleIncomingMessage,
    handleTaskUpdate,
    sendChat,
    exportHistory,
    importHistory,
    clearConversation,
  };
}
