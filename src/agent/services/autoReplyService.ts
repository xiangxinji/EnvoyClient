import { invoke } from "@tauri-apps/api/core";
import { isTauri } from "../../utils/platform";
import { getMemberSettings } from "../../composables/teamClientContext";
import { defineService } from "../core/defineService";

const LOG_PREFIX = "raw/日志/";
const MAX_CONTENT_SIZE = 100 * 1024; // 100KB max for knowledge_write

function decodeBase64(b64: string): string {
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  return new TextDecoder("utf-8").decode(bytes);
}

export const autoReplyService = defineService({
  name: "auto-reply",
  operations: [
    // ─── Settings tools ───

    {
      name: "get_settings",
      description: "查看当前的 AI 自动回复相关设置，包括自动回复开关、任务执行模式、上下文消息条数等。",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
      run: async () => {
        const { settings } = getMemberSettings();
        const s = settings.value;
        return {
          ai_auto_reply: s.ai_auto_reply,
          task_execution_mode: s.task_execution_mode,
          ai_suggestion_history_count: s.ai_suggestion_history_count,
        };
      },
    },
    {
      name: "toggle_auto_reply",
      description: "关闭 AI 自动回复。注意：只能关闭，不能通过此工具重新开启（需用户手动开启）。",
      parameters: {
        type: "object",
        properties: {
          enabled: { type: "boolean", description: "设为 false 关闭自动回复" },
        },
        required: ["enabled"],
      },
      run: async (args, ctx) => {
        const enabled = !!args.enabled;
        // Only allow turning OFF auto-reply, never turn it back ON via AI
        if (enabled) {
          return { success: false, error: "AI 不能自行开启自动回复，请让用户手动开启" };
        }
        const { saveSettings } = getMemberSettings();
        await saveSettings(ctx.myId, { ai_auto_reply: false });
        return { success: true, ai_auto_reply: false };
      },
    },
    {
      name: "set_execution_mode",
      description: "设置任务执行模式。mode 可选 'auto'（自动执行）或 'manual'（手动执行）。",
      parameters: {
        type: "object",
        properties: {
          mode: { type: "string", description: "执行模式：auto 或 manual", enum: ["auto", "manual"] },
        },
        required: ["mode"],
      },
      run: async (args, ctx) => {
        const mode = args.mode === "manual" ? "manual" : "auto";
        const { saveSettings } = getMemberSettings();
        await saveSettings(ctx.myId, { task_execution_mode: mode as "auto" | "manual" });
        return { success: true, task_execution_mode: mode };
      },
    },

    // ─── Knowledge base tools ───

    {
      name: "knowledge_list",
      description: "列出知识库中的所有文件（不含日志文件）。返回文件路径、修改时间和大小。",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
      run: async (_args, ctx) => {
        if (!isTauri) return { files: [] };
        try {
          const scan = await invoke<{ files: Array<{ path: string; mtime_ms: number; size: number }> }>(
            "scan_brains_files",
            { username: ctx.myId },
          );
          const files = scan.files.filter((f) => !f.path.startsWith(LOG_PREFIX));
          return { files };
        } catch {
          return { files: [] };
        }
      },
    },
    {
      name: "knowledge_read",
      description: "读取知识库中指定文件的内容。",
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
          return { error: "日志文件不可读取" };
        }
        try {
          const result = await invoke<{ content?: string; error?: string }>(
            "read_brains_file",
            { username: ctx.myId, path },
          );
          if (!result?.content) return { error: result?.error ?? "文件不存在或读取失败" };
          return { content: decodeBase64(result.content), path };
        } catch {
          return { error: "文件不存在或读取失败" };
        }
      },
    },
    {
      name: "knowledge_write",
      description: "写入或更新知识库中的文件。如果文件已存在则覆盖，不存在则创建。",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "文件相对路径（如 skills/new-skill.md）" },
          content: { type: "string", description: "要写入的文件内容" },
        },
        required: ["path", "content"],
      },
      run: async (args, ctx) => {
        if (!isTauri) return { error: "Not in Tauri environment" };
        const path = (args.path as string).replace(/^\/+/, "");
        const content = args.content as string;
        if (content.length > MAX_CONTENT_SIZE) {
          return { error: `内容过大（${Math.round(content.length / 1024)}KB），最大允许 100KB` };
        }
        if (path.startsWith(LOG_PREFIX)) {
          return { error: "不允许写入日志文件" };
        }
        try {
          await invoke("write_brains_file", { username: ctx.myId, path, content });
          return { success: true, path };
        } catch (e) {
          return { error: `写入失败: ${e instanceof Error ? e.message : String(e)}` };
        }
      },
    },
    {
      name: "knowledge_delete",
      description: "删除知识库中的指定文件。此操作不可恢复，请谨慎使用。",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "要删除的文件相对路径" },
        },
        required: ["path"],
      },
      run: async (args, ctx) => {
        if (!isTauri) return { error: "Not in Tauri environment" };
        const path = (args.path as string).replace(/^\/+/, "");
        try {
          await invoke("delete_brains_file", { username: ctx.myId, path });
          return { success: true, path };
        } catch (e) {
          return { error: `删除失败: ${e instanceof Error ? e.message : String(e)}` };
        }
      },
    },
  ],
});
