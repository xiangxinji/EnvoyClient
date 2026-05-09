export interface MemberInfo {
  id: string;
  role: "leader" | "member";
  status: "online";
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

export interface TaskMessage {
  type: "task";
  id: string;
  taskId: string;
  from: string;
  content: string;
  status: "pending" | "running" | "completed" | "failed";
  result?: unknown;
  timestamp: number;
}

export type TimelineItem = ChatMessage | TaskMessage;
