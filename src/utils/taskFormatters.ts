import type { TaskResource, AgentStep, TaskMessage } from "../types";
import { apiUrl } from "../api";

export interface ApiTask {
  id: string;
  createBy: string;
  subscribe: string[];
  content: string;
  mode: string;
  status: string;
  resources: TaskResource[];
  createdAt: number;
  attempt: number;
}

export function apiTaskToTaskMessage(t: ApiTask): TaskMessage {
  return {
    type: "task",
    id: `task-${t.id}`,
    seq: 0,
    taskId: t.id,
    from: t.createBy,
    content: t.content,
    status: t.status as TaskMessage["status"],
    mode: t.mode === "parallel" ? "parallel" : "serial",
    resources: t.resources,
    subscribe: t.subscribe,
    timestamp: t.createdAt,
  };
}

export function getStatusLabels(t: (key: string) => string): Record<TaskMessage["status"], string> {
  return {
    pending: t('task.status.pending'),
    running: t('task.status.running'),
    reviewing: t('task.status.reviewing'),
    completed: t('task.status.completed'),
    failed: t('task.status.failed'),
  };
}

export function getResultText(data: unknown): string {
  if (!data) return "";
  if (typeof data === "string") return data;
  if (typeof data === "object") {
    const obj = data as Record<string, unknown>;
    if ("result" in obj) {
      const val = obj.result;
      return typeof val === "string" ? val : JSON.stringify(val, null, 2);
    }
    if ("error" in obj) return `**Error:** ${obj.error}`;
  }
  return JSON.stringify(data, null, 2);
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

export function formatTimestamp(ts: number): string {
  return new Date(ts).toLocaleString();
}

export function formatTime(ts: number | undefined): string {
  if (ts === undefined) return "";
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function getTaskFileUrl(taskId: string, filename: string): string {
  return apiUrl(`/api/tasks/${taskId}/resources/${encodeURIComponent(filename)}`);
}

export function getTraceSteps(traceRes: TaskResource): AgentStep[] {
  const data = traceRes.data as { steps?: AgentStep[] };
  return data?.steps ?? [];
}

export function groupByAgent(steps: AgentStep[]): Map<string, AgentStep[]> {
  const map = new Map<string, AgentStep[]>();
  for (const step of steps) {
    const key = step.agent ?? "";
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(step);
  }
  return map;
}

export const AGENT_LABELS: Record<string, string> = {
  planner: "Planning",
  executor: "Execution",
  reviewer: "Review",
};

export function formatToolArgs(args: unknown): string {
  if (!args || typeof args !== "object") return String(args);
  const obj = args as Record<string, unknown>;
  if ("command" in obj) return String(obj.command);
  if ("path" in obj) return String(obj.path);
  return JSON.stringify(args);
}

export function formatToolResult(result: unknown): string {
  if (typeof result === "string") return result;
  if (result && typeof result === "object") {
    const obj = result as Record<string, unknown>;
    if ("stdout" in obj || "stderr" in obj) {
      const parts: string[] = [];
      if (obj.stdout) parts.push(String(obj.stdout));
      if (obj.stderr) parts.push(`[stderr] ${obj.stderr}`);
      return parts.join("\n");
    }
    if ("content" in obj) return String(obj.content);
    if ("ok" in obj && "path" in obj) return `uploaded: ${obj.path}`;
    if ("done" in obj) return String((result as Record<string, unknown>).result ?? "done");
  }
  return JSON.stringify(result);
}
