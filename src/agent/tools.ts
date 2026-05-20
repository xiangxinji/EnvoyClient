import { invoke } from "@tauri-apps/api/core";
import { apiUrl } from "../api";
import { isTauri } from "../utils/platform";
import {
  createUploadResourceTool,
  createQueryResourcesTool,
  createReadResourceTool,
  createReadSkillTool,
} from "./resourceTools";

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

export function createShellTool(workingDir?: string): AgentTool {
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
      return invoke("shell_exec", { command: command as string, workingDir: workingDir || null });
    },
  };
}

export function createFileReadTool(workingDir?: string): AgentTool {
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
      return invoke("file_read", { path: path as string, workingDir: workingDir || null });
    },
  };
}

export function createFileWriteTool(workingDir?: string): AgentTool {
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
      return invoke("file_write", { path: path as string, content: content as string, workingDir: workingDir || null });
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

// ─── Re-export resource tools ───

export {
  createUploadResourceTool,
  createQueryResourcesTool,
  createReadResourceTool,
  createReadSkillTool,
};

// ─── Cloud tools (Manager REST API) ───

export function createCloudListTool(ctx: {
  teamName: string;
}): AgentTool {
  return {
    name: "cloud_list",
    description: "列出团队云资源目录下的文件和子目录",
    parameters: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "目录路径，留空表示根目录",
        },
      },
      required: [],
    },
    execute: async ({ path }) => {
      const query = path ? `?path=${encodeURIComponent(path as string)}` : "";
      const res = await fetch(
        apiUrl(`/api/cloud/files${query}`),
        { headers: { team: ctx.teamName } }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "List failed" }));
        return { error: err.error };
      }
      return await res.json();
    },
  };
}

export function createCloudUploadTool(ctx: {
  teamName: string;
  myId: string;
}): AgentTool {
  return {
    name: "cloud_upload",
    description: "上传文件内容到团队云资源",
    parameters: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "目标目录路径，留空表示根目录",
        },
        filename: {
          type: "string",
          description: "文件名",
        },
        content: {
          type: "string",
          description: "文件内容",
        },
      },
      required: ["filename", "content"],
    },
    execute: async ({ path, filename, content }) => {
      const blob = new Blob([content as string]);
      const formData = new FormData();
      formData.append("file", blob, filename as string);
      if (path) formData.append("path", path as string);
      formData.append("uploadedBy", ctx.myId);

      const res = await fetch(apiUrl("/api/cloud/files"), {
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

// ─── Default tool set ───

export function getDefaultTools(workingDir?: string): AgentTool[] {
  return [
    createShellTool(workingDir),
    createFileReadTool(workingDir),
    createFileWriteTool(workingDir),
    createDoneTool(),
  ];
}
