import { computed } from "vue";
import type { ComputedRef } from "vue";
import { useI18n } from "vue-i18n";
import type { TaskResource, TaskMessage, LeaderReviewData, FileResourceData } from "../types";
import type { TypedTaskResource } from "./useTaskResources";

export interface TimelineEvent {
  time: number | undefined;
  label: string;
  by: string;
  icon: "create" | "result" | "review" | "file";
  success?: boolean;
}

export function useTaskTimeline(deps: {
  liveTask: ComputedRef<TaskMessage>;
  clientResults: ComputedRef<TaskResource[]>;
  leaderReviews: ComputedRef<TypedTaskResource<LeaderReviewData>[]>;
  fileResources: ComputedRef<TypedTaskResource<FileResourceData>[]>;
}) {
  const { t } = useI18n();
  const { liveTask, clientResults, leaderReviews, fileResources } = deps;

  const timelineEvents = computed<TimelineEvent[]>(() => {
    const events: TimelineEvent[] = [];

    events.push({
      time: liveTask.value.timestamp,
      label: t('task.createTask'),
      by: liveTask.value.from,
      icon: "create",
    });

    for (const r of clientResults.value) {
      events.push({ time: r.timestamp, label: t('task.executionDone'), by: r.by, icon: "result" });
    }

    for (const r of leaderReviews.value) {
      const success = r.data?.success;
      events.push({ time: r.timestamp, label: success ? t('task.reviewApprovedLabel') : t('task.reviewRejectedLabel'), by: r.by, icon: "review", success });
    }

    for (const r of fileResources.value) {
      events.push({ time: r.timestamp, label: t('task.uploadFile'), by: r.by, icon: "file" });
    }

    events.sort((a, b) => {
      if (a.time !== undefined && b.time !== undefined) return a.time - b.time;
      if (a.time !== undefined) return -1;
      if (b.time !== undefined) return 1;
      return 0;
    });

    return events;
  });

  const duration = computed<string | null>(() => {
    if (!liveTask.value.timestamp) return null;
    const lastTs = timelineEvents.value.filter((e) => e.time !== undefined).pop()?.time;
    if (!lastTs) return null;
    const diff = lastTs - liveTask.value.timestamp;
    if (diff <= 0) return null;
    const minutes = Math.floor(diff / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);
    if (minutes > 0) return `${minutes}m ${seconds}s`;
    return `${seconds}s`;
  });

  return { timelineEvents, duration };
}
