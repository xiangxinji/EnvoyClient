import type { AgentTool } from "./tools";
import { apiUrl, getClientToken } from "../api";
import type { AgentResult, AgentStep, AgentToolCall, AgentReasonResponse } from "../types";

// ─── Types ───

export type AgentMessage =
  | { role: "user"; content: string }
  | {
      role: "assistant";
      content: string;
      toolCalls: Array<{ id: string; name: string; args: Record<string, unknown> }>;
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

function truncateToolResult(_toolName: string, result: unknown): unknown {
  if (typeof result !== "object" || result === null) return result;

  const truncated = { ...(result as Record<string, unknown>) };
  const stdout = truncated.stdout;
  if (typeof stdout === "string" && stdout.length > 2000) {
    truncated.stdout =
      stdout.slice(0, 2000) +
      `... (truncated, total ${stdout.length} chars)`;
  }
  const stderr = truncated.stderr;
  if (typeof stderr === "string" && stderr.length > 1000) {
    truncated.stderr =
      stderr.slice(0, 1000) +
      `... (truncated, total ${stderr.length} chars)`;
  }
  return truncated;
}

// ─── ReAct loop ───

export async function reactLoop(
  taskContent: string,
  tools: AgentTool[],
  currentStep: { value: number },
  error: { value: string },
  workspacePath?: string,
  skillCatalog?: string,
): Promise<AgentResult> {
  const schemas = tools.map(({ execute, ...schema }) => schema);

  const messages: AgentMessage[] = [];

  if (workspacePath) {
    messages.push({
      role: "user",
      content: `你的工作目录是 ${workspacePath}。所有文件增删改操作必须基于这个目录进行。`,
    });
  }

  if (skillCatalog) {
    messages.push({
      role: "user",
      content: skillCatalog,
    });
  }

  messages.push({ role: "user", content: taskContent });

  const trace: AgentStep[] = [];

  for (let step = 0; step < MAX_STEPS; step++) {
    currentStep.value = step + 1;

    const token = getClientToken();
    const response = await fetchWithTimeout(
      apiUrl("/api/ai/agent/reason"),
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { "X-Envoy-Token": token } : {}),
        },
        body: JSON.stringify({ messages, tools: schemas }),
      },
      120_000,
    );

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      error.value = `AI reasoning failed: ${response.status} ${text}`;
      return { result: JSON.stringify({ error: error.value }), trace };
    }

    const data = await response.json() as AgentReasonResponse;

    if (!data.toolCalls?.length) {
      const result = data.text || JSON.stringify({ result: "Task completed" });
      trace.push({
        index: step + 1,
        reasoning: data.text || "",
        toolCalls: [],
        toolResults: [],
      });
      return { result, trace };
    }

    const agentStep: AgentStep = {
      index: step + 1,
      reasoning: data.text || "",
      toolCalls: data.toolCalls.map((c: AgentToolCall) => ({ name: c.name, args: c.args })),
      toolResults: [],
    };

    messages.push({
      role: "assistant",
      content: data.text || "",
      toolCalls: data.toolCalls,
    });

    for (const call of data.toolCalls) {
      const tool = tools.find((t) => t.name === call.name);
      if (!tool) {
        const errResult = { error: `Unknown tool: ${call.name}` };
        messages.push({
          role: "tool",
          content: JSON.stringify(errResult),
          toolCallId: call.id,
          toolName: call.name,
        });
        agentStep.toolResults.push({ name: call.name, result: errResult });
        continue;
      }

      try {
        let result = await executeWithTimeout(
          () => tool.execute(call.args),
          60_000,
        );

        if (call.name === "done" && typeof result === "object" && result !== null && "done" in result) {
          const doneResult = result as { done: boolean; result: string };
          agentStep.toolResults.push({ name: call.name, result });
          trace.push(agentStep);
          return { result: doneResult.result, trace };
        }

        result = truncateToolResult(call.name, result);

        messages.push({
          role: "tool",
          content: JSON.stringify(result),
          toolCallId: call.id,
          toolName: call.name,
        });
        agentStep.toolResults.push({ name: call.name, result });
      } catch (e: unknown) {
        const errMsg = e instanceof Error ? e.message : String(e);
        const errResult = { error: errMsg };
        messages.push({
          role: "tool",
          content: JSON.stringify(errResult),
          toolCallId: call.id,
          toolName: call.name,
        });
        agentStep.toolResults.push({ name: call.name, result: errResult });
      }
    }

    trace.push(agentStep);
  }

  error.value = `Max steps (${MAX_STEPS}) reached`;
  return { result: JSON.stringify({ error: error.value, maxStepsReached: true }), trace };
}
