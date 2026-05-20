import { ref } from "vue";
import type { ChatMessage, SSEEventData, AIHealthResponse } from "../types";
import { apiUrl, managerFetch } from "../api";
import { getErrorMessage } from "../utils/error";

// ─── SSE 解析器 ───

interface StreamCallbacks {
  onTextDelta?: (text: string) => void;
  onDone?: (data: { finishReason: string; usage: { promptTokens: number; completionTokens: number } }) => void;
  onError?: (message: string) => void;
}

async function consumeSSE(url: string, body: object, callbacks: StreamCallbacks) {
  const response = await managerFetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.body) throw new Error("Empty response body");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split("\n\n");
    buffer = events.pop()!;

    for (const raw of events) {
      const parsed = parseSSE(raw);
      if (!parsed) continue;

      switch (parsed.event) {
        case "text-delta":
          callbacks.onTextDelta?.((parsed.data as { text: string }).text);
          break;
        case "done":
          callbacks.onDone?.(parsed.data as { finishReason: string; usage: { promptTokens: number; completionTokens: number } });
          break;
        case "error":
          callbacks.onError?.((parsed.data as { message: string }).message);
          break;
      }
    }
  }
}

function parseSSE(raw: string): { event: string; data: SSEEventData } | null {
  let event = "message";
  let dataStr = "";

  for (const line of raw.split("\n")) {
    if (line.startsWith("event: ")) event = line.slice(7).trim();
    else if (line.startsWith("data: ")) dataStr = line.slice(6);
  }

  if (!dataStr) return null;
  try { return { event, data: JSON.parse(dataStr) }; }
  catch { return null; }
}

// ─── Composable ───

export function useAIChat() {
  const suggestion = ref("");
  const isStreaming = ref(false);
  const chatAiError = ref("");
  const aiAvailable = ref(false);

  // backward-compatible alias
  const aiError = chatAiError;

  // Check AI availability
  fetch(apiUrl("/api/ai/health"))
    .then((r) => r.json())
    .then((h: AIHealthResponse) => { aiAvailable.value = h.configured; })
    .catch((e) => {
      console.warn("[useAI] health check failed:", e);
      aiAvailable.value = false;
    });

  function formatHistory(items: ChatMessage[]): { role: "user" | "assistant"; content: string }[] {
    return items
      .filter((m): m is ChatMessage => m.type === "chat")
      .map((m) => ({
        role: m.mine ? ("assistant" as const) : ("user" as const),
        content: m.text,
      }));
  }

  async function suggestReply(items: ChatMessage[], context?: string) {
    const messages = formatHistory(items);
    if (!messages.length) return;

    suggestion.value = "";
    isStreaming.value = true;
    chatAiError.value = "";

    try {
      const body: { messages: { role: "user" | "assistant"; content: string }[]; context?: string } = { messages };
      if (context) body.context = context;
      await consumeSSE("/api/ai/chat/stream", body, {
        onTextDelta: (text) => { suggestion.value += text; },
        onDone: () => { isStreaming.value = false; },
        onError: (msg) => { chatAiError.value = msg; isStreaming.value = false; },
      });
    } catch (e: unknown) {
      chatAiError.value = getErrorMessage(e);
      isStreaming.value = false;
    }
  }

  function acceptSuggestion(): string {
    const text = suggestion.value.trim();
    suggestion.value = "";
    return text;
  }

  function clearSuggestion() {
    suggestion.value = "";
    isStreaming.value = false;
    chatAiError.value = "";
  }

  return {
    suggestion,
    isStreaming,
    aiError,
    chatAiError,
    aiAvailable,
    suggestReply,
    acceptSuggestion,
    clearSuggestion,
  };
}
