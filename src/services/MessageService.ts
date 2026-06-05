import { managerPost, managerDelete, managerUpload, apiUrl } from "../api";
import type { MessageAttachment } from "../types";
import type { ServiceConfig, SendOptions, SendResult } from "./types";

export class MessageService {
  constructor(
    private readonly getConfig: () => Readonly<ServiceConfig>,
  ) {}

  async send(targetId: string, text: string, options?: Readonly<SendOptions>): Promise<SendResult> {
    const { myId, teamName } = this.getConfig();
    const isChannel = !!options?.channel;
    const body: Record<string, unknown> = { from: myId, text };
    if (!isChannel) body.to = targetId;
    if (options?.attachments?.length) body.attachments = options.attachments;
    if (options?.source) body.source = options.source;
    if (options?.forwarded?.length) body.forwarded = options.forwarded;
    if (options?.quote) body.quote = options.quote;
    if (options?.sticker) body.sticker = options.sticker;
    if (options?.channel) body.channel = options.channel;
    if (options?.mentions?.length) body.mentions = options.mentions;
    if (options?.cloudRefs?.length) body.cloudRefs = options.cloudRefs;

    const res = await managerPost("/api/messages", body, { team: teamName });
    return res.json() as Promise<SendResult>;
  }

  async revoke(msgId: string): Promise<boolean> {
    const { myId, teamName } = this.getConfig();
    try {
      await managerDelete(
        `/api/messages/${encodeURIComponent(msgId)}?from=${encodeURIComponent(myId)}`,
        { team: teamName },
      );
      return true;
    } catch (e) {
      console.warn("[messageService] revoke failed:", e);
      return false;
    }
  }

  async uploadAttachment(file: File): Promise<MessageAttachment> {
    const { myId, teamName } = this.getConfig();
    const formData = new FormData();
    formData.append("file", file);
    formData.append("from", myId);

    const res = await managerUpload("/api/messages/attachments", formData, { team: teamName });
    const data = (await res.json()) as MessageAttachment;
    return { ...data, url: apiUrl(data.url) };
  }
}
