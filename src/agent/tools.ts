import { invoke } from "@tauri-apps/api/core";
import { apiUrl } from "../api";

const isTauri = "__TAURI_INTERNALS__" in window;

// ─── Tool interfaces ───

export interface AgentToolSchema {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface AgentTool extends AgentToolSchema {
  execute: (args: Record<string, unknown>) => Promise<unknown>;
}

// ─── Built-in tools ───

export function createShellTool(username?: string): AgentTool {
  const workspaceDir = username ? `~/.envoy/workspace/${username}` : undefined;
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
      return invoke("shell_exec", { command: command as string, workingDir: workspaceDir });
    },
  };
}

export function createFileReadTool(): AgentTool {
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
      return invoke("file_read", { path: path as string });
    },
  };
}

export function createFileWriteTool(): AgentTool {
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
      return invoke("file_write", { path: path as string, content: content as string });
    },
  };
}

export function createDoneTool(): AgentTool {
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
    execute: async ({ result }) => ({ done: true, result: result as string }),
  };
}

// ─── Resource tools (Manager REST API) ───

export function createUploadResourceTool(ctx: {
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

      let resolved = filePath as string;
      if (resolved.startsWith("~")) {
        const { homedir } = await import("node:os");
        resolved = resolved.replace("~", homedir());
      }

      const result = await invoke("file_read", { path: resolved }) as { content?: string; error?: string };
      if (!result?.content) return { error: result?.error ?? "Failed to read file" };

      const filename = resolved.split(/[/\\]/).pop() ?? "file";

      const blob = new Blob([result.content]);
      const formData = new FormData();
      formData.append("file", blob, filename);
      formData.append("from", ctx.myId);

      const res = await fetch(apiUrl(`/api/tasks/${ctx.taskId}/resources`), {
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

export function createQueryResourcesTool(ctx: {
  teamName: string;
}): AgentTool {
  return {
    name: "query_resources",
    description: "查询指定任务的资源文件列表，支持查自己或其他成员的任务",
    parameters: {
      type: "object",
      properties: {
        taskId: {
          type: "string",
          description: "任务 ID",
        },
      },
      required: ["taskId"],
    },
    execute: async ({ taskId }) => {
      const res = await fetch(
        apiUrl(`/api/tasks/${taskId}/resources`),
        { headers: { team: ctx.teamName } }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Query failed" }));
        return { error: err.error };
      }
      return await res.json();
    },
  };
}

export function createReadResourceTool(ctx: {
  teamName: string;
}): AgentTool {
  return {
    name: "read_resource",
    description: "读取指定任务的具体资源文件内容",
    parameters: {
      type: "object",
      properties: {
        taskId: {
          type: "string",
          description: "任务 ID",
        },
        file: {
          type: "string",
          description: "资源文件名（从 query_resources 获取）",
        },
      },
      required: ["taskId", "file"],
    },
    execute: async ({ taskId, file }) => {
      const taskIdStr = taskId as string;
      const fileName = file as string;
      const res = await fetch(
        apiUrl(`/api/tasks/${taskIdStr}/resources/${encodeURIComponent(fileName)}`),
        { headers: { team: ctx.teamName } }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Read failed" }));
        return { error: err.error };
      }
      const contentType = res.headers.get("content-type") ?? "";
      if (contentType.includes("application/json") || contentType.includes("text/")) {
        return { content: await res.text(), filename: file };
      }
      // Binary file: return base64 (browser-compatible)
      const bytes = new Uint8Array(await res.arrayBuffer());
      let binary = "";
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
      return { content: btoa(binary), filename: file, encoding: "base64" };
    },
  };
}

export function createReadSkillTool(username: string): AgentTool {
  return {
    name: "read_skill",
    description: "读取指定技能的完整内容",
    parameters: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "技能名称（文件名，不含 .md 后缀）",
        },
      },
      required: ["name"],
    },
    execute: async ({ name }) => {
      if (!isTauri) return { error: "Not in Tauri environment" };
      return invoke("file_read", { path: `~/.envoy/brains/${username}/skills/${name as string}.md` });
    },
  };
}

// ─── Default tool set ───

export function getDefaultTools(): AgentTool[] {
  return [
    createShellTool(),
    createFileReadTool(),
    createFileWriteTool(),
    createDoneTool(),
  ];
}
