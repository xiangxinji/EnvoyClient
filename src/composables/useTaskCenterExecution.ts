import { ref, type Ref } from "vue";
import type { ClientTask } from "../../envoy/packages/client/client.js";
import { getMemberSettings, getTaskService } from "./teamClientContext";
import { isTauri, safeInvoke } from "../utils/platform";
import { getErrorMessage } from "../utils/error";
import { createTaskPipeline } from "../agent/pipelines/taskPipeline";
import { shouldWriteTaskReflection, writeTaskReflection } from "../agent/reflectionMemory";
import { useExecutionMonitor } from "./useExecutionMonitor";
import type { TaskResolution, SkillCatalogResponse, AgentStep } from "../types";
import type { ServiceContext } from "../agent/core/defineService";

interface TaskCenterExecutionCtx {
  myId: string;
  teamName: string;
}

export function useTaskCenterExecution(
  ctx: TaskCenterExecutionCtx,
  currentClientTask: Ref<ClientTask | null>,
  resolveCurrentTask: (result: TaskResolution) => void,
  setAutoExecutor: (executor: (task: ClientTask) => Promise<void>) => void,
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
      await taskService.start(taskId);

      if (!isTauri) {
        resolveCurrentTask({ success: true, source: "manual", data: { taskId, note: "browser mode, no agent tools" } });
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

      if (shouldWriteTaskReflection(settings.value.task_reflection_memory_enabled)) {
        try {
          const reflection = await writeTaskReflection({
            username: ctx.myId,
            taskId,
            taskContent,
            success: pipelineResult.reviewPassed,
            plan: pipelineResult.outputs.plan,
            execSummary: pipelineResult.outputs.execSummary,
            reviewSummary: pipelineResult.outputs.reviewSummary,
            attempts: pipelineResult.attempts,
            trace: allTraces,
            completedAt: new Date(),
          });
          if (reflection) {
            console.info(`[reflection-memory] wrote task reflection: ${reflection.path}`);
          }
        } catch (reflectionError) {
          console.warn("[reflection-memory] failed to write task reflection:", reflectionError);
        }
      }

      resolveCurrentTask({
        success: pipelineResult.reviewPassed,
        source: "ai",
        data: {
          ...parsed,
          pipeline: {
            plan: pipelineResult.outputs.plan,
            reviewSummary: pipelineResult.outputs.reviewSummary,
            attempts: pipelineResult.attempts,
          },
        },
        trace: allTraces,
      });
    } catch (e) {
      const error = getErrorMessage(e);
      if (shouldWriteTaskReflection(settings.value.task_reflection_memory_enabled)) {
        try {
          const reflection = await writeTaskReflection({
            username: ctx.myId,
            taskId,
            taskContent,
            success: false,
            execSummary: error,
            reviewSummary: "Task execution failed before review completed.",
            attempts: 0,
            trace: [],
            completedAt: new Date(),
          });
          if (reflection) {
            console.info(`[reflection-memory] wrote failed-task reflection: ${reflection.path}`);
          }
        } catch (reflectionError) {
          console.warn("[reflection-memory] failed to write failed-task reflection:", reflectionError);
        }
      }
      resolveCurrentTask({
        success: false,
        source: "ai",
        error,
      });
    } finally {
      isRunning.value = false;
    }
  }

  setAutoExecutor(async () => {
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
