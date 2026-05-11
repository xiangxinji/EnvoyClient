export type ProviderType = "openai" | "anthropic" | "google" | "deepseek";

export interface AIConfig {
  provider: ProviderType;
  apiKey: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
}

export interface AIConfigPublic {
  provider: ProviderType;
  model: string;
  temperature?: number;
  maxTokens?: number;
  configured: boolean;
}

// ─── Chat ───

export interface ChatMessageInput {
  role: "user" | "assistant";
  content: string;
}

export interface ChatRequest {
  messages: ChatMessageInput[];
  context?: string;
}

// ─── Task ───

export interface MemberDescriptor {
  id: string;
  role: "leader" | "member";
}

export interface TaskGenerateRequest {
  description: string;
  members: MemberDescriptor[];
  context?: string;
}

export interface TaskPlan {
  summary: string;
  assignments: TaskAssignment[];
}

export interface TaskAssignment {
  memberId: string;
  description: string;
  commands: string[];
}

// ─── Analyze ───

export interface TaskExecutionResult {
  memberId: string;
  commands: string[];
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface AnalyzeRequest {
  taskDescription: string;
  results: TaskExecutionResult[];
}

export interface AnalysisResult {
  summary: string;
  issues: string[];
  suggestions: string[];
}
