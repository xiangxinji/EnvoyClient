import { defineAgent } from "../core/defineAgent";
import { createDoneTool } from "../tools";

export interface LogEvaluatorInput {
  taskContent: string;
  success: boolean;
  plan?: string;
  execSummary?: string;
  reviewSummary?: string;
  attempts: number;
  tools: string[];
}

export interface TaskLogDraft {
  title: string;
  description: string;
  process: string[];
  result: string;
  review: string[];
}

export async function evaluateTaskLog(input: LogEvaluatorInput): Promise<TaskLogDraft | null> {
  const agent = defineAgent({
    name: "log-evaluator",
    instructions: `你是执行日志整理 agent。你的任务是把任务执行过程整理成简洁、干净、可读的日志条目。

必须输出 JSON，字段如下：
{
  "title": "8-20字短标题，不包含 markdown 标题符号",
  "description": "任务描述，1-3句",
  "process": ["关键执行步骤，最多4条"],
  "result": "任务结果，1-3句",
  "review": ["执行复盘，最多3条"]
}

规则：
- 不要输出 markdown。
- 不要输出代码块。
- 不要把 JSON 原文塞进字段。
- 不要保留 #、##、### 这类 markdown 标题。
- 不要包含完整 trace、完整工具输出或大段 stdout/stderr。
- 如果看到 token、password、secret、api key、authorization，必须省略或写为 [REDACTED]。
- title 要像日志标题，不要叫“执行摘要”“任务执行计划”这类来源标题。
- 结束时调用 done 工具，result 填 JSON 字符串。`,
    tools: [createDoneTool()],
    maxSteps: 3,
  });

  try {
    const result = await agent.run(buildLogEvaluatorPrompt(input));
    return parseTaskLogDraft(result.result);
  } catch {
    return null;
  }
}

export function parseTaskLogDraft(raw: string): TaskLogDraft | null {
  const json = extractJson(raw);
  if (!json) return null;

  try {
    const parsed = JSON.parse(json) as Partial<TaskLogDraft>;
    const title = cleanDraftText(parsed.title);
    const description = cleanDraftText(parsed.description);
    const process = cleanDraftList(parsed.process);
    const result = cleanDraftText(parsed.result);
    const review = cleanDraftList(parsed.review);

    if (isGenericTitle(title)) return null;
    if (!title || !description || process.length === 0 || !result || review.length === 0) return null;
    return { title, description, process, result, review };
  } catch {
    return null;
  }
}

function buildLogEvaluatorPrompt(input: LogEvaluatorInput): string {
  return [
    "[任务描述]",
    input.taskContent,
    "",
    "[执行状态]",
    input.success ? "成功" : "失败",
    "",
    "[尝试次数]",
    String(input.attempts),
    "",
    "[计划输出]",
    input.plan || "无",
    "",
    "[执行摘要]",
    input.execSummary || "无",
    "",
    "[审查输出]",
    input.reviewSummary || "无",
    "",
    "[使用工具]",
    input.tools.length > 0 ? input.tools.join(", ") : "无",
  ].join("\n");
}

function extractJson(raw: string): string | null {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const source = fenced?.[1]?.trim() || trimmed;

  if (source.startsWith("{") && source.endsWith("}")) return source;

  const start = source.indexOf("{");
  const end = source.lastIndexOf("}");
  if (start >= 0 && end > start) return source.slice(start, end + 1);

  return null;
}

function cleanDraftList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map(cleanDraftText)
    .filter(Boolean)
    .slice(0, 4);
}

function cleanDraftText(value: unknown): string {
  if (typeof value !== "string") return "";
  return value
    .replace(/```[\s\S]*?```/g, "")
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isGenericTitle(value: string): boolean {
  return /^(执行摘要|任务执行计划|任务目标|执行步骤|任务结果|审查结果)$/i.test(value.trim());
}
