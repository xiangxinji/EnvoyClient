import { invoke } from "@tauri-apps/api/core";
import { isTauri } from "../../utils/platform";
import { defineService } from "../core/defineService";

const LOG_PREFIX = "raw/日志/";

interface ScanResult {
  files: Array<{ path: string; mtime_ms: number; size: number }>;
}

interface ReadResult {
  content?: string;
  error?: string;
}

function decodeBase64(b64: string): string {
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  return new TextDecoder("utf-8").decode(bytes);
}

async function scanFiles(username: string): Promise<ScanResult | null> {
  try {
    return await invoke<ScanResult>("scan_brains_files", { username });
  } catch {
    return null;
  }
}

async function readFile(username: string, path: string): Promise<string | null> {
  try {
    const result = await invoke<ReadResult>("read_brains_file", { username, path });
    if (!result?.content) return null;
    return decodeBase64(result.content);
  } catch {
    return null;
  }
}

export const brainsService = defineService({
  name: "brains",
  operations: [
    {
      name: "list_brains_files",
      description: "列出知识库中的所有文件（不含日志文件）。返回文件路径、修改时间和大小。",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
      run: async (_args, ctx) => {
        if (!isTauri) return { files: [] };
        const scan = await scanFiles(ctx.myId);
        if (!scan) return { files: [] };
        const files = scan.files.filter((f) => !f.path.startsWith(LOG_PREFIX));
        return { files };
      },
    },
    {
      name: "read_brains_file",
      description: "读取知识库中指定路径的文件内容。不允许读取日志文件（使用 read_log 读取日志）。",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "文件相对路径（如 skills/my-skill.md、glossary/system.md）" },
        },
        required: ["path"],
      },
      run: async (args, ctx) => {
        if (!isTauri) return { error: "Not in Tauri environment" };
        const path = (args.path as string).replace(/^\/+/, "");
        if (path.startsWith(LOG_PREFIX)) {
          return { error: "日志文件请使用 read_log 工具读取" };
        }
        const content = await readFile(ctx.myId, path);
        if (content === null) return { error: "文件不存在或读取失败" };
        return { content, path };
      },
    },
    {
      name: "list_logs",
      description: "列出所有执行日志文件。返回文件路径、修改时间和大小。",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
      run: async (_args, ctx) => {
        if (!isTauri) return { files: [] };
        const scan = await scanFiles(ctx.myId);
        if (!scan) return { files: [] };
        const files = scan.files.filter((f) => f.path.startsWith(LOG_PREFIX));
        return { files };
      },
    },
    {
      name: "read_log",
      description: "读取指定路径的日志文件内容。只能读取日志目录下的文件。",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "日志文件相对路径（如 raw/日志/执行日志/2026-06-04.md）" },
        },
        required: ["path"],
      },
      run: async (args, ctx) => {
        if (!isTauri) return { error: "Not in Tauri environment" };
        const path = (args.path as string).replace(/^\/+/, "");
        if (!path.startsWith(LOG_PREFIX)) {
          return { error: "非日志文件请使用 read_brains_file 工具读取" };
        }
        const content = await readFile(ctx.myId, path);
        if (content === null) return { error: "文件不存在或读取失败" };
        return { content, path };
      },
    },
  ],
});
