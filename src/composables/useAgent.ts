import { ref } from "vue";
import { getDefaultTools } from "../agent/tools";
import { reactLoop } from "../agent/react";
import type { AgentResult } from "../types";
import { getErrorMessage } from "../utils/error";

export type { AgentTool, AgentToolSchema } from "../agent/tools";
export { createUploadResourceTool, createQueryResourcesTool, createReadResourceTool } from "../agent/tools";

export function useAgent() {
  const isRunning = ref(false);
  const currentStep = ref(0);
  const error = ref("");

  async function runAgent(
    taskContent: string,
    customTools?: ReturnType<typeof getDefaultTools>,
    workspacePath?: string,
    skillCatalog?: string,
  ): Promise<AgentResult> {
    const tools = customTools ?? getDefaultTools();
    isRunning.value = true;
    currentStep.value = 0;
    error.value = "";

    try {
      return await reactLoop(taskContent, tools, currentStep, error, workspacePath, skillCatalog);
    } catch (e: unknown) {
      error.value = getErrorMessage(e);
      return { result: JSON.stringify({ error: error.value }), trace: [] };
    } finally {
      isRunning.value = false;
    }
  }

  return {
    isRunning,
    currentStep,
    error,
    runAgent,
    getDefaultTools,
  };
}
