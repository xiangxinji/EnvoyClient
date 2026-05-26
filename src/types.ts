export interface MemberInfo {
  id: string;
  role: "leader" | "member";
  status: "online" | "offline";
  nickname?: string | null;
  avatar_url?: string | null;
  responsibilities?: string;
  capabilities?: string;
}

export interface MessageAttachment {
  type: "image" | "file";
  url: string;
  name: string;
  size: number;
  mimeType: string;
}

export interface ForwardedRecord {
  from: string;
  text: string;
  timestamp: number;
  attachments?: MessageAttachment[];
  sticker?: StickerInfo;
  cloudRefs?: CloudRef[];
}

export interface StickerInfo {
  id?: string;
  url: string;
  name: string;
}

export interface CloudRef {
  name: string;
  path: string;
  type: "file" | "directory";
  size: number;
}

export interface QuoteInfo {
  id: string;
  from: string;
  text: string;
  timestamp: number;
}

export interface ContentSegmentText {
  type: "text";
  content: string;
}

export interface ContentSegmentImage {
  type: "image";
  blob: Blob;
  name: string;
}

export type ContentSegment = ContentSegmentText | ContentSegmentImage;

export interface ChatMessage {
  type: "chat";
  id: string;
  seq: number;
  from: string;
  to: string;
  text: string;
  timestamp: number;
  mine: boolean;
  source?: "human" | "ai-auto";
  attachments?: MessageAttachment[];
  forwarded?: ForwardedRecord[];
  quote?: QuoteInfo;
  sticker?: StickerInfo;
  channel?: string;
  mentions?: string[];
  cloudRefs?: CloudRef[];
}

export interface ToolCallRecord {
  name: string;
  args: Record<string, unknown>;
}

export interface ToolResultRecord {
  name: string;
  result: unknown;
}

export interface AgentStep {
  index: number;
  reasoning: string;
  agent?: string;
  attempt?: number;
  toolCalls: ToolCallRecord[];
  toolResults: ToolResultRecord[];
}

export interface AgentResult {
  result: string;
  trace: AgentStep[];
}

export interface TaskResource {
  type: string;
  by: string;
  data: unknown;
  attempt: number;
  timestamp?: number;
}

export type ClientResultData = { result: string };
export type FileResourceData = { filename: string; size: number; uploadedAt: number };
export type ExecutionTraceData = { steps: AgentStep[] };
export type LeaderReviewData = { success: boolean; data?: unknown; error?: string };
export type TaskResourceData = ClientResultData | FileResourceData | ExecutionTraceData | LeaderReviewData;

export interface TaskMessage {
  type: "task";
  id: string;
  seq: number;
  taskId: string;
  from: string;
  content: string;
  status: "pending" | "running" | "reviewing" | "completed" | "failed";
  mode?: "serial" | "parallel";
  resources: TaskResource[];
  subscribe?: string[];
  timestamp: number;
}

export interface RevokedNotice {
  type: "revoked";
  id: string;
  seq: number;
  from: string;
  timestamp: number;
}

export type TimelineItem = ChatMessage | TaskMessage | RevokedNotice;

export interface TaskPlan {
  summary: string;
  assignments: {
    memberId: string;
    description: string;
    commands: string[];
  }[];
}

/** SSE event data */
export interface SSETextDelta { text: string }
export interface SSEDone { finishReason: string; usage: { promptTokens: number; completionTokens: number } }
export interface SSEError { message: string }
export type SSEEventData = SSETextDelta | SSEDone | SSEError;

/** AI health check response */
export interface AIHealthResponse { configured: boolean; provider?: string; model?: string }

/** Agent tool call from AI response */
export interface AgentToolCall { id: string; name: string; args: Record<string, unknown> }

/** AI agent reasoning response */
export interface AgentReasonResponse {
  text: string;
  toolCalls: AgentToolCall[];
}

/** Execution monitor events */
export type ExecutionEvent =
  | { type: "pipeline:start"; taskId: string; taskContent: string }
  | { type: "stage:start"; stage: string; attempt: number }
  | { type: "step:reasoning"; stage: string; stepIndex: number; reasoning: string }
  | { type: "step:tool_call"; stage: string; stepIndex: number; toolName: string; args: Record<string, unknown> }
  | { type: "step:tool_result"; stage: string; stepIndex: number; toolName: string; result: unknown }
  | { type: "stage:end"; stage: string; result: string }
  | { type: "pipeline:end"; success: boolean; summary: string };

export interface ExecutionEntry {
  timestamp: number;
  event: ExecutionEvent;
}

/** Skill catalog entry */
export interface SkillCatalogEntry { name: string; description: string; filename: string }
export interface SkillCatalogResponse { skills: SkillCatalogEntry[] }
