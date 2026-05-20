import { ref } from "vue";
import type { MemberInfo, TaskMessage, TaskResource, AIHealthResponse } from "../types";
import { apiUrl, managerPost } from "../api";
import { getErrorMessage } from "../utils/error";

function extractResultOutput(data: unknown): { stdout: string; stderr: string; exit_code: number } {
  if (typeof data === "object" && data !== null) {
    const obj = data as Record<string, unknown>;
    return {
      stdout: typeof obj.stdout === "string" ? obj.stdout : "",
      stderr: typeof obj.stderr === "string" ? obj.stderr : "",
      exit_code: typeof obj.exit_code === "number" ? obj.exit_code : -1,
    };
  }
  return { stdout: JSON.stringify(data), stderr: "", exit_code: 0 };
}

export function useAITask() {
  const taskAiError = ref("");
  const aiAvailable = ref(false);

  fetch(apiUrl("/api/ai/health"))
    .then((r) => r.json())
    .then((h: AIHealthResponse) => { aiAvailable.value = h.configured; })
    .catch(() => { aiAvailable.value = false; });

  // backward-compatible alias
  const aiError = taskAiError;

  async function planTask(description: string, members: MemberInfo[]) {
    taskAiError.value = "";

    try {
      const res = await managerPost("/api/ai/task/generate", {
        description,
        members: members.map((m) => ({ id: m.id, role: m.role })),
      });
      return await res.json();
    } catch (e: unknown) {
      taskAiError.value = getErrorMessage(e);
      return null;
    }
  }

  async function analyzeTaskResult(taskDescription: string, results: TaskMessage["resources"]) {
    taskAiError.value = "";

    try {
      const res = await managerPost("/api/ai/task/analyze", {
        taskDescription,
        results: results.map((r) => ({
          memberId: r.by,
          commands: [taskDescription],
          ...extractResultOutput(r.data),
        })),
      });
      return await res.json();
    } catch (e: unknown) {
      taskAiError.value = getErrorMessage(e);
      return null;
    }
  }

  async function dispatchTask(description: string, members: Array<{ id: string; responsibilities?: string; capabilities?: string }>) {
    taskAiError.value = "";

    try {
      const res = await managerPost("/api/ai/task/dispatch", { description, members });
      return await res.json() as { subscribe: string[]; content: string };
    } catch (e: unknown) {
      taskAiError.value = getErrorMessage(e);
      return null;
    }
  }

  async function reviewTaskResult(
    taskContent: string,
    memberResults: TaskResource[],
  ): Promise<{ success: boolean; summary: string }> {
    taskAiError.value = "";

    try {
      // Only send client-result (actual task output) as results
      const clientResults = memberResults
        .filter((r) => r.type === "client-result")
        .map((r) => ({
          from: r.by ?? "unknown",
          data: r.data ?? r,
        }));

      // Send file resources separately with metadata
      const fileResources = memberResults
        .filter((r) => r.type === "file-resource")
        .map((r) => {
          const d = r.data as Record<string, unknown> | undefined;
          return {
            by: r.by ?? "unknown",
            filename: (d?.filename as string) ?? "",
            size: (d?.size as number) ?? 0,
          };
        });

      const res = await managerPost("/api/ai/task/review", {
        taskDescription: taskContent,
        results: clientResults,
        resources: fileResources,
      });
      return await res.json() as { success: boolean; summary: string };
    } catch (e: unknown) {
      taskAiError.value = getErrorMessage(e);
      return { success: false, summary: `Review failed: ${getErrorMessage(e)}` };
    }
  }

  return {
    aiError,
    taskAiError,
    aiAvailable,
    planTask,
    analyzeTaskResult,
    dispatchTask,
    reviewTaskResult,
  };
}
