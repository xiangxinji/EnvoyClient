import { streamText } from "ai";
import type { Context } from "hono";
import type { ChatRequest } from "../shared/types";
import { buildChatMessages } from "../shared/prompts/chat";
import { toStandardSSE } from "./stream";
import type { AIConfig } from "../shared/types";
import { resolveModel, getModelOptions } from "./provider";

export async function handleChatStream(c: Context, config: AIConfig) {
  const body = await c.req.json<ChatRequest>();

  if (!body.messages?.length) {
    return c.json({ error: "messages is required" }, 400);
  }

  const messages = buildChatMessages(body.messages, body.context);
  const model = resolveModel(config);
  const options = getModelOptions(config);

  const result = streamText({
    model,
    messages,
    temperature: options.temperature,
    maxTokens: options.maxTokens,
  });

  const sse = toStandardSSE(result);

  return new Response(sse, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

export async function handleChatGenerate(c: Context, config: AIConfig) {
  const { generateText } = await import("ai");
  const body = await c.req.json<ChatRequest>();

  if (!body.messages?.length) {
    return c.json({ error: "messages is required" }, 400);
  }

  const messages = buildChatMessages(body.messages, body.context);
  const model = resolveModel(config);
  const options = getModelOptions(config);

  const result = await generateText({
    model,
    messages,
    temperature: options.temperature,
    maxTokens: options.maxTokens,
  });

  return c.json({
    text: result.text,
    usage: result.usage,
    finishReason: result.finishReason,
  });
}
