// ai-layer: AI integration layer for EnvoyClient
//
// Usage:
//   Server (Manager): import { createAIRoutes } from "ai-layer/server"
//   Client (Tauri):   import { streamChat, generateTask } from "ai-layer/client"

export { createAIRoutes, type AIRouterOptions } from "./server";
export {
  streamChat,
  generateChat,
  generateTask,
  analyzeResult,
  getAIConfig,
  updateAIConfig,
  getModels,
  checkAIHealth,
  consumeStream,
} from "./client";
export type {
  AIConfig,
  AIConfigPublic,
  ProviderType,
  ChatMessageInput,
  ChatRequest,
  MemberDescriptor,
  TaskGenerateRequest,
  TaskPlan,
  TaskAssignment,
  TaskExecutionResult,
  AnalyzeRequest,
  AnalysisResult,
} from "./shared";
export type {
  SSEEvent,
  SSEEventType,
  StreamCallbacks,
  StreamOptions,
} from "./shared";
