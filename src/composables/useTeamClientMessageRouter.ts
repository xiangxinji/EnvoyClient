import { i18n } from "../i18n";
import type { MemberInfo } from "../types";
import type { Message } from "@envoy/core";
import { sendDesktopNotification, requestTaskbarAttention } from "../utils/notification";

export function useTeamClientMessageRouter(deps: {
  myId: string;
  onMemberUpdate: (members: MemberInfo[], onlineIds: Set<string>) => void;
  onIncomingMessage: (msg: Message) => void;
  onAutoReply: (from: string, historyCount: number) => void;
  aiAutoReplyEnabled: () => boolean;
  aiHistoryCount: () => number;
}) {
  function routeMessage(msgObj: Message) {
    // team:members handled by connection layer
    if (msgObj.type === "notify" && msgObj.subtype === "team:members") {
      const payload = msgObj.payload as { members: MemberInfo[] };
      const onlineIds = new Set(payload.members.map((m) => m.id));
      deps.onMemberUpdate(payload.members, onlineIds);
      return;
    }

    // channel-mention notification
    if (msgObj.type === "notify" && msgObj.subtype === "channel-mention") {
      const payload = msgObj.payload as { from: string; channel: string; text: string };
      sendDesktopNotification(
        `${payload.from} ${i18n.global.t('notification.channelMention', 'mentioned you in #General')}`,
        payload.text,
      );
      requestTaskbarAttention();
      return;
    }

    deps.onIncomingMessage(msgObj);

    // Flash taskbar if message is from someone else (window likely unfocused)
    if (msgObj.type === "message" && msgObj.from !== deps.myId) {
      requestTaskbarAttention();
    }

    // Trigger auto-reply if enabled and message is from someone else (exclude channel messages)
    if (msgObj.type === "message" && msgObj.subtype === "chat" && msgObj.from !== deps.myId) {
      const payload = msgObj.payload as { channel?: string };
      if (payload.channel) return; // Skip auto-reply for channel messages
      if (deps.aiAutoReplyEnabled()) {
        deps.onAutoReply(msgObj.from, deps.aiHistoryCount());
      }
    }
  }

  return { routeMessage };
}
