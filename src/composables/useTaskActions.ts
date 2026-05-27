import { computed, ref, type Ref } from "vue";
import { downloadFileWithDialog } from "../utils/notification";
import { useToast } from "./useToast";
import { useConfirm } from "./useConfirm";
import { useI18n } from "vue-i18n";
import type { TaskResource } from "../types";
import { getTaskService } from "./teamClientContext";
import { pickFiles } from "../utils/filePicker";

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
  existingClientResults?: Ref<TaskResource[]>,
) {
  const { t } = useI18n();
  const { showToast, ...toastRest } = useToast();
  const { confirmVisible, confirmTitle, confirmMessage, confirmDanger, showConfirm, handleConfirm, handleCancel } = useConfirm();

  const clientResults = existingClientResults ?? computed(() => resources.value.filter(r => r.type === "client-result"));

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

  async function runAction(loading: Ref<boolean>, action: () => Promise<void>, onSuccess?: () => void) {
    if (loading.value) return;
    loading.value = true;
    try {
      await action();
      onSuccess?.();
    } catch {
      showToast(t('common.operationFailed'), "error");
    }
    loading.value = false;
  }

  async function handleStart(onSuccess?: () => void) {
    await runAction(starting, () => getTaskService().start(taskId.value), onSuccess);
  }

  function requestComplete(onSuccess?: () => void) {
    showConfirm(t('task.confirmComplete'), t('task.confirmCompleteMsg'), () => doComplete(onSuccess));
  }

  async function doComplete(onSuccess?: () => void) {
    await runAction(completing, () =>
      getTaskService().submitResult(taskId.value, { from: myId ?? "", success: true, data: { note: t('task.manualComplete'), source: "manual" } }),
      onSuccess,
    );
  }

  function requestApprove(onSuccess?: () => void) {
    showConfirm(t('task.confirmApprove'), t('task.confirmApproveMsg'), () => doApprove(onSuccess));
  }

  async function doApprove(onSuccess?: () => void) {
    await runAction(reviewing, () =>
      getTaskService().submitResult(taskId.value, { from: myId ?? "", success: true, data: { review: t('task.approved'), source: "manual" } }),
      () => { onSuccess?.(); showToast(t('task.reviewApproved'), "success"); },
    );
  }

  function requestReject(onSuccess?: () => void) {
    showConfirm(t('task.confirmReject'), t('task.confirmRejectMsg'), () => doReject(onSuccess), true);
  }

  async function doReject(onSuccess?: () => void) {
    await runAction(reviewing, () =>
      getTaskService().submitResult(taskId.value, { from: myId ?? "", success: false, error: t('task.reviewFailed') }),
      () => { onSuccess?.(); showToast(t('task.taskRejected'), "info"); },
    );
  }

  async function handleUpload(onSuccess?: () => void) {
    const files = await pickFiles();
    const file = files[0];
    if (!file) return;
    uploading.value = true;
    try {
      await getTaskService().uploadResource(taskId.value, file);
      onSuccess?.();
    } catch {
      showToast(t('common.fileUploadFailed'), "error");
    }
    uploading.value = false;
  }

  const downloading = ref("");

  async function downloadFile(filename: string) {
    if (downloading.value) return;
    downloading.value = filename;
    try {
      const url = getTaskService().downloadResourceUrl(taskId.value, filename);
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
