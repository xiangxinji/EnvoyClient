import { invoke } from "@tauri-apps/api/core";
import type { AgentStep, TaskScoreData } from "../types";
import { evaluateTaskLog, type LogEvaluatorInput } from "./agents/logEvaluator";
import { isTauri } from "../utils/platform";
import { buildDailyExecutionLogPath, sanitizePathSegment, formatDailyDate, LOG_DIR, EXECUTION_LOG_DIR } from "./reflection/paths";
export { buildTaskReflectionPath, buildDailyExecutionLogPath } from "./reflection/paths";
export { sanitizeText } from "./reflection/sanitize";
export { generateTaskTitle } from "./reflection/summarize";
export { createExecutionLogEntry, mergeDailyExecutionLog } from "./reflection/markdown";
import { createExecutionLogEntry } from "./reflection/markdown";
import { mergeDailyExecutionLog } from "./reflection/markdown";
import { sanitizeText } from "./reflection/sanitize";
import { normalizeLogSource } from "./reflection/textUtils";
import { collectToolNames } from "./reflection/summarize";
import { sanitizeLogField } from "./reflection/sanitize";

export interface TaskReflectionInput {
  username: string;
  taskId: string;
  taskContent: string;
  success: boolean;
  plan?: string;
  execSummary?: string;
  reviewSummary?: string;
  attempts: number;
  trace: AgentStep[];
  completedAt?: Date;
}

export interface TaskReflectionWriteResult {
  path: string;
  content: string;
}

export function createTaskReflectionMarkdown(input: TaskReflectionInput, draft?: any): string {
  return createExecutionLogEntry(input, draft);
}

export async function writeTaskReflection(input: TaskReflectionInput): Promise<TaskReflectionWriteResult | null> {
  if (!shouldWriteTaskReflection(true)) return null;

  const draft = await evaluateTaskLog(buildLogEvaluatorInput(input));
  const entry = createExecutionLogEntry(input, draft);
  const path = buildDailyExecutionLogPath(input);
  const existing = await readExistingLog(path);
  const content = mergeDailyExecutionLog(existing, entry);

  await invoke("file_write", { path, content, workingDir: null });
  return { path, content };
}

export function shouldWriteTaskReflection(enabled: boolean, tauriAvailable = isTauri): boolean {
  return enabled && tauriAvailable;
}

function buildLogEvaluatorInput(input: TaskReflectionInput): LogEvaluatorInput {
  return {
    taskContent: sanitizeText(input.taskContent),
    success: input.success,
    plan: input.plan ? normalizeLogSource(input.plan) : undefined,
    execSummary: input.execSummary ? normalizeLogSource(input.execSummary) : undefined,
    reviewSummary: input.reviewSummary ? normalizeLogSource(input.reviewSummary) : undefined,
    attempts: input.attempts,
    tools: collectToolNames(input.trace),
  };
}

async function readExistingLog(path: string): Promise<string | null> {
  try {
    const result = await invoke<{ content?: string }>("file_read", { path, workingDir: null });
    return result.content ?? null;
  } catch {
    return null;
  }
}

export async function appendScoreToLog(username: string, score: TaskScoreData): Promise<void> {
  if (!isTauri) return;

  const date = formatDailyDate(new Date());
  const path = `~/brains/${sanitizePathSegment(username)}/raw/${LOG_DIR}/${EXECUTION_LOG_DIR}/${date}.md`;

  const dimLines = score.dimensions
    .map((d) => `- **${d.name}**：${d.score}/10 — ${sanitizeLogField(d.comment)}`)
    .join("\n");

  const scoreEntry = [
    "## 任务评分",
    "",
    dimLines,
    "",
    `**总分**：${score.totalScore}/${score.maxScore}`,
    "",
    "### 总评",
    sanitizeLogField(score.summary),
    "",
  ].join("\n");

  const existing = await readExistingLog(path);
  const content = mergeDailyExecutionLog(existing, scoreEntry);

  await invoke("file_write", { path, content, workingDir: null });
}
