import { computed } from "vue";

export function useTaskPermissions(
  subscribe: { value: string[] | undefined },
  from: { value: string },
  myId: string | undefined,
  status: { value: string },
) {
  const isAssignedToMe = computed(() =>
    myId && (subscribe.value ?? []).includes(myId)
  );

  const isCreatedByMe = computed(() =>
    myId && from.value === myId
  );

  const canStart = computed(() => isAssignedToMe.value && status.value === "pending");
  const canComplete = computed(() => isAssignedToMe.value && status.value === "running");
  const canUpload = computed(() => isAssignedToMe.value && (status.value === "running" || status.value === "pending"));
  const canReview = computed(() => isCreatedByMe.value && status.value === "reviewing");

  return { isAssignedToMe, isCreatedByMe, canStart, canComplete, canUpload, canReview };
}
