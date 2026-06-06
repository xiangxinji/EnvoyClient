import { sanitizeText } from "./sanitize";

export const MAX_SECTION_CHARS = 1600;
export const MAX_ENTRY_CHARS = 700;

export function stringify(value: unknown): string {
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export function limitSection(value: unknown, maxChars = MAX_SECTION_CHARS): string {
  const text = normalizeLogSource(value).trim();
  if (text.length <= maxChars) return text || "No content captured.";
  return `${text.slice(0, maxChars)}\n\n...[truncated, total ${text.length} chars]`;
}

export function normalizeLogSource(value: unknown): string {
  const raw = sanitizeText(stringify(value)).trim();
  const parsed = parseSummaryJson(raw);
  return stripFormattingNoise(parsed ?? raw);
}

export function parseSummaryJson(raw: string): string | null {
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

export function stripFormattingNoise(value: string): string {
  return value
    .replace(/```[\s\S]*?```/g, "")
    .split(/\r?\n/)
    .map(cleanLogLine)
    .filter((line) => line.length > 0)
    .join("\n");
}

export function cleanLogLine(value: string): string {
  return value
    .replace(/^#{1,6}\s*/, "")
    .replace(/^[-*•\d.\s:：]+/, "")
    .trim();
}

export function isGenericLogHeading(value: string): boolean {
  return /^(执行摘要|任务执行计划|任务目标|执行步骤|任务结果|审查结果)$/i.test(value.trim());
}
