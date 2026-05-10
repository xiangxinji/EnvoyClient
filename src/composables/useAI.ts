import { ref } from "vue";
import type { ChatMessage, MemberInfo, TaskMessage } from "../types";

let _managerUrl: string | null = null;

export function setAIManagerUrl(url: string) {
  _managerUrl = url;
}

function apiUrl(path: string): string {
  const base = _managerUrl ?? "http://localhost:8080";
  return `${base}${path}`;
}

// ─── SSE 解析器 ───

interface StreamCallbacks {
  onTextDelta?: (text: string) => void;
  onDone?: (data: { finishReason: string; usage: { promptTokens: number; completionTokens: number } }) => void;
  onError?: (message: string) => void;
}

async function consumeSSE(url: string, body: object, callbacks: StreamCallbacks) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`AI request failed: ${response.status} ${text}`);
  }

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
          callbacks.onTextDelta?.(parsed.data.text);
          break;
        case "done":
          callbacks.onDone?.(parsed.data);
          break;
        case "error":
          callbacks.onError?.(parsed.data.message);
          break;
      }
    }
  }
}

function parseSSE(raw: string): { event: string; data: any } | null {
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

export function useAI() {
  const suggestion = ref("");
  const isStreaming = ref(false);
  const aiError = ref("");
  const aiAvailable = ref(false);

  // Check AI availability
  fetch(apiUrl("/api/ai/health"))
    .then((r) => r.json())
    .then((h: any) => { aiAvailable.value = h.configured; })
    .catch(() => { aiAvailable.value = false; });

  function formatHistory(items: ChatMessage[]): { role: "user" | "assistant"; content: string }[] {
    return items
      .filter((m): m is ChatMessage => m.type === "chat")
      .map((m) => ({
        role: m.mine ? ("assistant" as const) : ("user" as const),
        content: m.text,
      }));
  }

  async function suggestReply(items: ChatMessage[]) {
    const messages = formatHistory(items);
    if (!messages.length) return;

    suggestion.value = "";
    isStreaming.value = true;
    aiError.value = "";

    try {
      await consumeSSE(apiUrl("/api/ai/chat/stream"), { messages }, {
        onTextDelta: (text) => { suggestion.value += text; },
        onDone: () => { isStreaming.value = false; },
        onError: (msg) => { aiError.value = msg; isStreaming.value = false; },
      });
    } catch (e: any) {
      aiError.value = e.message;
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
    aiError.value = "";
  }

  async function planTask(description: string, members: MemberInfo[]) {
    aiError.value = "";

    try {
      const res = await fetch(apiUrl("/api/ai/task/generate"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description,
          members: members.map((m) => ({ id: m.id, role: m.role })),
        }),
      });
      if (!res.ok) throw new Error(`Task generate failed: ${res.status}`);
      return await res.json();
    } catch (e: any) {
      aiError.value = e.message;
      return null;
    }
  }

  async function analyzeTaskResult(taskDescription: string, results: TaskMessage["resources"]) {
    aiError.value = "";

    try {
      const res = await fetch(apiUrl("/api/ai/task/analyze"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskDescription,
          results: results.map((r) => ({
            memberId: r.by,
            commands: [taskDescription],
            stdout: typeof r.data === "object" && r.data !== null && "stdout" in (r.data as any)
              ? (r.data as any).stdout ?? ""
              : JSON.stringify(r.data),
            stderr: typeof r.data === "object" && r.data !== null && "stderr" in (r.data as any)
              ? (r.data as any).stderr ?? ""
              : "",
            exitCode: typeof r.data === "object" && r.data !== null && "exit_code" in (r.data as any)
              ? (r.data as any).exit_code ?? -1
              : 0,
          })),
        }),
      });
      if (!res.ok) throw new Error(`Analyze failed: ${res.status}`);
      return await res.json();
    } catch (e: any) {
      aiError.value = e.message;
      return null;
    }
  }

  return {
    suggestion,
    isStreaming,
    aiError,
    aiAvailable,
    suggestReply,
    acceptSuggestion,
    clearSuggestion,
    planTask,
    analyzeTaskResult,
  };
}
