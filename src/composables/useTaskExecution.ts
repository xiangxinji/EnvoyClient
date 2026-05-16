import { invoke } from "@tauri-apps/api/core";
import { SKIP_RESULT } from "../../envoy/packages/client/client.js";
import { useAgent } from "./useAgent";
import { useAI } from "./useAI";
import {
  getDefaultTools,
  createUploadResourceTool,
  createQueryResourcesTool,
  createReadResourceTool,
  createReadSkillTool,
} from "../agent/tools";
import { managerPost } from "../api";
import { getMemberSettings } from "./teamClientContext";
import type { TaskResource, SkillCatalogResponse } from "../types";

const isTauri = "__TAURI_INTERNALS__" in window;

function safeInvoke(cmd: string, args: Record<string, unknown>) {
  if (!isTauri) return Promise.resolve();
  return invoke(cmd, args);
}

interface TaskExecutionContext {
  role: "leader" | "member";
  myId: string;
  teamName: string;
}

export function useTaskExecution(ctx: TaskExecutionContext) {
  const agent = useAgent();
  const { settings, loadSettings } = getMemberSettings();

  function postToManager(path: string, body: Record<string, unknown>) {
    return managerPost(path, body, { team: ctx.teamName });
  }

  function registerHandler(client: { doing: (handler: (task: { serverTask: { id: string; content: string; status: string; attempt: number; resources: TaskResource[] } }) => Promise<unknown>) => void }) {
    client.doing(async (clientTask) => {
      const taskId = clientTask.serverTask.id;
      const taskContent = clientTask.serverTask.content;
      const taskStatus = clientTask.serverTask.status;

      // Ensure settings are loaded before checking mode
      await loadSettings(ctx.myId);

      if (ctx.role === "leader" && taskStatus === "reviewing") {
        if (settings.value.task_execution_mode === "manual") {
          return SKIP_RESULT;
        }
        return await handleLeaderReview(clientTask, taskId, taskContent);
      }

      if (settings.value.task_execution_mode === "manual") {
        return SKIP_RESULT;
      }

      return await handleMemberExecution(taskId, taskContent);
    });
  }

  async function handleLeaderReview(clientTask: { serverTask: { id: string; content: string; status: string; attempt: number; resources: TaskResource[] } }, taskId: string, taskContent: string) {
    const task = clientTask.serverTask;
    const memberResults = task.resources.filter(
      (r) => r.attempt === task.attempt,
    );

    try {
      const ai = useAI();
      const reviewResult = await ai.reviewTaskResult(taskContent, memberResults);

      postToManager(`/api/tasks/${taskId}/result`, {
        from: ctx.myId,
        success: reviewResult.success,
        data: { review: reviewResult.summary, source: "ai", ...reviewResult },
      });
      return reviewResult;
    } catch (e) {
      postToManager(`/api/tasks/${taskId}/result`, {
        from: ctx.myId,
        success: false,
        error: `Leader review failed: ${String(e)}`,
      });
      return { error: String(e) };
    }
  }

  async function handleMemberExecution(taskId: string, taskContent: string) {
    // Transition server-side task status: pending → running
    postToManager(`/api/tasks/${taskId}/start`, { from: ctx.myId });

    if (!isTauri) {
      const result = { taskId, note: "browser mode, no agent tools" };
      postToManager(`/api/tasks/${taskId}/result`, { from: ctx.myId, success: true, data: result });
      return result;
    }

    try {
      const uploadTool = createUploadResourceTool({ teamName: ctx.teamName, taskId, myId: ctx.myId });
      const queryResTool = createQueryResourcesTool({ teamName: ctx.teamName });
      const readResTool = createReadResourceTool({ teamName: ctx.teamName });
      const readSkillTool = createReadSkillTool(ctx.myId);

      // Resolve workspace: custom working_dir from settings or default
      const customDir = settings.value.working_directory;
      const workspacePath = (customDir && customDir.trim()) || `~/.envoy/workspace/${ctx.myId}`;

      const tools = [...getDefaultTools(workspacePath), uploadTool, queryResTool, readResTool, readSkillTool];

      let skillCatalog: string | undefined;
      try {
        const catalogResult = await safeInvoke("load_skill_catalog", { username: ctx.myId }) as SkillCatalogResponse | undefined;
        const skills = catalogResult?.skills;
        if (skills && skills.length > 0) {
          const lines = skills.map((s) => `- ${s.name}: ${s.description}`);
          skillCatalog =
            `你可以使用以下技能：\n${lines.join("\n")}\n需要使用某个技能时，调用 read_skill 工具读取完整内容。`;
        }
      } catch {
        // skills unavailable, continue without
      }

      const agentResult = await agent.runAgent(taskContent, tools, workspacePath, skillCatalog);

      let parsed;
      try {
        parsed = JSON.parse(agentResult.result);
      } catch {
        parsed = { result: agentResult.result };
      }

      postToManager(`/api/tasks/${taskId}/result`, {
        from: ctx.myId,
        success: true,
        data: { ...parsed, source: "ai" },
        trace: agentResult.trace,
      });
      return parsed;
    } catch (e) {
      const error = String(e);
      postToManager(`/api/tasks/${taskId}/result`, { from: ctx.myId, success: false, error });
      return { error };
    }
  }

  return {
    agent,
    registerHandler,
  };
}
