import type { AgentStep } from "../../types";
import type { AgentInstance, AgentRunResult } from "./defineAgent";

export interface PipelineStage {
  agent: AgentInstance;
  output: string;
}

export interface RetryConfig {
  from: string;
  maxAttempts: number;
  feedback: string;
  shouldRetry?: (reviewOutput: string) => boolean;
}

export interface PipelineDefinition {
  stages: PipelineStage[];
  retry?: RetryConfig;
}

export interface PipelineResult {
  outputs: Record<string, string>;
  traces: Record<string, AgentStep[]>;
  attempts: number;
}

export interface PipelineInstance {
  run(taskContent: string): Promise<PipelineResult>;
}

export function definePipeline(def: PipelineDefinition): PipelineInstance {
  async function run(taskContent: string): Promise<PipelineResult> {
    const outputs: Record<string, string> = {};
    const traces: Record<string, AgentStep[]> = {};
    const maxAttempts = def.retry?.maxAttempts ?? 1;
    let attemptsMade = 0;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      let startIdx = 0;

      if (attempt > 1 && def.retry) {
        startIdx = def.stages.findIndex((s) => s.output === def.retry!.from);
        if (startIdx === -1) startIdx = 0;
      }

      for (let i = startIdx; i < def.stages.length; i++) {
        const stage = def.stages[i];
        let stageInput = taskContent;

        if (attempt > 1 && def.retry && i === startIdx) {
          const parts: string[] = [`[原始任务]\n${taskContent}`];
          for (const [key, value] of Object.entries(outputs)) {
            if (key !== def.retry.feedback && key !== stage.output) {
              parts.push(`[${key} 阶段结果]\n${value}`);
            }
          }
          if (outputs[def.retry.feedback]) {
            parts.push(`[审查反馈]\n${outputs[def.retry.feedback]}`);
          }
          stageInput = parts.join("\n\n");
        } else if (i > 0) {
          const prevStage = def.stages[i - 1];
          if (outputs[prevStage.output]) {
            stageInput = `${taskContent}\n\n[${prevStage.output} 阶段结果]\n${outputs[prevStage.output]}`;
          }
        }

        const result: AgentRunResult = await stage.agent.run(stageInput);
        outputs[stage.output] = result.result;
        traces[stage.output] = result.trace;
      }

      attemptsMade = attempt;

      if (def.retry && attempt < maxAttempts) {
        const reviewOutput = outputs[def.retry.feedback];
        if (def.retry.shouldRetry) {
          if (!def.retry.shouldRetry(reviewOutput)) break;
        }
      }
    }

    return { outputs, traces, attempts: attemptsMade };
  }

  return { run };
}
