import { ref } from "vue";

export type ToastType = "success" | "error" | "info";

export function useToast() {
  const toastVisible = ref(false);
  const toastMessage = ref("");
  const toastType = ref<ToastType>("info");

  function showToast(message: string, type: ToastType = "info") {
    toastMessage.value = message;
    toastType.value = type;
    toastVisible.value = true;
  }

  function hideToast() {
    toastVisible.value = false;
  }

  return {
    toastVisible,
    toastMessage,
    toastType,
    showToast,
    hideToast,
  };
}
