import { SKIP_RESULT } from "../../envoy/packages/client/client.js";
import { useAITask as useAI } from "./useAITask";
import { getMemberSettings, getTaskService } from "./teamClientContext";
import { isTauri, safeInvoke } from "../utils/platform";
import { getErrorMessage } from "../utils/error";
import { createTaskPipeline } from "../agent/pipelines/taskPipeline";
import type { TaskResource, SkillCatalogResponse, AgentStep } from "../types";
import type { ServiceContext } from "../agent/core/defineService";

interface TaskExecutionContext {
  role: "leader" | "member";
  myId: string;
  teamName: string;
}

export function useTaskExecution(ctx: TaskExecutionContext) {
  const { settings, loadSettings } = getMemberSettings();
  const taskService = getTaskService();

  function registerHandler(client: { doing: (handler: (task: { serverTask: { id: string; content: string; status: string; attempt: number; resources: TaskResource[] } }) => Promise<unknown>) => void }) {
    client.doing(async (clientTask) => {
      const taskId = clientTask.serverTask.id;
      const taskContent = clientTask.serverTask.content;
      const taskStatus = clientTask.serverTask.status;

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

      void taskService.submitResult(taskId, {
        from: ctx.myId,
        success: reviewResult.success,
        data: { review: reviewResult.summary, source: "ai", ...reviewResult },
      });
      return reviewResult;
    } catch (e) {
      void taskService.submitResult(taskId, {
        from: ctx.myId,
        success: false,
        error: `Leader review failed: ${getErrorMessage(e)}`,
      });
      return { error: getErrorMessage(e) };
    }
  }

  async function handleMemberExecution(taskId: string, taskContent: string) {
    void taskService.start(taskId);

    if (!isTauri) {
      const result = { taskId, note: "browser mode, no agent tools" };
      void taskService.submitResult(taskId, { from: ctx.myId, success: true, data: result });
      return result;
    }

    try {
      const customDir = settings.value.working_directory;
      const workspacePath = (customDir && customDir.trim()) || `~/.envoy/workspace/${ctx.myId}`;

      const skillCatalog = await loadSkillCatalog(ctx.myId);

      const serviceCtx: ServiceContext = {
        teamName: ctx.teamName,
        myId: ctx.myId,
        taskId,
        workspacePath,
      };

      const pipeline = createTaskPipeline({
        ctx: serviceCtx,
        skillCatalog,
        maxRetryAttempts: 2,
      });

      const pipelineResult = await pipeline.run(taskContent);

      // 合并所有阶段的 trace
      const allTraces: AgentStep[] = [];
      for (const steps of Object.values(pipelineResult.traces)) {
        allTraces.push(...steps);
      }

      let parsed;
      try {
        parsed = JSON.parse(pipelineResult.outputs.execSummary);
      } catch {
        parsed = { result: pipelineResult.outputs.execSummary };
      }

      void taskService.submitResult(taskId, {
        from: ctx.myId,
        success: pipelineResult.reviewPassed,
        data: {
          ...parsed,
          source: "ai",
          pipeline: {
            plan: pipelineResult.outputs.plan,
            reviewSummary: pipelineResult.outputs.reviewSummary,
            attempts: pipelineResult.attempts,
          },
        },
        trace: allTraces,
      });
      return parsed;
    } catch (e) {
      const error = getErrorMessage(e);
      void taskService.submitResult(taskId, { from: ctx.myId, success: false, error });
      return { error };
    }
  }

  return {
    registerHandler,
  };
}

async function loadSkillCatalog(username: string): Promise<string | undefined> {
  try {
    const catalogResult = await safeInvoke("load_skill_catalog", { username }) as SkillCatalogResponse | undefined;
    const skills = catalogResult?.skills;
    if (skills && skills.length > 0) {
      const lines = skills.map((s) => `- ${s.name}: ${s.description}`);
      return `你可以使用以下技能：\n${lines.join("\n")}\n需要使用某个技能时，调用 read_skill 工具读取完整内容。`;
    }
  } catch {
    // skills unavailable
  }
}
