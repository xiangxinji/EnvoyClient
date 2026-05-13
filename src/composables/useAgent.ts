import { ref } from "vue";
import { invoke } from "@tauri-apps/api/core";

// ─── Manager URL ───

let _managerUrl: string | null = null;

export function setAgentManagerUrl(url: string) {
  _managerUrl = url;
}

function apiUrl(path: string): string {
  return `${_managerUrl ?? "http://localhost:8080"}${path}`;
}

// ─── Tauri environment detection ───

const isTauri = "__TAURI_INTERNALS__" in window;

// ─── Tool interfaces ───

export interface AgentToolSchema {
  name: string;
  description: string;
  parameters: Record<string, any>; // JSON Schema
}

export interface AgentTool extends AgentToolSchema {
  execute: (args: Record<string, any>) => Promise<any>;
}

// ─── Built-in tools ───

function createShellTool(): AgentTool {
  return {
    name: "shell",
    description: "执行 shell 命令并返回输出",
    parameters: {
      type: "object",
      properties: {
        command: { type: "string", description: "要执行的 shell 命令" },
      },
      required: ["command"],
    },
    execute: async ({ command }) => {
      if (!isTauri) return { error: "Not in Tauri environment" };
      return invoke("shell_exec", { command });
    },
  };
}

function createFileReadTool(): AgentTool {
  return {
    name: "file_read",
    description: "读取本地文件内容",
    parameters: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "文件路径（~ 开头表示用户 home 目录）",
        },
      },
      required: ["path"],
    },
    execute: async ({ path }) => {
      if (!isTauri) return { error: "Not in Tauri environment" };
      return invoke("file_read", { path });
    },
  };
}

function createFileWriteTool(): AgentTool {
  return {
    name: "file_write",
    description: "写入内容到本地文件",
    parameters: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "文件路径（~ 开头表示用户 home 目录）",
        },
        content: { type: "string", description: "要写入的内容" },
      },
      required: ["path", "content"],
    },
    execute: async ({ path, content }) => {
      if (!isTauri) return { error: "Not in Tauri environment" };
      return invoke("file_write", { path, content });
    },
  };
}

function createUploadResourceTool(ctx: {
  managerUrl: string;
  teamName: string;
  taskId: string;
  myId: string;
}): AgentTool {
  return {
    name: "upload_resource",
    description: "上传本地文件到 Manager 作为任务资源",
    parameters: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "本地文件路径（~ 开头表示用户 home 目录）",
        },
      },
      required: ["path"],
    },
    execute: async ({ path: filePath }) => {
      if (!isTauri) return { error: "Not in Tauri environment" };

      // Resolve ~ to home dir
      let resolved = filePath;
      if (resolved.startsWith("~")) {
        const { homedir } = await import("node:os");
        resolved = resolved.replace("~", homedir());
      }

      // Read file via Tauri IPC
      const content = await invoke("file_read", { path: resolved }) as string;
      const filename = resolved.split(/[/\\]/).pop() ?? "file";

      // Upload to Manager
      const blob = new Blob([content]);
      const formData = new FormData();
      formData.append("file", blob, filename);
      formData.append("from", ctx.myId);

      const res = await fetch(`${ctx.managerUrl}/api/tasks/${ctx.taskId}/resources`, {
        method: "POST",
        headers: { team: ctx.teamName },
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Upload failed" }));
        return { error: err.error };
      }

      return await res.json();
    },
  };
}

function createDoneTool(): AgentTool {
  return {
    name: "done",
    description: "声明任务完成，提交最终结果",
    parameters: {
      type: "object",
      properties: {
        result: { type: "string", description: "任务完成的结果摘要" },
      },
      required: ["result"],
    },
    execute: async ({ result }) => ({ done: true, result }),
  };
}

export { createUploadResourceTool };

export function getDefaultTools(): AgentTool[] {
  return [
    createShellTool(),
    createFileReadTool(),
    createFileWriteTool(),
    createDoneTool(),
  ];
}

// ─── Timeout helpers ───

function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  return Promise.race([
    fetch(url, options),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("AI reasoning timeout")), timeoutMs),
    ),
  ]);
}

