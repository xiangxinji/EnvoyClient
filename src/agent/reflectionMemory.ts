import { invoke } from "@tauri-apps/api/core";
import type { AgentStep, TaskScoreData } from "../types";
import { evaluateTaskLog, type LogEvaluatorInput, type TaskLogDraft } from "./agents/logEvaluator";
import { isTauri } from "../utils/platform";

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

const LOG_DIR = "\u65e5\u5fd7";
const EXECUTION_LOG_DIR = "\u6267\u884c\u65e5\u5fd7";
const MAX_SECTION_CHARS = 1600;
const MAX_ENTRY_CHARS = 700;

const SECRET_PATTERNS: Array<[RegExp, string]> = [
  [/(["']?(?:api[_-]?key|token|password|passwd|secret|authorization)["']?\s*[:=]\s*)["']?[^"',\s}]+["']?/gi, "$1[REDACTED]"],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g, "[REDACTED PRIVATE KEY]"],
  [/(bearer\s+)[a-z0-9._~+/=-]+/gi, "$1[REDACTED]"],
];

export function buildTaskReflectionPath(input: Pick<TaskReflectionInput, "username" | "taskId" | "completedAt">): string {
  return buildDailyExecutionLogPath(input);
}

export function buildDailyExecutionLogPath(input: Pick<TaskReflectionInput, "username" | "completedAt">): string {
  const date = formatDailyDate(input.completedAt ?? new Date());
  return `~/brains/${sanitizePathSegment(input.username)}/raw/${LOG_DIR}/${EXECUTION_LOG_DIR}/${date}.md`;
}

export function createTaskReflectionMarkdown(input: TaskReflectionInput, draft?: TaskLogDraft | null): string {
  return createExecutionLogEntry(input, draft);
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

export function mergeDailyExecutionLog(existing: string | null, entry: string): string {
  const trimmedEntry = entry.trim();
  if (!existing?.trim()) return `# 执行日志\n\n${trimmedEntry}\n`;

  const normalized = existing.trimEnd();
  const withHeader = normalized.startsWith("# 执行日志")
    ? normalized
    : `# 执行日志\n\n${normalized}`;
  return `${withHeader}\n\n---\n\n${trimmedEntry}\n`;
}

function formatDailyDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function sanitizeFilename(value: string): string {
  const sanitized = value.replace(/[^a-zA-Z0-9._-]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 80);
  return sanitized || "task";
}

function sanitizePathSegment(value: string): string {
  return sanitizeFilename(value);
}

export function sanitizeText(value: string): string {
  let text = value;
  for (const [pattern, replacement] of SECRET_PATTERNS) {
    text = text.replace(pattern, replacement);
  }
  return text;
}

function stringify(value: unknown): string {
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function limitSection(value: unknown, maxChars = MAX_SECTION_CHARS): string {
  const text = normalizeLogSource(value).trim();
  if (text.length <= maxChars) return text || "No content captured.";
  return `${text.slice(0, maxChars)}\n\n...[truncated, total ${text.length} chars]`;
}

export function generateTaskTitle(input: TaskReflectionInput): string {
  const candidates = [
    input.execSummary,
    input.reviewSummary,
    input.plan,
    input.taskContent,
  ];

  for (const candidate of candidates) {
    const title = compactTitle(candidate ?? "");
    if (title) return title;
  }

  return input.success ? "任务执行记录" : "失败任务记录";
}

function compactTitle(value: string): string {
  const lines = normalizeLogSource(value)
    .replace(/[{}[\]"'`]/g, " ")
    .split(/\r?\n|。|；|;/)
    .map(cleanLogLine)
    .filter((line) => line.length > 0 && !line.includes("[REDACTED]"))
    .filter((line) => !isGenericLogHeading(line));

  const first = lines.find((line) => !/^(success|result|summary|error)\b/i.test(line)) ?? lines[0];
  if (!first) return "";

  return shortenTitle(first);
}

function shortenTitle(value: string): string {
  const cleaned = value
    .replace(/\s+/g, " ")
    .replace(/https?:\/\/\S+/g, "")
    .replace(/~?[/\\][^\s]+/g, "")
    .trim();

  if (!cleaned) return "";
  if (/[\u4e00-\u9fff]/.test(cleaned)) return cleaned.slice(0, 20);

  return cleaned.split(" ").slice(0, 8).join(" ").slice(0, 60);
}

function summarizeExecutionProcess(input: TaskReflectionInput): string {
  const bullets = extractBullets(input.plan || input.execSummary || "", 4);
  if (bullets.length > 0) return bullets.map((line) => `- ${line}`).join("\n");

  const tools = summarizeToolNames(input.trace);
  if (tools) return `- 调用工具：${tools}`;

  return "- 完成 Agent 执行流程。";
}

function summarizeTaskResult(input: TaskReflectionInput): string {
  const status = input.success ? "成功" : "失败";
  const source = input.reviewSummary || input.execSummary || (input.success ? "任务已完成。" : "任务未通过或执行失败。");
  return [`- 状态：${status}`, `- 摘要：${limitSection(source, MAX_ENTRY_CHARS)}`].join("\n");
}

function summarizeExecutionReview(input: TaskReflectionInput): string {
  const source = input.reviewSummary || input.execSummary || "";
  const bullets = extractBullets(source, 3);
  if (bullets.length > 0) return bullets.map((line) => `- ${line}`).join("\n");

  return input.success
    ? "- 本次任务执行成功，后续类似任务可参考本次执行路径。"
    : "- 本次任务失败，后续应优先检查失败原因再复用相关步骤。";
}

function extractBullets(value: string, maxItems: number): string[] {
  const text = normalizeLogSource(value);
  return text
    .split(/\r?\n/)
    .map(cleanLogLine)
    .filter((line) => line.length > 0)
    .filter((line) => !isGenericLogHeading(line))
    .filter((line) => !/^[{}\[\],"]+$/.test(line))
    .map((line) => limitSection(line, 140).replace(/\r?\n/g, " "))
    .slice(0, maxItems);
}

function summarizeToolNames(trace: AgentStep[]): string {
  const tools = new Set<string>();
  for (const step of trace) {
    for (const call of step.toolCalls) {
      tools.add(call.name);
    }
  }
  return [...tools].sort().join("、");
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

function collectToolNames(trace: AgentStep[]): string[] {
  const tools = new Set<string>();
  for (const step of trace) {
    for (const call of step.toolCalls) tools.add(call.name);
  }
  return [...tools].sort();
}

function normalizeLogSource(value: unknown): string {
  const raw = sanitizeText(stringify(value)).trim();
  const parsed = parseSummaryJson(raw);
  return stripFormattingNoise(parsed ?? raw);
}

function parseSummaryJson(raw: string): string | null {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed === "string") return parsed;
    if (parsed && typeof parsed === "object") {
      const record = parsed as Record<string, unknown>;
      if (typeof record.summary === "string") return record.summary;
      if (typeof record.result === "string") return record.result;
      if (typeof record.error === "string") return record.error;
    }
  } catch {
    return null;
  }
  return null;
}

function stripFormattingNoise(value: string): string {
  return value
    .replace(/```[\s\S]*?```/g, "")
    .split(/\r?\n/)
    .map(cleanLogLine)
    .filter((line) => line.length > 0)
    .join("\n");
}

function cleanLogLine(value: string): string {
  return value
    .replace(/^#{1,6}\s*/, "")
    .replace(/^[-*•\d.\s:：]+/, "")
    .trim();
}

function isGenericLogHeading(value: string): boolean {
  return /^(执行摘要|任务执行计划|任务目标|执行步骤|任务结果|审查结果)$/i.test(value.trim());
}

function sanitizeLogField(value: string): string {
  return stripFormattingNoise(value).replace(/\r?\n{3,}/g, "\n\n").trim() || "无";
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
