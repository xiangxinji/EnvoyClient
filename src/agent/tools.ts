import { invoke } from "@tauri-apps/api/core";
import { isTauri } from "../utils/platform";
import {
  createUploadResourceTool,
  createQueryResourcesTool,
  createReadResourceTool,
  createReadSkillTool,
} from "./resourceTools";
import { apiUrl, getClientToken } from "../api";

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

export function createReviewDoneTool(): AgentTool {
  return {
    name: "done",
    description: "提交审查结果。passed 为 true 表示通过，false 表示未通过。",
    parameters: {
      type: "object",
      properties: {
        passed: {
          type: "boolean",
          description: "审查是否通过。通过为 true，未通过为 false。",
        },
        summary: {
          type: "string",
          description: "审查结论摘要。通过时简述理由，未通过时列出具体问题。",
        },
      },
      required: ["passed", "summary"],
    },
    execute: async ({ passed, summary }) => ({
      done: true,
      result: JSON.stringify({
        passed: passed === true,
        summary: typeof summary === "string" ? summary : String(summary),
      }),
    }),
  };
}

// ─── Re-export resource tools ───

export {
  createUploadResourceTool,
  createQueryResourcesTool,
  createReadResourceTool,
  createReadSkillTool,
};

// ─── Glossary tool ───

interface GlossaryItem {
  term: string;
  definition: string;
}

export function createGlossaryTool(teamName: string): AgentTool {
  let cached: GlossaryItem[] | null = null;

  async function fetchGlossary(): Promise<GlossaryItem[]> {
    if (cached) return cached;
    try {
      const token = getClientToken();
      const res = await fetch(apiUrl(`/api/glossary?team=${encodeURIComponent(teamName)}`), {
        headers: { ...(token ? { "X-Envoy-Token": token } : {}) },
      });
      if (!res.ok) return [];
      cached = (await res.json()) as GlossaryItem[];
      return cached;
    } catch {
      return [];
    }
  }

  return {
    name: "query_glossary",
    description: "查询术语词汇的统一定义。当遇到不确定含义的专业术语或需要统一用语时，使用此工具查询标准释义。",
    parameters: {
      type: "object",
      properties: {
        term: {
          type: "string",
          description: "要查询的术语名称。留空则返回所有术语列表。支持模糊匹配。",
        },
      },
    },
    execute: async ({ term }) => {
      const entries = await fetchGlossary();
      if (entries.length === 0) {
        return { found: false, message: "词汇表为空或不可用" };
      }
      const q = ((term as string) || "").trim().toLowerCase();
      if (!q) {
        return { terms: entries.map((e) => ({ term: e.term, definition: e.definition })) };
      }
      const matched = entries.filter(
        (e) => e.term.toLowerCase().includes(q) || e.definition.toLowerCase().includes(q),
      );
      if (matched.length === 0) {
        return { found: false, message: `未找到术语「${term}」的释义` };
      }
      return { found: true, terms: matched.map((e) => ({ term: e.term, definition: e.definition })) };
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
