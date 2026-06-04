import { invoke } from "@tauri-apps/api/core";
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

export function createScorerDoneTool(): AgentTool {
  return {
    name: "done",
    description: "提交任务评分结果。对四个维度分别打分并给出总评。",
    parameters: {
      type: "object",
      properties: {
        dimensions: {
          type: "array",
          description: "四个评分维度：任务理解、规划质量、执行质量、结果质量",
          items: {
            type: "object",
            properties: {
              name: { type: "string", description: "维度名称" },
              score: { type: "number", description: "分数（1-10）" },
              comment: { type: "string", description: "评语" },
            },
            required: ["name", "score", "comment"],
          },
        },
        summary: {
          type: "string",
          description: "总体评价",
        },
      },
      required: ["dimensions", "summary"],
    },
    execute: async ({ dimensions, summary }) => {
      const dims = (dimensions as Array<{ name: string; score: number; comment: string }>).map((d) => ({
        name: String(d.name),
        score: Math.max(1, Math.min(10, Math.round(Number(d.score) || 1))),
        comment: String(d.comment),
      }));
      const totalScore = dims.reduce((sum, d) => sum + d.score, 0);
      return {
        done: true,
        result: JSON.stringify({
          dimensions: dims,
          totalScore,
          maxScore: 40,
          summary: typeof summary === "string" ? summary : String(summary),
        }),
      };
    },
  };
}

// ─── Re-export resource tools ───

export {
  createUploadResourceTool,
  createQueryResourcesTool,
  createReadResourceTool,
  createReadSkillTool,
};

// ─── Default tool set ───

export function getDefaultTools(workingDir?: string): AgentTool[] {
  return [
    createShellTool(workingDir),
    createFileReadTool(workingDir),
    createFileWriteTool(workingDir),
    createDoneTool(),
  ];
}
