import { ref, type Ref } from "vue";
import type { AgentTool } from "../tools";
import type { AgentResult } from "../../types";
import { getErrorMessage } from "../../utils/error";
import { reactLoop } from "../react";

export interface AgentDefinition {
  name: string;
  instructions: string;
  tools: AgentTool[];
  maxSteps?: number;
  workspacePath?: string;
  skillCatalog?: string;
}

export interface AgentRunResult extends AgentResult {
  agentName: string;
}

export interface AgentInstance {
  readonly name: string;
  readonly isRunning: Ref<boolean>;
  readonly currentStep: Ref<number>;
  readonly error: Ref<string>;
  run(taskContent: string): Promise<AgentRunResult>;
}

export function defineAgent(def: AgentDefinition): AgentInstance {
  const isRunning = ref(false);
  const currentStep = ref(0);
  const error = ref("");

  async function run(taskContent: string): Promise<AgentRunResult> {
    const fullTask = def.instructions
      ? `${def.instructions}\n\n${taskContent}`
      : taskContent;

    isRunning.value = true;
    currentStep.value = 0;
    error.value = "";

    try {
      const result = await reactLoop(
        fullTask,
        def.tools,
        currentStep,
        error,
        def.workspacePath,
        def.skillCatalog,
        def.maxSteps,
      );
      return { ...result, agentName: def.name };
    } catch (e: unknown) {
      const msg = getErrorMessage(e);
      error.value = msg;
      return {
        result: JSON.stringify({ error: msg }),
        trace: [],
        agentName: def.name,
      };
    } finally {
      isRunning.value = false;
    }
  }

  return { name: def.name, isRunning, currentStep, error, run };
}
