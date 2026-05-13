export interface MemberInfo {
  id: string;
  role: "leader" | "member";
  status: "online" | "offline";
  responsibilities?: string;
}

export interface ChatMessage {
  type: "chat";
  id: string;
  from: string;
  to: string;
  text: string;
  timestamp: number;
  mine: boolean;
}

export interface ToolCallRecord {
  name: string;
  args: unknown;
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
}

export type ClientResultData = { result: string };
export type FileResourceData = { filename: string; size: number; uploadedAt: number };
export type ExecutionTraceData = { steps: AgentStep[] };
export type TaskResourceData = ClientResultData | FileResourceData | ExecutionTraceData;

export interface TaskMessage {
  type: "task";
  id: string;
  taskId: string;
  from: string;
  content: string;
  status: "pending" | "running" | "completed" | "failed";
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
