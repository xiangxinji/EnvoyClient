import type { TimelineItem, ChatMessage, TaskMessage, TaskResource, MessageAttachment, ForwardedRecord, QuoteInfo, StickerInfo } from "../types";

export interface SyncResponse {
  messages: SyncMessage[];
  has_more: boolean;
  last_seq: number;
}

export interface SyncMessage {
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

export function syncMessageToTimeline(msg: SyncMessage, myId: string): TimelineItem {
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
    sticker: extra.sticker as StickerInfo | undefined,
    channel: msg.channel ?? undefined,
    mentions: msg.mentions ? JSON.parse(msg.mentions) as string[] : undefined,
  } satisfies ChatMessage;
}
