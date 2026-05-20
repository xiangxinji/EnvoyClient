import { ref } from "vue";

export function useConfirm() {
  const confirmVisible = ref(false);
  const confirmTitle = ref("");
  const confirmMessage = ref("");
  const confirmDanger = ref(false);
  const pendingAction = ref<(() => void) | null>(null);

  function showConfirm(title: string, message: string, action: () => void, danger = false) {
    confirmTitle.value = title;
    confirmMessage.value = message;
    confirmDanger.value = danger;
    pendingAction.value = action;
    confirmVisible.value = true;
  }

  function handleConfirm() {
    confirmVisible.value = false;
    pendingAction.value?.();
    pendingAction.value = null;
  }

  function handleCancel() {
    confirmVisible.value = false;
    pendingAction.value = null;
  }

  return {
    confirmVisible,
    confirmTitle,
    confirmMessage,
    confirmDanger,
    showConfirm,
    handleConfirm,
    handleCancel,
  };
}
