import type { ChatMessage, TimelineItem } from "../types";
import { managerFetch } from "../api";

const DEBOUNCE_MS = 5000;

export interface AutoReplyOptions {
  myId: string;
  teamName: string;
  role: string;
  getConversation: (peerId: string) => TimelineItem[];
  sendChat: (targetId: string, text: string, options?: { source?: "human" | "ai-auto" }) => void;
}

export function useAutoReply(opts: AutoReplyOptions) {
  const timers = new Map<string, ReturnType<typeof setTimeout>>();

  function trigger(peerId: string, historyCount: number) {
    // Reset existing timer for this peer
    const existing = timers.get(peerId);
    if (existing) clearTimeout(existing);

    const timer = setTimeout(() => {
      timers.delete(peerId);
      void generateReply(peerId, historyCount);
    }, DEBOUNCE_MS);

    timers.set(peerId, timer);
  }

  async function generateReply(peerId: string, historyCount: number) {
    try {
      const conversation = opts.getConversation(peerId);
      const chatMsgs = conversation.filter((m): m is ChatMessage => m.type === "chat");
      const recent = chatMsgs.slice(-historyCount);

      if (recent.length === 0) return;

      const messages = recent.map((m) => ({
        role: (m.mine ? "assistant" : "user") as "user" | "assistant",
        content: m.text,
      }));

      const context = {
        username: opts.myId,
        role: opts.role,
        team: opts.teamName,
      };

      const res = await managerFetch("/api/ai/auto-reply/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages, context }),
      });

      if (!res.ok) {
        console.warn("[autoReply] AI generate failed:", res.status);
        return;
      }

      const data = await res.json() as { text: string };
      if (!data.text?.trim()) return;

      opts.sendChat(peerId, data.text.trim(), { source: "ai-auto" });
    } catch (e: unknown) {
      console.warn("[autoReply] generate error:", e instanceof Error ? e.message : String(e));
    }
  }

  function dispose() {
    for (const timer of timers.values()) {
      clearTimeout(timer);
    }
    timers.clear();
  }

  return {
    trigger,
    dispose,
  };
}
