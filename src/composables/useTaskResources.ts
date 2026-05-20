import { computed } from "vue";
import type { TaskResource, FileResourceData, LeaderReviewData } from "../types";

export interface TypedTaskResource<T> extends Omit<TaskResource, "data"> {
  data: T;
}

export function useTaskResources(resources: { value: TaskResource[] }) {
  const clientResults = computed<TaskResource[]>(() =>
    resources.value.filter((r) => r.type === "client-result")
  );

  const fileResources = computed<TypedTaskResource<FileResourceData>[]>(() =>
    resources.value.filter((r) => r.type === "file-resource") as TypedTaskResource<FileResourceData>[]
  );

  const traceResources = computed<TaskResource[]>(() =>
    resources.value.filter((r) => r.type === "execution-trace")
  );

  const leaderReviews = computed<TypedTaskResource<LeaderReviewData>[]>(() =>
    resources.value.filter((r) => r.type === "leader-review") as TypedTaskResource<LeaderReviewData>[]
  );

  const traceByMember = computed(() => {
    const map = new Map<string, boolean>();
    for (const r of traceResources.value) map.set(r.by, true);
    return map;
  });

  function isAIExecuted(res: TaskResource): boolean {
    const data = res.data as Record<string, unknown> | undefined;
    if (data?.source === "ai") return true;
    return traceByMember.value.has(res.by);
  }

  function isAIReview(review: TaskResource): boolean {
    const data = review.data as Record<string, unknown> | undefined;
    const inner = data?.data as Record<string, unknown> | undefined;
    if (inner?.source === "ai") return true;
    return false;
  }

  return {
    clientResults,
    fileResources,
    traceResources,
    leaderReviews,
    traceByMember,
    isAIExecuted,
    isAIReview,
  };
}
