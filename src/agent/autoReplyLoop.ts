import type { AgentTool } from "./tools";
import { apiUrl, getClientToken } from "../api";
import type { AgentReasonResponse } from "../types";
import { getErrorMessage } from "../utils/error";

// ─── Types ───

export type AutoReplyMessage =
  | { role: "user"; content: string }
  | {
      role: "assistant";
      content: string;
      toolCalls?: Array<{ id: string; name: string; args: Record<string, unknown> }>;
    }
  | { role: "tool"; content: string; toolCallId: string; toolName: string };

// ─── Helpers ───

const DEFAULT_MAX_STEPS = 5;
const REASON_TIMEOUT = 30_000;
const TOOL_TIMEOUT = 15_000;

function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  let timer: ReturnType<typeof setTimeout>;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("AI reasoning timeout")), timeoutMs);
  });
  return Promise.race([fetch(url, options), timeoutPromise]).finally(() => clearTimeout(timer!));
}

function executeWithTimeout<T>(
  fn: () => Promise<T>,
  timeoutMs: number,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("Tool execution timeout")), timeoutMs);
  });
  return Promise.race([fn(), timeoutPromise]).finally(() => clearTimeout(timer!));
}

// ─── Auto-reply ReAct loop ───

/**
 * A simplified ReAct loop for auto-reply scenarios.
 *
 * Unlike the full `reactLoop`, this:
 * - Has no `done` tool handling (terminates when AI returns no tool calls)
 * - Has no stdout/stderr truncation
 * - Has no workspace/skill catalog injection
 * - Has no step/error refs or event handlers
 * - Uses shorter timeouts (30s reasoning, 15s tool execution)
 */
export async function autoReplyLoop(
  messages: AutoReplyMessage[],
  tools: AgentTool[],
  maxSteps?: number,
): Promise<{ text: string }> {
  const schemas = tools.map(({ execute: _, ...schema }) => schema);
  const steps = maxSteps ?? DEFAULT_MAX_STEPS;

  const localMessages = [...messages];

  try {
    for (let step = 0; step < steps; step++) {
      const token = getClientToken();
      const response = await fetchWithTimeout(
        apiUrl("/api/ai/auto-reply/reason"),
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { "X-Envoy-Token": token } : {}),
          },
          body: JSON.stringify({ messages: localMessages, tools: schemas }),
        },
        REASON_TIMEOUT,
      );

      if (!response.ok) {
        console.warn("[autoReplyLoop] AI reason failed:", response.status);
        return { text: "" };
      }

      const data = await response.json() as AgentReasonResponse;

      // No tool calls → AI is done, return the final text
      if (!data.toolCalls?.length) {
        return { text: data.text || "" };
      }

      // Record assistant message with tool calls
      localMessages.push({
        role: "assistant",
        content: data.text || "",
        toolCalls: data.toolCalls,
      });

      // Execute each tool call locally
      for (const call of data.toolCalls) {
        const tool = tools.find((t) => t.name === call.name);

        if (!tool) {
          localMessages.push({
            role: "tool",
            content: JSON.stringify({ error: `Unknown tool: ${call.name}` }),
            toolCallId: call.id,
            toolName: call.name,
          });
          continue;
        }

        try {
          const result = await executeWithTimeout(
            () => tool.execute(call.args),
            TOOL_TIMEOUT,
          );
          localMessages.push({
            role: "tool",
            content: JSON.stringify(result),
            toolCallId: call.id,
            toolName: call.name,
          });
        } catch (e: unknown) {
          localMessages.push({
            role: "tool",
            content: JSON.stringify({ error: getErrorMessage(e) }),
            toolCallId: call.id,
            toolName: call.name,
          });
        }
      }
    }
  } catch (e: unknown) {
    console.warn("[autoReplyLoop] error:", getErrorMessage(e));
  }

  // Max steps reached or error → silent failure
  return { text: "" };
}
