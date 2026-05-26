import { invoke } from "@tauri-apps/api/core";
import { apiUrl } from "../../api";
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
        properties: { path: { type: "string", description: "目录路径，留空表示根目录" } },
        required: [],
      },
      run: async (args, ctx) => {
        const path = args.path as string | undefined;
        const query = path ? `?path=${encodeURIComponent(path)}` : "";
        const res = await fetch(
          apiUrl(`/api/cloud/files${query}`),
          { headers: { team: ctx.teamName } },
        );
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
          path: { type: "string", description: "目标目录路径，留空表示根目录" },
          filename: { type: "string", description: "文件名" },
          content: { type: "string", description: "文件内容" },
        },
        required: ["filename", "content"],
      },
      run: async (args, ctx) => {
        const path = args.path as string | undefined;
        const filename = args.filename as string;
        const content = args.content as string;
        const blob = new Blob([content]);
        const formData = new FormData();
        formData.append("file", blob, filename);
        if (path) formData.append("path", path);
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
          cloudPath: { type: "string", description: "目标云目录路径，留空表示根目录" },
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
        const cloudPath = args.cloudPath as string | undefined;
        if (cloudPath) formData.append("path", cloudPath);
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
        return res.json();
      },
    },
  ],
});
