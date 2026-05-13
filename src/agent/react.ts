import type { AgentTool } from "./tools";
import { apiUrl } from "../api";

// ─── Types ───

export type AgentMessage =
  | { role: "user"; content: string }
  | {
      role: "assistant";
      content: string;
      toolCalls: Array<{ id: string; name: string; args: any }>;
    }
  | { role: "tool"; content: string; toolCallId: string; toolName: string };

// ─── Helpers ───

const MAX_STEPS = 20;

function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  return Promise.race([
    fetch(url, options),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("AI reasoning timeout")), timeoutMs),
    ),
  ]);
}

function executeWithTimeout<T>(
  fn: () => Promise<T>,
  timeoutMs: number,
): Promise<T> {
  return Promise.race([
    fn(),
    new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error("Tool execution timeout")),
        timeoutMs,
      ),
    ),
  ]);
}

function truncateToolResult(_toolName: string, result: any): any {
  if (typeof result !== "object" || result === null) return result;

  const truncated = { ...result };
  if (typeof truncated.stdout === "string" && truncated.stdout.length > 2000) {
    truncated.stdout =
      truncated.stdout.slice(0, 2000) +
      `... (truncated, total ${result.stdout.length} chars)`;
  }
  if (typeof truncated.stderr === "string" && truncated.stderr.length > 1000) {
    truncated.stderr =
      truncated.stderr.slice(0, 1000) +
      `... (truncated, total ${result.stderr.length} chars)`;
  }
  return truncated;
}

// ─── ReAct loop ───

export async function reactLoop(
  taskContent: string,
  tools: AgentTool[],
  currentStep: { value: number },
  error: { value: string },
): Promise<string> {
  const schemas = tools.map(({ execute, ...schema }) => schema);

  const messages: AgentMessage[] = [
    { role: "user", content: taskContent },
  ];

  for (let step = 0; step < MAX_STEPS; step++) {
    currentStep.value = step + 1;

    const response = await fetchWithTimeout(
      apiUrl("/api/ai/agent/reason"),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages, tools: schemas }),
      },
      30_000,
    );

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      error.value = `AI reasoning failed: ${response.status} ${text}`;
      return JSON.stringify({ error: error.value });
    }

    const data = await response.json();

    if (!data.toolCalls?.length) {
      return data.text || JSON.stringify({ result: "Task completed" });
    }

    messages.push({
      role: "assistant",
      content: data.text || "",
      toolCalls: data.toolCalls,
    });

    for (const call of data.toolCalls) {
      const tool = tools.find((t) => t.name === call.name);
      if (!tool) {
        messages.push({
          role: "tool",
          content: JSON.stringify({ error: `Unknown tool: ${call.name}` }),
          toolCallId: call.id,
          toolName: call.name,
        });
        continue;
      }

      try {
        let result = await executeWithTimeout(
          () => tool.execute(call.args),
          60_000,
        );

        if (call.name === "done" && result?.done) {
          return result.result;
        }

        result = truncateToolResult(call.name, result);

        messages.push({
          role: "tool",
          content: JSON.stringify(result),
          toolCallId: call.id,
          toolName: call.name,
        });
      } catch (e: any) {
        messages.push({
          role: "tool",
          content: JSON.stringify({ error: e.message || String(e) }),
          toolCallId: call.id,
          toolName: call.name,
        });
      }
    }
  }

  error.value = `Max steps (${MAX_STEPS}) reached`;
  return JSON.stringify({ error: error.value, maxStepsReached: true });
}
