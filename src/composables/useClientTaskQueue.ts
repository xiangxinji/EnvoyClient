import { ref, computed, type Ref } from "vue";
import type { Client, ClientTask } from "../../envoy/packages/client/client.js";

export interface ClientQueueTask {
  clientTaskId: string;
  taskId: string;
  content: string;
  status: "queued" | "running" | "completed" | "failed" | "skipped";
  startedAt?: number;
  completedAt?: number;
  duration?: number;
  error?: string;
}

function toQueueTask(ct: ClientTask, status: ClientQueueTask["status"]): ClientQueueTask {
  const content = ct.serverTask.content.length > 80
    ? ct.serverTask.content.slice(0, 80) + "..."
    : ct.serverTask.content;
  return {
    clientTaskId: ct.id,
    taskId: ct.serverTask.id,
    content,
    status,
    startedAt: ct.startedAt,
    completedAt: ct.completedAt,
    duration: ct.startedAt && ct.completedAt ? ct.completedAt - ct.startedAt : undefined,
    error: ct.error,
  };
}

export function useClientTaskQueue(
  client: Client,
  agent: { isRunning: Ref<boolean>; currentStep: Ref<number> },
) {
  const queue = ref<ClientQueueTask[]>([]);
  const running = ref<ClientQueueTask | null>(null);
  const history = ref<ClientQueueTask[]>([]);

  const onQueued = (ct: ClientTask) => { queue.value.push(toQueueTask(ct, "queued")); };
  const onStarted = (ct: ClientTask) => {
    running.value = toQueueTask(ct, "running");
    queue.value = queue.value.filter((t) => t.clientTaskId !== ct.id);
  };
  const onCompleted = (ct: ClientTask) => {
    history.value.unshift(toQueueTask(ct, "completed"));
    if (history.value.length > 20) history.value.pop();
    running.value = null;
  };
  const onFailed = (ct: ClientTask) => {
    history.value.unshift(toQueueTask(ct, "failed"));
    if (history.value.length > 20) history.value.pop();
    running.value = null;
  };
  const onSkipped = (ct: ClientTask) => {
    history.value.unshift(toQueueTask(ct, "skipped"));
    if (history.value.length > 20) history.value.pop();
    running.value = null;
  };

  client.on("task_queued", onQueued);
  client.on("task_started", onStarted);
  client.on("task_completed", onCompleted);
  client.on("task_failed", onFailed);
  client.on("task_skipped", onSkipped);

  const agentStep = computed(() => agent.currentStep.value);
  const agentRunning = computed(() => agent.isRunning.value);

  function dispose() {
    client.off("task_queued", onQueued);
    client.off("task_started", onStarted);
    client.off("task_completed", onCompleted);
    client.off("task_failed", onFailed);
    client.off("task_skipped", onSkipped);
  }

  return { queue, running, history, agentStep, agentRunning, dispose };
}
