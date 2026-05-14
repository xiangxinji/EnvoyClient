import { ref } from "vue";
import type { ChatMessage, MemberInfo, TaskMessage, SSEEventData, AIHealthResponse, TaskResource } from "../types";
import { apiUrl, managerFetch } from "../api";

// ─── Helpers ───

function getErrorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

function extractResultOutput(data: unknown): { stdout: string; stderr: string; exit_code: number } {
  if (typeof data === "object" && data !== null) {
    const obj = data as Record<string, unknown>;
    return {
      stdout: typeof obj.stdout === "string" ? obj.stdout : "",
      stderr: typeof obj.stderr === "string" ? obj.stderr : "",
      exit_code: typeof obj.exit_code === "number" ? obj.exit_code : -1,
    };
  }
  return { stdout: JSON.stringify(data), stderr: "", exit_code: 0 };
}

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

export function useAI() {
  const suggestion = ref("");
  const isStreaming = ref(false);
  const aiError = ref("");
  const aiAvailable = ref(false);

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

  async function suggestReply(items: ChatMessage[]) {
    const messages = formatHistory(items);
    if (!messages.length) return;

    suggestion.value = "";
    isStreaming.value = true;
    aiError.value = "";

    try {
      await consumeSSE("/api/ai/chat/stream", { messages }, {
        onTextDelta: (text) => { suggestion.value += text; },
        onDone: () => { isStreaming.value = false; },
        onError: (msg) => { aiError.value = msg; isStreaming.value = false; },
      });
    } catch (e: unknown) {
      aiError.value = getErrorMessage(e);
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
      const res = await managerFetch("/api/ai/task/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description,
          members: members.map((m) => ({ id: m.id, role: m.role })),
        }),
      });
      return await res.json();
    } catch (e: unknown) {
      aiError.value = getErrorMessage(e);
      return null;
    }
  }

  async function analyzeTaskResult(taskDescription: string, results: TaskMessage["resources"]) {
    aiError.value = "";

    try {
      const res = await managerFetch("/api/ai/task/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskDescription,
          results: results.map((r) => ({
            memberId: r.by,
            commands: [taskDescription],
            ...extractResultOutput(r.data),
          })),
        }),
      });
      return await res.json();
    } catch (e: unknown) {
      aiError.value = getErrorMessage(e);
      return null;
    }
  }

  async function dispatchTask(description: string, members: Array<{ id: string; responsibilities?: string }>) {
    aiError.value = "";

    try {
      const res = await managerFetch("/api/ai/task/dispatch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description, members }),
      });
      return await res.json() as { subscribe: string[]; content: string };
    } catch (e: unknown) {
      aiError.value = getErrorMessage(e);
      return null;
    }
  }

  async function reviewTaskResult(
    taskContent: string,
    memberResults: TaskResource[],
  ): Promise<{ success: boolean; summary: string }> {
    aiError.value = "";

    try {
      const resultsSummary = memberResults.map((r) => ({
        from: r.by ?? "unknown",
        data: r.data ?? r,
      }));

      const res = await managerFetch("/api/ai/task/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskDescription: taskContent,
          results: resultsSummary,
        }),
      });
      return await res.json() as { success: boolean; summary: string };
    } catch (e: unknown) {
      aiError.value = getErrorMessage(e);
      return { success: false, summary: `Review failed: ${getErrorMessage(e)}` };
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
    dispatchTask,
    reviewTaskResult,
  };
}
