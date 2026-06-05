import type { Ref } from "vue";
import { getErrorMessage } from "../utils/error";
import type {
  ChatMessage,
  ContentSegment,
  QuoteInfo,
  MessageAttachment,
  CloudRef,
} from "../types";
import type { PendingFileAttachment } from "./useFileUpload";

interface UseChatSendDeps {
  /** 获取当前 peerId */
  getPeerId: () => string;
  /** 是否频道 */
  isChannel: Ref<boolean>;
  /** 发送聊天消息 */
  sendChat: (peerId: string, text: string, extra?: Record<string, unknown>) => Promise<void>;
  /** 引用消息 */
  quotingMsg: Ref<ChatMessage | null>;
  /** 待上传文件列表 */
  pendingFiles: Ref<PendingFileAttachment[]>;
  /** 待发送云资源引用 */
  pendingCloudRefs: Ref<CloudRef[]>;
  /** 当前 @ 提及列表 */
  currentMentions: Ref<string[]>;
  /** 是否正在上传 */
  uploading: Ref<boolean>;
  /** 附件错误信息 */
  attachmentError: Ref<string>;
  /** 上传图片段 */
  uploadImages: (segments: { blob: Blob; name: string }[]) => Promise<MessageAttachment[]>;
  /** 上传单个文件附件 */
  uploadAttachment: (file: File) => Promise<MessageAttachment>;
  /** 清空 @ 提及 */
  clearMentions: () => void;
  /** 清空云引用 */
  clearCloudRefs: () => void;
  /** 生成引用快照文本 */
  generateSnapshotText: (msg: ChatMessage) => string;
}

export function useChatSend(deps: UseChatSendDeps) {
  function extractMentionsForText(text: string): string[] | undefined {
    if (!deps.currentMentions.value.length) return undefined;
    const matched = deps.currentMentions.value.filter((id) => text.includes(`@${id}`));
    return matched.length > 0 ? matched : undefined;
  }

  async function handleSegmentedSend(segments: ContentSegment[]) {
    const peerId = deps.getPeerId();
    if (!peerId) return;
    if (segments.length === 0 && deps.pendingFiles.value.length === 0 && deps.pendingCloudRefs.value.length === 0) return;
    deps.attachmentError.value = "";

    const quoteInfo: QuoteInfo | undefined = deps.quotingMsg.value
      ? { id: deps.quotingMsg.value.id, from: deps.quotingMsg.value.from, text: deps.generateSnapshotText(deps.quotingMsg.value), timestamp: deps.quotingMsg.value.timestamp }
      : undefined;

    let isFirst = true;

    for (const seg of segments) {
      try {
        if (seg.type === "text") {
          const mentions = deps.isChannel.value ? extractMentionsForText(seg.content) : undefined;
          await deps.sendChat(peerId, seg.content || " ", {
            quote: isFirst ? quoteInfo : undefined,
            channel: deps.isChannel.value ? "general" : undefined,
            mentions,
          });
        } else if (seg.type === "image") {
          deps.uploading.value = true;
          const [uploaded] = await deps.uploadImages([seg]);
          deps.uploading.value = false;
          await deps.sendChat(peerId, " ", {
            attachments: [uploaded],
            quote: isFirst ? quoteInfo : undefined,
            channel: deps.isChannel.value ? "general" : undefined,
          });
        }
        isFirst = false;
      } catch (e: unknown) {
        deps.attachmentError.value = getErrorMessage(e);
        deps.uploading.value = false;
        break;
      }
    }

    for (const ref of deps.pendingCloudRefs.value) {
      try {
        await deps.sendChat(peerId, "{cloud:0}", {
          cloudRefs: [ref],
          quote: isFirst ? quoteInfo : undefined,
          channel: deps.isChannel.value ? "general" : undefined,
        });
        isFirst = false;
      } catch (e: unknown) {
        deps.attachmentError.value = getErrorMessage(e);
        break;
      }
    }

    for (const att of deps.pendingFiles.value) {
      try {
        deps.uploading.value = true;
        const data = await deps.uploadAttachment(att.file);
        deps.uploading.value = false;
        await deps.sendChat(peerId, " ", {
          attachments: [data],
          channel: deps.isChannel.value ? "general" : undefined,
        });
      } catch (e: unknown) {
        deps.attachmentError.value = getErrorMessage(e);
        deps.uploading.value = false;
        break;
      }
    }

    deps.clearMentions();
    deps.clearCloudRefs();
    deps.pendingFiles.value = [];
    if (quoteInfo) deps.quotingMsg.value = null;
  }

  return { handleSegmentedSend };
}
