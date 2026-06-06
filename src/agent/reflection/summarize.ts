import type { AgentStep } from "../../types";
import { normalizeLogSource, cleanLogLine, isGenericLogHeading, limitSection, MAX_ENTRY_CHARS } from "./textUtils";

export function generateTaskTitle(input: { execSummary?: string; reviewSummary?: string; plan?: string; taskContent: string; success: boolean }): string {
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
  if (/[一-鿿]/.test(cleaned)) return cleaned.slice(0, 20);

  return cleaned.split(" ").slice(0, 8).join(" ").slice(0, 60);
}

export function summarizeExecutionProcess(input: { plan?: string; execSummary?: string; trace: AgentStep[] }): string {
  const bullets = extractBullets(input.plan || input.execSummary || "", 4);
  if (bullets.length > 0) return bullets.map((line) => `- ${line}`).join("\n");

  const tools = summarizeToolNames(input.trace);
  if (tools) return `- 调用工具：${tools}`;

  return "- 完成 Agent 执行流程。";
}

export function summarizeTaskResult(input: { success: boolean; reviewSummary?: string; execSummary?: string; taskContent: string }): string {
  const status = input.success ? "成功" : "失败";
  const source = input.reviewSummary || input.execSummary || (input.success ? "任务已完成。" : "任务未通过或执行失败。");
  return [`- 状态：${status}`, `- 摘要：${limitSection(source, MAX_ENTRY_CHARS)}`].join("\n");
}

export function summarizeExecutionReview(input: { success: boolean; reviewSummary?: string; execSummary?: string }): string {
  const source = input.reviewSummary || input.execSummary || "";
  const bullets = extractBullets(source, 3);
  if (bullets.length > 0) return bullets.map((line) => `- ${line}`).join("\n");

  return input.success
    ? "- 本次任务执行成功，后续类似任务可参考本次执行路径。"
    : "- 本次任务失败，后续应优先检查失败原因再复用相关步骤。";
}

export function extractBullets(value: string, maxItems: number): string[] {
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

export function summarizeToolNames(trace: AgentStep[]): string {
  const tools = new Set<string>();
  for (const step of trace) {
    for (const call of step.toolCalls) {
      tools.add(call.name);
    }
  }
  return [...tools].sort().join("、");
}

export function collectToolNames(trace: AgentStep[]): string[] {
  const tools = new Set<string>();
  for (const step of trace) {
    for (const call of step.toolCalls) tools.add(call.name);
  }
  return [...tools].sort();
}
