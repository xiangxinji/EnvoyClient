import { ref } from "vue";
import type { Message } from "@envoy/core";
import type { TimelineItem, ChatMessage, TaskMessage, TaskResource, MessageAttachment, RevokedNotice, ForwardedRecord, QuoteInfo } from "../types";
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
  source: string;
  channel: string | null;
  mentions: string | null;
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
    if (item.id && conv.some(t => t.id === item.id)) return;
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
      source: (msg.source === "ai-auto" ? "ai-auto" : "human") as "human" | "ai-auto",
      attachments: extra.attachments as MessageAttachment[] | undefined,
      forwarded: extra.forwarded as ForwardedRecord[] | undefined,
      quote: extra.quote as QuoteInfo | undefined,
      channel: msg.channel ?? undefined,
      mentions: msg.mentions ? JSON.parse(msg.mentions) as string[] : undefined,
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
          const peerId = msg.channel ? "__team__" : (msg.from_user === myId ? msg.to_user : msg.from_user);
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
    if (msg.type === "message" && msg.subtype === "chat-revoke") {
      const payload = msg.payload as { msgId: string };
      const revokedFrom = msg.from;
      const notice: RevokedNotice = {
        type: "revoked",
        id: payload.msgId,
        seq: 0,
        from: revokedFrom,
        timestamp: Date.now(),
      };
      for (const [peerId, items] of messages.value) {
        const idx = items.findIndex(
          (t) => t.type === "chat" && t.id === payload.msgId,
        );
        if (idx >= 0) {
          const updated = [...items];
          updated[idx] = notice;
          messages.value.set(peerId, updated);
        }
      }
      return true;
    }

    if (msg.type === "message" && msg.subtype === "chat") {
      const payload = msg.payload as { text: string; id?: string; seq?: number; source?: string; attachments?: MessageAttachment[]; forwarded?: ForwardedRecord[]; quote?: QuoteInfo; channel?: string; mentions?: string[] };
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
        source: (payload.source === "ai-auto" ? "ai-auto" : "human") as "human" | "ai-auto",
        attachments: payload.attachments,
        forwarded: payload.forwarded,
        quote: payload.quote,
        channel: payload.channel,
        mentions: payload.mentions,
      };
      const peerId = payload.channel ? "__team__" : (msg.from === myId ? msg.to : msg.from);
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

  async function sendChat(targetId: string, text: string, options?: { attachments?: MessageAttachment[]; source?: "human" | "ai-auto"; forwarded?: ForwardedRecord[]; quote?: QuoteInfo; channel?: string; mentions?: string[] }) {
    const attachments = options?.attachments;
    const source = options?.source;
    const forwarded = options?.forwarded;
    const quote = options?.quote;
    const channel = options?.channel;
    const mentions = options?.mentions;
    const isChannel = !!channel;
    const body: Record<string, unknown> = { from: myId, text };
    if (!isChannel) body.to = targetId;
    if (attachments?.length) body.attachments = attachments;
    if (source) body.source = source;
    if (forwarded?.length) body.forwarded = forwarded;
    if (quote) body.quote = quote;
    if (channel) body.channel = channel;
    if (mentions?.length) body.mentions = mentions;

    try {
      const res = await managerPost("/api/messages", body, { team: teamName });
      const data = await res.json() as { ok: boolean; id: string; seq: number };

      const chatMsg: ChatMessage = {
        type: "chat",
        id: data.id,
        seq: data.seq,
        from: myId,
        to: isChannel ? "__team__" : targetId,
        text,
        timestamp: Date.now(),
        mine: true,
        source,
        attachments: attachments?.length ? attachments : undefined,
        forwarded: forwarded?.length ? forwarded : undefined,
        quote,
        channel,
        mentions,
      };
      addToConversation(isChannel ? "__team__" : targetId, chatMsg);
    } catch {
      // Fallback: show message optimistically with temp ID
      const chatMsg: ChatMessage = {
        type: "chat",
        id: `${Date.now()}-local`,
        seq: 0,
        from: myId,
        to: isChannel ? "__team__" : targetId,
        text,
        timestamp: Date.now(),
        mine: true,
        source,
        attachments: attachments?.length ? attachments : undefined,
        forwarded: forwarded?.length ? forwarded : undefined,
        quote,
        channel,
        mentions,
      };
      addToConversation(isChannel ? "__team__" : targetId, chatMsg);
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

  async function revokeMessage(peerId: string, msgId: string): Promise<boolean> {
    try {
      const res = await fetch(
        apiUrl(`/api/messages/${encodeURIComponent(msgId)}?from=${encodeURIComponent(myId)}`),
        {
          method: "DELETE",
          headers: { team: teamName },
        },
      );
      if (!res.ok) return false;

      const items = messages.value.get(peerId);
      if (items) {
        const notice: RevokedNotice = {
          type: "revoked",
          id: msgId,
          seq: 0,
          from: myId,
          timestamp: Date.now(),
        };
        messages.value.set(peerId, items.map((t) => t.id === msgId ? notice : t));
      }
      return true;
    } catch {
      return false;
    }
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
    revokeMessage,
  };
}
