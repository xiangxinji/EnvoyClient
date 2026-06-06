import { i18n } from "../i18n";
import { sendDesktopNotification } from "../utils/notification";
import type { Task } from "../../envoy/packages/core/task.js";
import type { Ref } from "vue";

export function useTeamClientNotifications(deps: {
  myId: string;
  memberSettings: Ref<{ brains_sync_triggers: string[] }>;
  onBrainsSyncTask?: (task: Task) => void;
}) {
  const prevTaskStatus = new Map<string, string>();

  function handleTaskNotification(task: Task) {
    const prev = prevTaskStatus.get(task.id);
    prevTaskStatus.set(task.id, task.status);

    // Skip notification if no previous status (first load) or status unchanged
    if (!prev || prev === task.status) return;

    const content = task.content.length > 30 ? task.content.slice(0, 30) + "..." : task.content;
    const { myId } = deps;

    switch (task.status) {
      case "running": {
        const isSubscriber = task.subscribe.includes(myId);
        if (isSubscriber && prev === "pending") {
          sendDesktopNotification(i18n.global.t('notification.newTask'), content);
        }
        break;
      }
      case "completed": {
        const isRelevant = task.createBy === myId || task.subscribe.includes(myId);
        if (isRelevant) {
          sendDesktopNotification(i18n.global.t('notification.taskCompleted'), content);
        }
        // Trigger brains sync if after_task is enabled and user is a subscriber
        if (task.subscribe.includes(myId) && deps.memberSettings.value.brains_sync_triggers.includes("after_task")) {
          deps.onBrainsSyncTask?.(task);
        }
        break;
      }
      case "failed": {
        const isRelevant = task.createBy === myId || task.subscribe.includes(myId);
        if (isRelevant) {
          sendDesktopNotification(i18n.global.t('notification.taskFailed'), content);
        }
        break;
      }
      case "reviewing": {
        if (task.createBy === myId) {
          sendDesktopNotification(i18n.global.t('notification.taskReviewing'), content);
        }
        break;
      }
    }
  }

  return { handleTaskNotification };
}
