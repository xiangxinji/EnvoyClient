import { generateText, tool, jsonSchema } from "ai";
import type { Context } from "hono";
import type { AIConfig } from "../../../../shared/types/ai.js";
import { AGENT_SYSTEM_PROMPT } from "./prompts/agent.js";
import { resolveModel, getModelOptions } from "./provider.js";

interface AgentReasonRequest {
  messages: Array<{
    role: string;
    content: string;
    toolCalls?: any[];
    toolCallId?: string;
    toolName?: string;
  }>;
  tools: Array<{
    name: string;
    description: string;
    parameters: Record<string, any>;
  }>;
}

export async function handleAgentReason(c: Context, config: AIConfig) {
  const body = await c.req.json<AgentReasonRequest>();

  if (!body.messages?.length) {
    return c.json({ error: "messages and tools are required" }, 400);
  }
  if (!body.tools?.length) {
    return c.json({ error: "messages and tools are required" }, 400);
  }

  const model = resolveModel(config);
  const options = getModelOptions(config);

  // Convert JSON schema tool definitions to ai-sdk tool definitions
  const tools: Record<string, any> = {};
  for (const t of body.tools) {
    tools[t.name] = tool({
      description: t.description,
      parameters: jsonSchema(t.parameters),
    });
  }

  // Build messages with system prompt — convert to ai-sdk CoreMessage format
  // ai-sdk requires:
  //   assistant: { role: "assistant", content: [{ type: "text"|"tool-call", ... }] }
  //   tool:      { role: "tool", content: [{ type: "tool-result", toolCallId, result }] }
  const messages: Array<any> = [
    { role: "system", content: AGENT_SYSTEM_PROMPT },
  ];

  // Accumulate consecutive tool-result messages into batches
  let pendingToolResults: Array<{ type: "tool-result"; toolCallId: string; result: string }> = [];

  function flushToolResults() {
    if (pendingToolResults.length > 0) {
      messages.push({ role: "tool", content: pendingToolResults });
      pendingToolResults = [];
    }
  }

  for (const m of body.messages) {
    if (m.toolCalls) {
      // End any pending tool results before a new assistant message
      flushToolResults();
      const content: Array<any> = [];
      if (m.content) {
        content.push({ type: "text", text: m.content });
      }
      for (const tc of m.toolCalls) {
        content.push({
          type: "tool-call",
          toolCallId: tc.id,
          toolName: tc.name,
          args: tc.args,
        });
      }
      messages.push({ role: "assistant", content });
    } else if (m.toolCallId) {
      // Accumulate tool results — they'll be flushed before the next non-tool message
      pendingToolResults.push({
        type: "tool-result",
        toolCallId: m.toolCallId,
        toolName: m.toolName ?? "unknown",
        result: m.content,
      });
    } else {
      // Regular user/assistant message — flush pending tool results first
      flushToolResults();
      messages.push({ role: m.role, content: m.content });
    }
  }
  // Flush any trailing tool results
  flushToolResults();

  const result = await generateText({
    model,
    messages,
    tools,
    temperature: options.temperature,
    maxTokens: options.maxTokens,
  });

  // Extract tool calls if any
  const toolCalls = result.toolCalls?.map((tc) => ({
    id: tc.toolCallId,
    name: tc.toolName,
    args: tc.args,
  }));

  return c.json({
    toolCalls: toolCalls?.length ? toolCalls : undefined,
    text: result.text || undefined,
    done: !toolCalls?.length,
    usage: result.usage,
  });
}
