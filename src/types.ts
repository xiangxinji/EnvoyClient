export interface MemberInfo {
  id: string;
  role: "leader" | "member";
  status: "online" | "offline";
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

export interface ChatMessage {
  type: "chat";
  id: string;
  seq: number;
  from: string;
  to: string;
  text: string;
  timestamp: number;
  mine: boolean;
  attachments?: MessageAttachment[];
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
}

export type ClientResultData = { result: string };
export type FileResourceData = { filename: string; size: number; uploadedAt: number };
export type ExecutionTraceData = { steps: AgentStep[] };
export type TaskResourceData = ClientResultData | FileResourceData | ExecutionTraceData;

export interface TaskMessage {
  type: "task";
  id: string;
  seq: number;
  taskId: string;
  from: string;
  content: string;
  status: "pending" | "running" | "reviewing" | "completed" | "failed";
  resources: TaskResource[];
  subscribe?: string[];
  timestamp: number;
}

export type TimelineItem = ChatMessage | TaskMessage;

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

/** Skill catalog entry */
export interface SkillCatalogEntry { name: string; description: string; filename: string }
export interface SkillCatalogResponse { skills: SkillCatalogEntry[] }
