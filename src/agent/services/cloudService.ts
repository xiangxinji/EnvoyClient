import { invoke } from "@tauri-apps/api/core";
import { managerFetch } from "../../api";
import { isTauri } from "../../utils/platform";
import { defineService } from "../core/defineService";

export const cloudService = defineService({
  name: "cloud",
  operations: [
    {
      name: "cloud_list",
      description: "列出团队云资源目录下的文件和子目录",
      parameters: {
        type: "object",
        properties: { parentId: { type: "string", description: "父目录 ID，留空表示根目录" } },
        required: [],
      },
      run: async (args, ctx) => {
        const parentId = args.parentId as string | undefined;
        const query = parentId ? `?parentId=${encodeURIComponent(parentId)}` : "";
        const res = await managerFetch(`/api/cloud/files${query}`, {
          headers: { team: ctx.teamName },
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: "List failed" }));
          return { error: err.error };
        }
        return res.json();
      },
    },
    {
      name: "cloud_upload",
      description: "上传文件内容到团队云资源",
      parameters: {
        type: "object",
        properties: {
          parentId: { type: "string", description: "目标目录 ID，留空表示根目录" },
          filename: { type: "string", description: "文件名" },
          content: { type: "string", description: "文件内容" },
        },
        required: ["filename", "content"],
      },
      run: async (args, ctx) => {
        const parentId = args.parentId as string | undefined;
        const filename = args.filename as string;
        const content = args.content as string;
        const blob = new Blob([content]);
        const formData = new FormData();
        formData.append("file", blob, filename);
        if (parentId) formData.append("parentId", parentId);
        formData.append("uploadedBy", ctx.myId);

        const res = await managerFetch("/api/cloud/files", {
          method: "POST",
          headers: { team: ctx.teamName },
          body: formData,
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: "Upload failed" }));
          return { error: err.error };
        }
        return res.json();
      },
    },
    {
      name: "cloud_upload_file",
      description: "将本地文件上传到团队云资源目录，自动读取文件内容，只需提供本地文件路径和目标目录",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "本地文件路径（~ 开头表示用户 home 目录）" },
          parentId: { type: "string", description: "目标云目录 ID，留空表示根目录" },
        },
        required: ["path"],
      },
      run: async (args, ctx) => {
        if (!isTauri) return { error: "Not in Tauri environment" };

        let filePath = args.path as string;
        if (filePath.startsWith("~")) {
          const { homedir } = await import("node:os");
          filePath = filePath.replace("~", homedir());
        }

        const result = await invoke("file_read", { path: filePath }) as { content?: string; error?: string };
        if (!result?.content) return { error: result?.error ?? "Failed to read file" };

        const filename = filePath.split(/[/\\]/).pop() ?? "file";
        const blob = new Blob([result.content]);
        const formData = new FormData();
        formData.append("file", blob, filename);
        const parentId = args.parentId as string | undefined;
        if (parentId) formData.append("parentId", parentId);
        formData.append("uploadedBy", ctx.myId);

        const res = await managerFetch("/api/cloud/files", {
          method: "POST",
          headers: { team: ctx.teamName },
          body: formData,
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: "Upload failed" }));
          return { error: err.error };
        }
        return res.json();
      },
    },
    {
      name: "smart_upload",
      description: "智能上传文件到团队云资源，AI自动判断最佳存放目录。优先使用此工具上传文件，只需提供文件名、内容和简短描述",
      parameters: {
        type: "object",
        properties: {
          filename: { type: "string", description: "文件名" },
          content: { type: "string", description: "文件内容" },
          description: { type: "string", description: "文件内容的简短描述（一句话说明这是什么文件）" },
          taskContext: { type: "string", description: "可选，任务上下文描述" },
        },
        required: ["filename", "content", "description"],
      },
      run: async (args, ctx) => {
        const filename = args.filename as string;
        const content = args.content as string;
        const description = args.description as string;
        const taskContext = args.taskContext as string | undefined;

        const blob = new Blob([content]);
        const formData = new FormData();
        formData.append("file", blob, filename);
        formData.append("filename", filename);
        formData.append("description", description);
        formData.append("uploadedBy", ctx.myId);
        if (taskContext) formData.append("taskContext", taskContext);

        const res = await managerFetch("/api/cloud/smart-upload", {
          method: "POST",
          headers: { team: ctx.teamName },
          body: formData,
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: "Smart upload failed" }));
          return { error: err.error, fallback: err.fallback };
        }
        return res.json();
      },
    },
  ],
});
