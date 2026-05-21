import { ref } from "vue";
import type { Message } from "@envoy/core";
import type { TimelineItem, TaskMessage, TaskResource, MessageAttachment, RevokedNotice, ForwardedRecord, QuoteInfo, StickerInfo, CloudRef } from "../types";
import { managerFetch, apiUrl } from "../api";
import { syncMessageToTimeline, type SyncResponse, type SyncMessage } from "../utils/messageMapper";
import { buildChatMessage, resolvePeerId } from "../utils/chatMessageFactory";
import { getMessageService } from "./teamClientContext";

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
    messages.value.set(peerId, [...conv]);
  }

  function incrementUnread(peerId: string) {
    unreadCounts.value.set(peerId, (unreadCounts.value.get(peerId) ?? 0) + 1);
  }

  function markRead(peerId: string) {
    unreadCounts.value.set(peerId, 0);
  }

  function syncAndRoute(msg: SyncMessage) {
    const item = syncMessageToTimeline(msg, myId);
    const peerId = resolvePeerId(msg.channel, msg.from_user, msg.to_user, myId);
    addToConversation(peerId, item);
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
          syncAndRoute(msg);
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
      const payload = msg.payload as { text: string; id?: string; seq?: number; source?: string; attachments?: MessageAttachment[]; forwarded?: ForwardedRecord[]; quote?: QuoteInfo; sticker?: StickerInfo; channel?: string; mentions?: string[]; cloudRefs?: CloudRef[] };
      if (payload.attachments) {
        for (const att of payload.attachments) {
          if (att.url.startsWith("/")) att.url = apiUrl(att.url);
        }
      }
      const chatMsg = buildChatMessage({
        id: payload.id ?? msg.id,
        seq: payload.seq ?? 0,
        from: msg.from,
        to: msg.to,
        text: payload.text,
        timestamp: msg.timestamp,
        mine: msg.from === myId,
        source: payload.source === "ai-auto" ? "ai-auto" : undefined,
        attachments: payload.attachments,
        forwarded: payload.forwarded,
        quote: payload.quote,
        sticker: payload.sticker,
        channel: payload.channel,
        mentions: payload.mentions,
        cloudRefs: payload.cloudRefs,
      });
      const peerId = resolvePeerId(payload.channel, msg.from, msg.to, myId);
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

  async function sendChat(targetId: string, text: string, options?: { attachments?: MessageAttachment[]; source?: "human" | "ai-auto"; forwarded?: ForwardedRecord[]; quote?: QuoteInfo; sticker?: StickerInfo; channel?: string; mentions?: string[]; cloudRefs?: CloudRef[] }) {
    const attachments = options?.attachments;
    const source = options?.source;
    const forwarded = options?.forwarded;
    const quote = options?.quote;
    const sticker = options?.sticker;
    const channel = options?.channel;
    const mentions = options?.mentions;
    const cloudRefs = options?.cloudRefs;
    const isChannel = !!channel;

    try {
      const data = await getMessageService().send(targetId, text, {
        attachments, source, forwarded, quote, sticker, channel, mentions, cloudRefs,
      });

      const chatMsg = buildChatMessage({
        id: data.id,
        seq: data.seq,
        from: myId,
        to: isChannel ? "__team__" : targetId,
        text,
        timestamp: Date.now(),
        mine: true,
        source,
        attachments,
        forwarded,
        quote,
        sticker,
        channel,
        mentions,
        cloudRefs,
      });
      addToConversation(isChannel ? "__team__" : targetId, chatMsg);
    } catch {
      const chatMsg = buildChatMessage({
        id: `${Date.now()}-local`,
        seq: 0,
        from: myId,
        to: isChannel ? "__team__" : targetId,
        text,
        timestamp: Date.now(),
        mine: true,
        source,
        attachments,
        forwarded,
        quote,
        sticker,
        channel,
        mentions,
        cloudRefs,
      });
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
    const ok = await getMessageService().revoke(msgId);
    if (!ok) return false;

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
