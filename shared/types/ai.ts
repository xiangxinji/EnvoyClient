export type ProviderType = "openai" | "anthropic" | "google" | "deepseek" | "openai-compatible";

// ─── Model Preset ───

export interface ModelPreset {
  id: string;
  name: string;
  provider: ProviderType;
  model: string;
  baseURL?: string;
  apiKey: string;
  isDefault: boolean;
}

// ─── Scene Configuration ───

export type SceneType = "chat" | "task" | "analyze" | "agent" | "dispatch" | "review" | "auto-reply" | "cloud_organize";

export interface SceneConfig {
  presetId: string | null;
  temperature: number;
  maxTokens: number;
}

// ─── AI Settings (new structure) ───

export interface AIConfig {
  presets: ModelPreset[];
  scenes: Partial<Record<SceneType, SceneConfig>>;
}

export interface AIConfigPublic {
  presets: Omit<ModelPreset, "apiKey">[];
  scenes: Partial<Record<SceneType, SceneConfig>>;
  configured: boolean;
  defaultPreset?: Omit<ModelPreset, "apiKey">;
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
