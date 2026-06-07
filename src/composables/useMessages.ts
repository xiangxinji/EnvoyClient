import { ref, computed } from "vue";
import type { Message } from "@envoy/core";
import type { TimelineItem, TaskMessage, TaskResource, MessageAttachment, RevokedNotice, ForwardedRecord, QuoteInfo, StickerInfo, CloudRef } from "../types";
import { managerFetch, apiUrl } from "../api";
import { syncMessageToTimeline, type SyncResponse, type SyncMessage } from "../utils/messageMapper";
import { buildChatMessage, resolvePeerId } from "../utils/chatMessageFactory";
import { apiTaskToTaskMessage, type ApiTask } from "../utils/taskFormatters";
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
      // Refresh task statuses — sync API may return stale status for tasks
      // that changed state before this session
      try {
        const res = await managerFetch(`/api/teams/${encodeURIComponent(teamName)}/tasks`);
        const tasks = await res.json() as ApiTask[];
        for (const task of tasks) {
          const updated = apiTaskToTaskMessage(task);
          for (const [peerId, items] of messages.value) {
            const idx = items.findIndex((t) => t.type === "task" && t.taskId === task.id);
            if (idx >= 0) {
              items[idx] = updated;
              messages.value.set(peerId, [...items]);
            }
          }
        }
      } catch { /* non-critical */ }
    } catch (e) {
      console.error("[messages] loadHistory failed:", e);
    }
  }

  function handleIncomingMessage(msg: Message): boolean {
    if (msg.type === "message" && msg.subtype === "chat-revoke") {
      const { msgId } = msg.payload as { msgId: string };
      const notice: RevokedNotice = { type: "revoked", id: msgId, seq: 0, from: msg.from, timestamp: Date.now() };
      for (const [peerId, items] of messages.value) {
        const idx = items.findIndex((t) => t.type === "chat" && t.id === msgId);
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
      if (payload.sticker?.url?.startsWith("/")) payload.sticker.url = apiUrl(payload.sticker.url);
      const chatMsg = buildChatMessage({
        id: payload.id ?? msg.id, seq: payload.seq ?? 0, from: msg.from, to: msg.to,
        text: payload.text, timestamp: msg.timestamp, mine: msg.from === myId,
        source: payload.source === "ai-auto" ? "ai-auto" : undefined,
        attachments: payload.attachments, forwarded: payload.forwarded, quote: payload.quote,
        sticker: payload.sticker, channel: payload.channel, mentions: payload.mentions, cloudRefs: payload.cloudRefs,
      });
      const peerId = resolvePeerId(payload.channel, msg.from, msg.to, myId);
      addToConversation(peerId, chatMsg);
      if (msg.from !== myId) incrementUnread(peerId);
      return true;
    }
    return false;
  }

  function handleTaskUpdate(task: {
    id: string;
    createBy: string;
    content: string;
    mode?: string;
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
      mode: task.mode === "parallel" ? "parallel" : "serial",
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
    const { attachments, source, forwarded, quote, sticker, channel, mentions, cloudRefs } = options ?? {};
    const isChannel = !!channel;
    const peerId = isChannel ? "__team__" : targetId;
    let id = `${Date.now()}-local`;
    let seq = 0;

    try {
      const data = await getMessageService().send(targetId, text, {
        attachments, source, forwarded, quote, sticker, channel, mentions, cloudRefs,
      });
      id = data.id;
      seq = data.seq;
    } catch (e) {
      console.error("[messages] sendChat server send failed, using local fallback:", e);
    }

    const chatMsg = buildChatMessage({
      id, seq, from: myId, to: peerId, text, timestamp: Date.now(), mine: true,
      source, attachments, forwarded, quote, sticker, channel, mentions, cloudRefs,
    });
    addToConversation(peerId, chatMsg);
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

  /** Count unique task IDs across all conversations (for badge display) */
  const uniqueTaskCount = computed(() => {
    const seen = new Set<string>();
    for (const items of messages.value.values()) {
      for (const item of items) {
        if (item.type === "task" && !seen.has(item.taskId)) {
          seen.add(item.taskId);
        }
      }
    }
    return seen.size;
  });

  return {
    messages,
    unreadCounts,
    uniqueTaskCount,
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
