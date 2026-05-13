import { ref } from "vue";
import { getDefaultTools } from "../agent/tools";
import { reactLoop } from "../agent/react";

export type { AgentTool, AgentToolSchema } from "../agent/tools";
export { createUploadResourceTool, createQueryResourcesTool, createReadResourceTool } from "../agent/tools";

export function useAgent() {
  const isRunning = ref(false);
  const currentStep = ref(0);
  const error = ref("");

  async function runAgent(
    taskContent: string,
    customTools?: ReturnType<typeof getDefaultTools>,
  ): Promise<string> {
    const tools = customTools ?? getDefaultTools();
    isRunning.value = true;
    currentStep.value = 0;
    error.value = "";

    try {
      const result = await reactLoop(taskContent, tools, currentStep, error);
      return result;
    } catch (e: any) {
      error.value = e.message || String(e);
      return JSON.stringify({ error: error.value });
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
