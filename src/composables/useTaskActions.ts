import { computed, ref, type Ref } from "vue";
import { managerPost, apiUrl } from "../api";
import { downloadFileWithDialog } from "../utils/notification";
import { getTaskFileUrl } from "../utils/taskFormatters";
import { useToast } from "./useToast";
import { useConfirm } from "./useConfirm";
import { useI18n } from "vue-i18n";
import type { TaskResource } from "../types";

interface MemberEntry {
  id: string;
  hasResult: boolean;
}

export function useTaskActions(
  taskId: Ref<string>,
  subscribe: Ref<string[] | undefined>,
  resources: Ref<TaskResource[]>,
  myId: string | undefined,
  teamName: string | undefined,
) {
  const { t } = useI18n();
  const { showToast, ...toastRest } = useToast();
  const { confirmVisible, confirmTitle, confirmMessage, confirmDanger, showConfirm, handleConfirm, handleCancel } = useConfirm();

  const clientResults = computed(() => resources.value.filter(r => r.type === "client-result"));

  const memberEntries = computed<MemberEntry[]>(() => {
    const resultMemberIds = new Set(clientResults.value.map(r => r.by));
    if (clientResults.value.length > 0) {
      const entries: MemberEntry[] = clientResults.value.map(r => ({ id: r.by, hasResult: true }));
      for (const id of subscribe.value ?? []) {
        if (!resultMemberIds.has(id)) entries.push({ id, hasResult: false });
      }
      return entries;
    }
    if (subscribe.value?.length) {
      return subscribe.value.map(id => ({ id, hasResult: false }));
    }
    return [];
  });

  const starting = ref(false);
  const completing = ref(false);
  const uploading = ref(false);
  const reviewing = ref(false);

  async function handleStart(onSuccess?: () => void) {
    if (starting.value) return;
    starting.value = true;
    try {
      const res = await managerPost(`/api/tasks/${taskId.value}/start`, { from: myId }, { team: teamName ?? "" });
      if (res.ok) onSuccess?.();
      else showToast(t('common.operationFailed'), "error");
    } catch {
      showToast(t('common.operationFailed'), "error");
    }
    starting.value = false;
  }

  function requestComplete(onSuccess?: () => void) {
    showConfirm(t('task.confirmComplete'), t('task.confirmCompleteMsg'), () => doComplete(onSuccess));
  }

  async function doComplete(onSuccess?: () => void) {
    if (completing.value) return;
    completing.value = true;
    try {
      const res = await managerPost(`/api/tasks/${taskId.value}/complete`, { from: myId, data: { note: t('task.manualComplete'), source: "manual" } }, { team: teamName ?? "" });
      if (res.ok) onSuccess?.();
      else showToast(t('common.operationFailed'), "error");
    } catch {
      showToast(t('common.operationFailed'), "error");
    }
    completing.value = false;
  }

  function requestApprove(onSuccess?: () => void) {
    showConfirm(t('task.confirmApprove'), t('task.confirmApproveMsg'), () => doApprove(onSuccess));
  }

  async function doApprove(onSuccess?: () => void) {
    if (reviewing.value) return;
    reviewing.value = true;
    try {
      const res = await managerPost(`/api/tasks/${taskId.value}/result`, {
        from: myId,
        success: true,
        data: { review: t('task.approved'), source: "manual" },
      }, { team: teamName ?? "" });
      if (res.ok) {
        onSuccess?.();
        showToast(t('task.reviewApproved'), "success");
      } else {
        showToast(t('common.operationFailed'), "error");
      }
    } catch {
      showToast(t('common.operationFailed'), "error");
    }
    reviewing.value = false;
  }

  function requestReject(onSuccess?: () => void) {
    showConfirm(t('task.confirmReject'), t('task.confirmRejectMsg'), () => doReject(onSuccess), true);
  }

  async function doReject(onSuccess?: () => void) {
    if (reviewing.value) return;
    reviewing.value = true;
    try {
      const res = await managerPost(`/api/tasks/${taskId.value}/result`, {
        from: myId,
        success: false,
        error: t('task.reviewFailed'),
      }, { team: teamName ?? "" });
      if (res.ok) {
        onSuccess?.();
        showToast(t('task.taskRejected'), "info");
      } else {
        showToast(t('common.operationFailed'), "error");
      }
    } catch {
      showToast(t('common.operationFailed'), "error");
    }
    reviewing.value = false;
  }

  async function handleUpload(onSuccess?: () => void) {
    const input = document.createElement("input");
    input.type = "file";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      uploading.value = true;
      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("from", myId ?? "");
        const res = await fetch(apiUrl(`/api/tasks/${taskId.value}/resources`), {
          method: "POST",
          headers: { team: teamName ?? "" },
          body: formData,
        });
        if (!res.ok) throw new Error(t('common.uploadFailed'));
        onSuccess?.();
      } catch {
        showToast(t('common.fileUploadFailed'), "error");
      }
      uploading.value = false;
    };
    input.click();
  }

  const downloading = ref("");

  async function downloadFile(filename: string) {
    if (downloading.value) return;
    downloading.value = filename;
    try {
      const url = getTaskFileUrl(taskId.value, filename);
      await downloadFileWithDialog(url, filename, { team: teamName ?? "" });
    } catch {
      showToast(t('common.fileDownloadFailed'), "error");
    } finally {
      downloading.value = "";
    }
  }

  return {
    memberEntries,
    starting,
    completing,
    uploading,
    reviewing,
    downloading,
    toastVisible: toastRest.toastVisible,
    toastMessage: toastRest.toastMessage,
    toastType: toastRest.toastType,
    hideToast: toastRest.hideToast,
    confirmVisible,
    confirmTitle,
    confirmMessage,
    confirmDanger,
    handleConfirm,
    handleCancel,
    handleStart,
    requestComplete,
    doComplete,
    requestApprove,
    doApprove,
    requestReject,
    doReject,
    handleUpload,
    downloadFile,
  };
}
