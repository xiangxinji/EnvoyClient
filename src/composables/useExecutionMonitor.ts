import { reactive, toRefs } from "vue";
import type { ExecutionEvent, ExecutionEntry } from "../types";

export interface ExecutionState {
  status: "idle" | "running" | "done";
  taskInfo: { taskId: string; taskContent: string } | null;
  currentStage: string;
  entries: ExecutionEntry[];
}

const state = reactive<ExecutionState>({
  status: "idle",
  taskInfo: null,
  currentStage: "",
  entries: [],
});

export function useExecutionMonitor() {
  function startExecution(taskId: string, taskContent: string) {
    state.status = "running";
    state.taskInfo = { taskId, taskContent };
    state.currentStage = "";
    state.entries = [];
  }

  function emit(event: ExecutionEvent) {
    state.entries.push({ timestamp: Date.now(), event });
    switch (event.type) {
      case "pipeline:start":
        state.status = "running";
        break;
      case "stage:start":
        state.currentStage = event.stage;
        break;
      case "pipeline:end":
        state.status = "done";
        break;
    }
  }

  function clearExecution() {
    state.status = "idle";
    state.taskInfo = null;
    state.currentStage = "";
    state.entries = [];
  }

  return {
    ...toRefs(state),
    startExecution,
    emit,
    clearExecution,
  };
}
