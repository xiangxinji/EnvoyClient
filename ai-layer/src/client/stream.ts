import type { StreamCallbacks } from "../shared/sse-types";

export interface FetchOptions {
  token?: string;
}

export async function consumeStream(
  url: string,
  body: object,
  callbacks: StreamCallbacks,
  options: FetchOptions = {},
): Promise<void> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (options.token) {
    headers["Authorization"] = `Bearer ${options.token}`;
  }

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(
      `AI request failed: ${response.status} ${text}`,
    );
  }

  if (!response.body) {
    throw new Error("Response body is empty");
  }

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
        case "tool-call":
          callbacks.onToolCall?.(parsed.data);
          break;
        case "tool-result":
          callbacks.onToolResult?.(parsed.data);
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

function parseSSE(
  raw: string,
): { event: string; data: any } | null {
  let event = "message";
  let dataStr = "";

  for (const line of raw.split("\n")) {
    if (line.startsWith("event: ")) {
      event = line.slice(7).trim();
    } else if (line.startsWith("data: ")) {
      dataStr = line.slice(6);
    }
  }

  if (!dataStr) return null;

  try {
    return { event, data: JSON.parse(dataStr) };
  } catch {
    return null;
  }
}
