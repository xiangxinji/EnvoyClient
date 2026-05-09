import { ref, onUnmounted } from "vue";
import { Leader } from "@envoy/teams";
import type { ClientTask, TaskHandler } from "@envoy/client";
import type { SubmitOptions } from "@envoy/core";
import type { ClientOptions } from "@envoy/client";

export type ConnectionStatus =
  | "disconnected"
  | "connecting"
  | "connected"
  | "reconnecting";

export function useLeader(options: ClientOptions) {
  const leader = new Leader(options);
  const status = ref<ConnectionStatus>("disconnected");
  const currentTask = ref<ClientTask | null>(null);
  const queueLength = ref(0);

  function syncState() {
    queueLength.value = leader.queueLength;
    currentTask.value = leader.currentTask;
  }

  leader.on("connected", () => {
    status.value = "connected";
    syncState();
  });
  leader.on("disconnected", () => {
    status.value = "disconnected";
    syncState();
  });
  leader.on("reconnecting", (_attempt: number) => {
    status.value = "reconnecting";
  });
  leader.on("task", () => {
    syncState();
  });

  function connect() {
    status.value = "connecting";
    return leader.connect();
  }

  function disconnect() {
    return leader.disconnect();
  }

  function submit(opts: SubmitOptions) {
    return leader.submit(opts);
  }

  function doing(handler: TaskHandler) {
    leader.doing(async (clientTask) => {
      syncState();
      try {
        return await handler(clientTask);
      } finally {
        syncState();
      }
    });
  }

  function onTask(callback: (task: unknown) => void) {
    leader.on("task", callback);
  }

  onUnmounted(() => {
    leader.disconnect();
  });

  return {
    status,
    currentTask,
    queueLength,
    connect,
    disconnect,
    submit,
    doing,
    onTask,
  };
}
