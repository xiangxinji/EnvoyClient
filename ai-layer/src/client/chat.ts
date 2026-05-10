import type { ChatRequest, ChatMessageInput } from "../shared/types";
import type { StreamCallbacks } from "../shared/sse-types";
import { consumeStream, type FetchOptions } from "./stream";

export interface ChatClientOptions {
  baseUrl: string;
  fetchOptions?: FetchOptions;
}

export async function streamChat(
  baseUrl: string,
  messages: ChatMessageInput[],
  callbacks: StreamCallbacks,
  options?: { context?: string; token?: string },
): Promise<void> {
  const body: ChatRequest = { messages, context: options?.context };

  await consumeStream(`${baseUrl}/api/ai/chat/stream`, body, callbacks, {
    token: options?.token,
  });
}

export async function generateChat(
  baseUrl: string,
  messages: ChatMessageInput[],
  options?: { context?: string; token?: string },
): Promise<{ text: string; usage: { promptTokens: number; completionTokens: number } }> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (options?.token) {
    headers["Authorization"] = `Bearer ${options.token}`;
  }

  const body: ChatRequest = { messages, context: options?.context };

  const response = await fetch(`${baseUrl}/api/ai/chat/generate`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`AI request failed: ${response.status} ${text}`);
  }

  return response.json();
}
