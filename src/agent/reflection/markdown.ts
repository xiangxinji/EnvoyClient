import type { TaskLogDraft } from "../agents/logEvaluator";
import { sanitizeLogField } from "./sanitize";
import { limitSection, MAX_ENTRY_CHARS } from "./textUtils";
import { generateTaskTitle, summarizeExecutionProcess, summarizeTaskResult, summarizeExecutionReview } from "./summarize";

export interface TaskReflectionInput {
  username: string;
  taskId: string;
  taskContent: string;
  success: boolean;
  plan?: string;
  execSummary?: string;
  reviewSummary?: string;
  attempts: number;
  trace: import("../../types").AgentStep[];
  completedAt?: Date;
}

export function createExecutionLogEntry(input: TaskReflectionInput, draft?: TaskLogDraft | null): string {
  const title = draft?.title || generateTaskTitle(input);
  const description = draft?.description || limitSection(input.taskContent, MAX_ENTRY_CHARS);
  const process = draft?.process?.length ? draft.process.map((line) => `- ${sanitizeLogField(line)}`).join("\n") : summarizeExecutionProcess(input);
  const result = draft?.result ? `- ${sanitizeLogField(draft.result)}` : summarizeTaskResult(input);
  const review = draft?.review?.length ? draft.review.map((line) => `- ${sanitizeLogField(line)}`).join("\n") : summarizeExecutionReview(input);

  return [
    `## 任务标题：${sanitizeLogField(title)}`,
    "",
    "### 任务描述",
    sanitizeLogField(description),
    "",
    "### 执行过程",
    process,
    "",
    "### 任务结果",
    result,
    "",
    "### 执行复盘",
    review,
    "",
  ].join("\n");
}

export function mergeDailyExecutionLog(existing: string | null, entry: string): string {
  const trimmedEntry = entry.trim();
  if (!existing?.trim()) return `# 执行日志\n\n${trimmedEntry}\n`;

  const normalized = existing.trimEnd();
  const withHeader = normalized.startsWith("# 执行日志")
    ? normalized
    : `# 执行日志\n\n${normalized}`;
  return `${withHeader}\n\n---\n\n${trimmedEntry}\n`;
}
