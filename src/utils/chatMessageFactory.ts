import type { ChatMessage, MessageAttachment, ForwardedRecord, QuoteInfo, StickerInfo, CloudRef } from "../types";

interface BuildChatMessageOptions {
  id: string;
  seq: number;
  from: string;
  to: string;
  text: string;
  timestamp: number;
  mine: boolean;
  source?: "human" | "ai-auto";
  attachments?: MessageAttachment[];
  forwarded?: ForwardedRecord[];
  quote?: QuoteInfo;
  sticker?: StickerInfo;
  channel?: string;
  mentions?: string[];
  cloudRefs?: CloudRef[];
}

export function buildChatMessage(opts: BuildChatMessageOptions): ChatMessage {
  return {
    type: "chat",
    id: opts.id,
    seq: opts.seq,
    from: opts.from,
    to: opts.to,
    text: opts.text,
    timestamp: opts.timestamp,
    mine: opts.mine,
    source: opts.source ?? "human",
    attachments: opts.attachments?.length ? opts.attachments : undefined,
    forwarded: opts.forwarded?.length ? opts.forwarded : undefined,
    quote: opts.quote,
    sticker: opts.sticker,
    channel: opts.channel,
    mentions: opts.mentions,
    cloudRefs: opts.cloudRefs?.length ? opts.cloudRefs : undefined,
  };
}

export function resolvePeerId(channel: string | null | undefined, from: string, to: string, myId: string): string {
  return channel ? "__team__" : (from === myId ? to : from);
}
