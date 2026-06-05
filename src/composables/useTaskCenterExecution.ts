import { ref, type Ref } from "vue";
import type { ClientTask } from "../../envoy/packages/client/client.js";
import { getMemberSettings, getTaskService } from "./teamClientContext";
import { isTauri, safeInvoke } from "../utils/platform";
import { getErrorMessage } from "../utils/error";
import { createTaskPipeline } from "../agent/pipelines/taskPipeline";
import { shouldWriteTaskReflection, writeTaskReflection, appendScoreToLog } from "../agent/reflectionMemory";
import { useExecutionMonitor } from "./useExecutionMonitor";
import type { TaskResolution, SkillCatalogResponse, AgentStep, TaskScoreData } from "../types";
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

      // Run scorer only when review passed
      let scoreData: TaskScoreData | undefined;
      if (pipelineResult.reviewPassed) {
        try {
          const scorerAgent = pipeline.createScorerAgent();
          const scorerInput = [
            `[原始任务]\n${taskContent}`,
            `[规划阶段结果]\n${pipelineResult.outputs.plan}`,
            `[执行阶段结果]\n${pipelineResult.outputs.execSummary}`,
            `[审查阶段结果]\n${pipelineResult.outputs.reviewSummary}`,
          ].join("\n\n");

          const scorerResult = await scorerAgent.run(scorerInput, monitor.emit);
          scoreData = JSON.parse(scorerResult.result) as TaskScoreData;

          // Append score to daily execution log
          if (shouldWriteTaskReflection(settings.value.task_reflection_memory_enabled)) {
            await appendScoreToLog(ctx.myId, scoreData);
          }
        } catch (scorerError) {
          console.warn("[scorer] scoring failed, continuing without score:", scorerError);
        }
      }

      resolveCurrentTask({
        success: pipelineResult.reviewPassed,
        source: "ai",
        data: {
          ...parsed,
          ...(scoreData ? { score: scoreData } : {}),
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
  } catch (e) {
    console.warn("[agent] loadSkillCatalog failed, proceeding without skills:", e);
  }
}