function executeWithTimeout<T>(
  fn: () => Promise<T>,
  timeoutMs: number,
): Promise<T> {
  return Promise.race([
    fn(),
    new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error("Tool execution timeout")),
        timeoutMs,
      ),
    ),
  ]);
}

// ─── Truncate helper ───

function truncateToolResult(_toolName: string, result: any): any {
  if (typeof result !== "object" || result === null) return result;

  const truncated = { ...result };
  if (typeof truncated.stdout === "string" && truncated.stdout.length > 2000) {
    truncated.stdout =
      truncated.stdout.slice(0, 2000) +
      `... (truncated, total ${result.stdout.length} chars)`;
  }
  if (typeof truncated.stderr === "string" && truncated.stderr.length > 1000) {
    truncated.stderr =
      truncated.stderr.slice(0, 1000) +
      `... (truncated, total ${result.stderr.length} chars)`;
  }
  return truncated;
}

// ─── ReAct loop ───

const MAX_STEPS = 20;

type AgentMessage =
  | { role: "user"; content: string }
  | {
      role: "assistant";
      content: string;
      toolCalls: Array<{ id: string; name: string; args: any }>;
    }
  | { role: "tool"; content: string; toolCallId: string; toolName: string };

async function reactLoop(
  taskContent: string,
  tools: AgentTool[],
  currentStep: { value: number },
  error: { value: string },
): Promise<string> {
  const schemas = tools.map(({ execute, ...schema }) => schema);

  const messages: AgentMessage[] = [
    { role: "user", content: taskContent },
  ];

  for (let step = 0; step < MAX_STEPS; step++) {
    currentStep.value = step + 1;

    // 1. Call Manager AI
    const response = await fetchWithTimeout(
      apiUrl("/api/ai/agent/reason"),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages, tools: schemas }),
      },
      30_000, // 30s timeout for AI reasoning
    );

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      error.value = `AI reasoning failed: ${response.status} ${text}`;
      return JSON.stringify({ error: error.value });
    }

    const data = await response.json();

    // 2. No tool calls -> task done
    if (!data.toolCalls?.length) {
      return data.text || JSON.stringify({ result: "Task completed" });
    }

    // 3. Execute tool calls
    messages.push({
      role: "assistant",
      content: data.text || "",
      toolCalls: data.toolCalls,
    });

    for (const call of data.toolCalls) {
      const tool = tools.find((t) => t.name === call.name);
      if (!tool) {
        messages.push({
          role: "tool",
          content: JSON.stringify({ error: `Unknown tool: ${call.name}` }),
          toolCallId: call.id,
          toolName: call.name,
        });
        continue;
      }

      try {
        let result = await executeWithTimeout(
          () => tool.execute(call.args),
          60_000, // 60s timeout for tool execution
        );

        // Check if 'done' tool was called
        if (call.name === "done" && result?.done) {
          return result.result;
        }

        // Truncate tool results
        result = truncateToolResult(call.name, result);

        messages.push({
          role: "tool",
          content: JSON.stringify(result),
          toolCallId: call.id,
          toolName: call.name,
        });
      } catch (e: any) {
        messages.push({
          role: "tool",
          content: JSON.stringify({ error: e.message || String(e) }),
          toolCallId: call.id,
          toolName: call.name,
        });
      }
    }
  }

  // Max steps reached
  error.value = `Max steps (${MAX_STEPS}) reached`;
  return JSON.stringify({ error: error.value, maxStepsReached: true });
}

// ─── Composable ───

export function useAgent() {
  const isRunning = ref(false);
  const currentStep = ref(0);
  const error = ref("");

  async function runAgent(
    taskContent: string,
    customTools?: AgentTool[],
  ): Promise<string> {
    const tools = customTools ?? getDefaultTools();
    isRunning.value = true;
    currentStep.value = 0;
    error.value = "";

    try {
      const result = await reactLoop(taskContent, tools, currentStep, error);
      return result;
    } catch (e: any) {
      error.value = e.message || String(e);
      return JSON.stringify({ error: error.value });
    } finally {
      isRunning.value = false;
    }
  }

  return {
    isRunning,
    currentStep,
    error,
    runAgent,
    getDefaultTools,
  };
}
