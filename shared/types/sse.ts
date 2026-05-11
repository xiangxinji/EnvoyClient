// ─── SSE event types (standard format: event + data + \n\n) ───

export interface TextDeltaEvent {
  event: "text-delta";
  data: { text: string };
}

export interface ToolCallEvent {
  event: "tool-call";
  data: {
    callId: string;
    tool: string;
    args: Record<string, unknown>;
  };
}

export interface ToolResultEvent {
  event: "tool-result";
  data: {
    callId: string;
    result: unknown;
  };
}

export interface DoneEvent {
  event: "done";
  data: {
    finishReason: string;
    usage: {
      promptTokens: number;
      completionTokens: number;
    };
  };
}

export interface ErrorEvent {
  event: "error";
  data: {
    message: string;
  };
}

export type SSEEvent =
  | TextDeltaEvent
  | ToolCallEvent
  | ToolResultEvent
  | DoneEvent
  | ErrorEvent;

export type SSEEventType = SSEEvent["event"];

// ─── Client callback options ───

export interface StreamCallbacks {
  onTextDelta?: (text: string) => void;
  onToolCall?: (data: ToolCallEvent["data"]) => void;
  onToolResult?: (data: ToolResultEvent["data"]) => void;
  onDone?: (data: DoneEvent["data"]) => void;
  onError?: (message: string) => void;
}

export interface StreamOptions extends StreamCallbacks {
  token?: string;
}
