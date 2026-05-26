import { invoke } from "@tauri-apps/api/core";
import { isTauri } from "../../utils/platform";
import { defineService } from "../core/defineService";

export const fileService = defineService({
  name: "file",
  operations: [
    {
      name: "shell",
      description: "执行 shell 命令并返回输出",
      parameters: {
        type: "object",
        properties: { command: { type: "string", description: "要执行的 shell 命令" } },
        required: ["command"],
      },
      run: async (args, ctx) => {
        if (!isTauri) return { error: "Not in Tauri environment" };
        const command = args.command as string;
        return invoke("shell_exec", { command, workingDir: ctx.workspacePath || null });
      },
    },
    {
      name: "file_read",
      description: "读取本地文件内容",
      parameters: {
        type: "object",
        properties: { path: { type: "string", description: "文件路径（~ 开头表示用户 home 目录）" } },
        required: ["path"],
      },
      run: async (args, ctx) => {
        if (!isTauri) return { error: "Not in Tauri environment" };
        const path = args.path as string;
        return invoke("file_read", { path, workingDir: ctx.workspacePath || null });
      },
    },
    {
      name: "file_write",
      description: "写入内容到本地文件",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "文件路径（~ 开头表示用户 home 目录）" },
          content: { type: "string", description: "要写入的内容" },
        },
        required: ["path", "content"],
      },
      run: async (args, ctx) => {
        if (!isTauri) return { error: "Not in Tauri environment" };
        const path = args.path as string;
        const content = args.content as string;
        return invoke("file_write", { path, content, workingDir: ctx.workspacePath || null });
      },
    },
  ],
});
