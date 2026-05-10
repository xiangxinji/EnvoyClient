import type {
  TaskGenerateRequest,
  TaskPlan,
  AnalyzeRequest,
  AnalysisResult,
  MemberDescriptor,
  TaskExecutionResult,
} from "../shared/types";

export async function generateTask(
  baseUrl: string,
  description: string,
  members: MemberDescriptor[],
  options?: { context?: string; token?: string },
): Promise<TaskPlan> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (options?.token) {
    headers["Authorization"] = `Bearer ${options.token}`;
  }

  const body: TaskGenerateRequest = { description, members, context: options?.context };

  const response = await fetch(`${baseUrl}/api/ai/task/generate`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`AI task generate failed: ${response.status} ${text}`);
  }

  return response.json();
}

export async function analyzeResult(
  baseUrl: string,
  taskDescription: string,
  results: TaskExecutionResult[],
  options?: { token?: string },
): Promise<AnalysisResult> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (options?.token) {
    headers["Authorization"] = `Bearer ${options.token}`;
  }

  const body: AnalyzeRequest = { taskDescription, results };

  const response = await fetch(`${baseUrl}/api/ai/task/analyze`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`AI analyze failed: ${response.status} ${text}`);
  }

  return response.json();
}
