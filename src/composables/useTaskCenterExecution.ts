import { ref, watch, type Ref } from "vue";
import type { ClientTask } from "../../envoy/packages/client/client.js";
import { getMemberSettings, getTaskService } from "./teamClientContext";
import { isTauri, safeInvoke } from "../utils/platform";
import { getErrorMessage } from "../utils/error";
import { createTaskPipeline } from "../agent/pipelines/taskPipeline";
import { useExecutionMonitor } from "./useExecutionMonitor";
import { writeOutbox, deleteOutbox, submitWithRetry } from "../utils/outbox";
import type { SkillCatalogResponse, AgentStep } from "../types";
import type { ServiceContext } from "../agent/core/defineService";

interface TaskCenterExecutionCtx {
  myId: string;
  teamName: string;
}

export function useTaskCenterExecution(
  ctx: TaskCenterExecutionCtx,
  currentClientTask: Ref<ClientTask | null>,
  resolveCurrentTask: (result: unknown) => void,
) {
  const { settings, loadSettings } = getMemberSettings();
  const taskService = getTaskService();
  const monitor = useExecutionMonitor();

  const isRunning = ref(false);

  async function executeCurrentTask() {
    const clientTask = currentClientTask.value;
    if (!clientTask) return;

    const taskId = clientTask.serverTask.id;
    const taskContent = clientTask.serverTask.content;

    isRunning.value = true;

    try {
      void taskService.start(taskId);

      if (!isTauri) {
        const result = { taskId, note: "browser mode, no agent tools" };
        resolveCurrentTask(result);
        return;
      }

      await loadSettings(ctx.myId);
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
        onEvent: monitor.emit,
      });

      monitor.startExecution(taskId, taskContent);
      monitor.emit({ type: "pipeline:start", taskId, taskContent });

      const pipelineResult = await pipeline.run(taskContent);

      monitor.emit({
        type: "pipeline:end",
        success: pipelineResult.reviewPassed,
        summary: pipelineResult.outputs.execSummary,
      });

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

      const resultPayload = {
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
      };
      await writeOutbox(ctx.teamName, taskId, resultPayload);
      const ok = await submitWithRetry(() => taskService.submitResult(taskId, resultPayload));
      if (ok) await deleteOutbox(ctx.teamName, taskId);

      resolveCurrentTask(parsed);
    } catch (e) {
      const error = getErrorMessage(e);
      const taskId = currentClientTask.value?.serverTask.id;
      if (taskId) {
        const errorPayload = { from: ctx.myId, success: false, error };
        await writeOutbox(ctx.teamName, taskId, errorPayload);
        const ok = await submitWithRetry(() => taskService.submitResult(taskId, errorPayload));
        if (ok) await deleteOutbox(ctx.teamName, taskId);
      }
      resolveCurrentTask({ error });
    } finally {
      isRunning.value = false;
    }
  }

  // Auto mode: watch currentClientTask and auto-execute
  watch(currentClientTask, async (task) => {
    if (!task) return;
    await loadSettings(ctx.myId);
    if (settings.value.task_execution_mode === "auto") {
      await executeCurrentTask();
    }
  });

  return {
    isRunning,
    executeCurrentTask,
    monitor,
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
