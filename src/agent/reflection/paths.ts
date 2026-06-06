export const LOG_DIR = "日志";
export const EXECUTION_LOG_DIR = "执行日志";

export function buildDailyExecutionLogPath(input: { username: string; completedAt?: Date }): string {
  const date = formatDailyDate(input.completedAt ?? new Date());
  return `~/brains/${sanitizePathSegment(input.username)}/raw/${LOG_DIR}/${EXECUTION_LOG_DIR}/${date}.md`;
}

export function buildTaskReflectionPath(input: { username: string; taskId: string; completedAt?: Date }): string {
  return buildDailyExecutionLogPath(input);
}

export function formatDailyDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function sanitizeFilename(value: string): string {
  const sanitized = value.replace(/[^a-zA-Z0-9._-]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 80);
  return sanitized || "task";
}

export function sanitizePathSegment(value: string): string {
  return sanitizeFilename(value);
}
