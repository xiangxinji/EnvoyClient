import { ref } from "vue";
import type { Message } from "@envoy/core";
import type { TimelineItem, ChatMessage, TaskMessage, TaskResource, MessageAttachment } from "../types";
import { managerPost, managerFetch, apiUrl } from "../api";

interface SyncResponse {
  messages: SyncMessage[];
  has_more: boolean;
  last_seq: number;
}

interface SyncMessage {
  seq: number;
  id: string;
  type: string;
  subtype: string | null;
  from_user: string;
  to_user: string;
  content: string;
  extra: string | null;
  created_at: number;
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
  }

  function incrementUnread(peerId: string) {
    unreadCounts.value.set(peerId, (unreadCounts.value.get(peerId) ?? 0) + 1);
  }

  function markRead(peerId: string) {
    unreadCounts.value.set(peerId, 0);
  }

  function syncMessageToTimeline(msg: SyncMessage): TimelineItem {
    if (msg.type === "task") {
      const extra = msg.extra ? JSON.parse(msg.extra) as Record<string, unknown> : {};
      return {
        type: "task",
        id: `task-${extra.taskId ?? msg.id}`,
        seq: msg.seq,
        taskId: extra.taskId as string ?? msg.id,
        from: msg.from_user,
        content: msg.content,
        status: (extra.status as TaskMessage["status"]) ?? "pending",
        resources: (extra.resources as TaskResource[]) ?? [],
        subscribe: extra.subscribe as string[] | undefined,
        timestamp: msg.created_at,
      } satisfies TaskMessage;
    }

    const extra = msg.extra ? JSON.parse(msg.extra) as Record<string, unknown> : {};
    return {
      type: "chat",
      id: msg.id,
      seq: msg.seq,
      from: msg.from_user,
      to: msg.to_user,
      text: msg.content,
      timestamp: msg.created_at,
      mine: msg.from_user === myId,
      attachments: extra.attachments as MessageAttachment[] | undefined,
    } satisfies ChatMessage;
  }

  async function loadHistory() {
    try {
      let afterSeq = 0;
      let hasMore = true;

      while (hasMore) {
        const res = await managerFetch(
          `/api/messages/sync?user=${encodeURIComponent(myId)}&after_seq=${afterSeq}&limit=200`,
          { headers: { team: teamName } },
        );
        const data = await res.json() as SyncResponse;

        for (const msg of data.messages) {
          const item = syncMessageToTimeline(msg);
          const peerId = msg.from_user === myId ? msg.to_user : msg.from_user;
          addToConversation(peerId, item);
        }

        hasMore = data.has_more;
        afterSeq = data.last_seq;
      }
    } catch {
      // no history or server unreachable
    }
  }

  function handleIncomingMessage(msg: Message): boolean {
    if (msg.type === "message" && msg.subtype === "chat") {
      const payload = msg.payload as { text: string; id?: string; seq?: number; attachments?: MessageAttachment[] };
      if (payload.attachments) {
        for (const att of payload.attachments) {
          if (att.url.startsWith("/")) att.url = apiUrl(att.url);
        }
      }
      const chatMsg: ChatMessage = {
        type: "chat",
        id: payload.id ?? msg.id,
        seq: payload.seq ?? 0,
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
      seq: 0,
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

  async function sendChat(targetId: string, text: string, attachments?: MessageAttachment[]) {
    const body: Record<string, unknown> = { from: myId, to: targetId, text };
    if (attachments?.length) body.attachments = attachments;

    try {
      const res = await managerPost("/api/messages", body, { team: teamName });
      const data = await res.json() as { ok: boolean; id: string; seq: number };

      const chatMsg: ChatMessage = {
        type: "chat",
        id: data.id,
        seq: data.seq,
        from: myId,
        to: targetId,
        text,
        timestamp: Date.now(),
        mine: true,
        attachments: attachments?.length ? attachments : undefined,
      };
      addToConversation(targetId, chatMsg);
    } catch {
      // Fallback: show message optimistically with temp ID
      const chatMsg: ChatMessage = {
        type: "chat",
        id: `${Date.now()}-local`,
        seq: 0,
        from: myId,
        to: targetId,
        text,
        timestamp: Date.now(),
        mine: true,
        attachments: attachments?.length ? attachments : undefined,
      };
      addToConversation(targetId, chatMsg);
    }
  }

  function clearConversation(peerId: string) {
    const newMessages = new Map(messages.value);
    newMessages.delete(peerId);
    messages.value = newMessages;

    const newUnread = new Map(unreadCounts.value);
    newUnread.delete(peerId);
    unreadCounts.value = newUnread;
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
    clearConversation,
  };
}
