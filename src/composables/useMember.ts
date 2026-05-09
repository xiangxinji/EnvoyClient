import { ref, onUnmounted } from "vue";
import { Member } from "@envoy/teams";
import type { ClientTask, TaskHandler } from "@envoy/client";
import type { SubmitOptions } from "@envoy/core";
import type { ClientOptions } from "@envoy/client";

export type ConnectionStatus =
  | "disconnected"
  | "connecting"
  | "connected"
  | "reconnecting";

export function useMember(options: ClientOptions) {
  const member = new Member(options);
  const status = ref<ConnectionStatus>("disconnected");
  const currentTask = ref<ClientTask | null>(null);
  const queueLength = ref(0);

  function syncState() {
    queueLength.value = member.queueLength;
    currentTask.value = member.currentTask;
  }

  member.on("connected", () => {
    status.value = "connected";
    syncState();
  });
  member.on("disconnected", () => {
    status.value = "disconnected";
    syncState();
  });
  member.on("reconnecting", (_attempt: number) => {
    status.value = "reconnecting";
  });
  member.on("task", () => {
    syncState();
  });

  function connect() {
    status.value = "connecting";
    return member.connect();
  }

  function disconnect() {
    return member.disconnect();
  }

  function submit(opts: SubmitOptions) {
    return member.submit(opts);
  }

  function doing(handler: TaskHandler) {
    member.doing(async (clientTask) => {
      syncState();
      try {
        return await handler(clientTask);
      } finally {
        syncState();
      }
    });
  }

  function onTask(callback: (task: unknown) => void) {
    member.on("task", callback);
  }

  onUnmounted(() => {
    member.disconnect();
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
