import { ref, computed, onMounted, watch, nextTick } from "vue";
import { useEventListener } from "@vueuse/core";
import { getTeamClientInstance, getCloudResourceService } from "../composables/teamClientContext";
import { useToast } from "./useToast";
import { useConfirm } from "./useConfirm";
import type { CloudFileItem } from "../services/types";
import { getErrorMessage } from "../utils/error";
import { downloadFileWithDialog } from "../utils/notification";
import { pickFiles } from "../utils/filePicker";

interface Breadcrumb { id: string | null; label: string }

export function useCloudFiles() {
  const ctx = getTeamClientInstance()!;
  const cloudService = getCloudResourceService();
  const { showToast, ...toastRest } = useToast();
  const { showConfirm, ...confirmRest } = useConfirm();

  const currentDirId = ref<string | null>(null);
  const items = ref<CloudFileItem[]>([]);
  const loading = ref(false);
  const uploadProgress = ref<number | null>(null);
  const breadcrumbs = ref<Breadcrumb[]>([]);

  const selectMode = ref(false);
  const selectedIds = ref<Set<string>>(new Set());
  const selectedItems = computed(() => items.value.filter(i => selectedIds.value.has(i.id)));
  const isLeader = computed(() => ctx.role === "leader");

  // New directory dialog state
  const showNewDirDialog = ref(false);
  const newDirName = ref("");
  const newDirInputRef = ref<InstanceType<typeof import("../components/GlassInput").default> | null>(null);

  watch(showNewDirDialog, (val) => {
    if (val) nextTick(() => { newDirInputRef.value?.focus(); });
  });

  useEventListener("keydown", (e) => {
    if (e.key === "Escape" && showNewDirDialog.value) showNewDirDialog.value = false;
  });

  function toggleSelect(item: CloudFileItem) {
    const s = new Set(selectedIds.value);
    if (s.has(item.id)) s.delete(item.id); else s.add(item.id);
    selectedIds.value = s;
  }

  function exitSelectMode() {
    selectMode.value = false;
    selectedIds.value = new Set();
  }

  async function loadFiles() {
    loading.value = true;
    try {
      const result = await cloudService.listFiles(currentDirId.value);
      items.value = result.items;
      if (currentDirId.value === null) {
        breadcrumbs.value = [];
      } else {
        const chain = await cloudService.getBreadcrumb(currentDirId.value);
        breadcrumbs.value = chain.map(b => ({ id: b.id, label: b.name }));
      }
    } catch { items.value = []; }
    finally { loading.value = false; }
  }

  function navigateTo(dirId: string | null) {
    currentDirId.value = dirId;
    exitSelectMode();
    loadFiles();
  }

  function enterDir(item: CloudFileItem) {
    if (item.type !== "directory") return;
    currentDirId.value = item.id;
    exitSelectMode();
    loadFiles();
  }

  async function handleUpload() {
    const files = await pickFiles();
    const file = files[0];
    if (!file) return;
    uploadProgress.value = 0;
    try {
      await cloudService.uploadFile(file, currentDirId.value, pct => { uploadProgress.value = pct; });
      await loadFiles();
    } catch (e: unknown) { showToast(getErrorMessage(e) || "上传失败", "error"); }
    finally { uploadProgress.value = null; }
  }

  async function confirmNewDir() {
    const name = newDirName.value.trim();
    if (!name) return;
    showNewDirDialog.value = false;
    try {
      await cloudService.createDirectory(name, currentDirId.value);
      await loadFiles();
    } catch (e: unknown) { showToast(getErrorMessage(e) || "操作失败", "error"); }
  }

  function requestDeleteSingle(item: CloudFileItem, t: (key: string) => string) {
    const msg = item.type === "directory"
      ? t("cloud.confirmDeleteDir").replace("{name}", item.name)
      : t("cloud.confirmDeleteFile").replace("{name}", item.name);
    showConfirm(t("common.delete"), msg, () => performDelete([item]), true);
  }

  function requestBatchDelete(t: (key: string) => string) {
    const count = selectedItems.value.length;
    const msg = t("cloud.confirmBatchDelete").replace("{count}", String(count));
    showConfirm(t("common.delete"), msg, () => performDelete([...selectedItems.value]), true);
  }

  async function performDelete(targets: CloudFileItem[]) {
    for (const item of targets) {
      try { await cloudService.deleteFile(item.id); }
      catch (e: unknown) { showToast(getErrorMessage(e) || "操作失败", "error"); break; }
    }
    exitSelectMode();
    await loadFiles();
  }

  async function handleDownload(item: CloudFileItem, t: (key: string) => string) {
    try {
      const url = cloudService.downloadUrl(item.id);
      await downloadFileWithDialog(url, item.name, { team: ctx.teamName });
    } catch (e: unknown) { showToast(getErrorMessage(e) || t("common.fileDownloadFailed"), "error"); }
  }

  onMounted(loadFiles);

  return {
    currentDirId, items, loading, uploadProgress, breadcrumbs,
    selectMode, selectedIds, selectedItems, isLeader,
    showNewDirDialog, newDirName, newDirInputRef,
    navigateTo, enterDir, toggleSelect, exitSelectMode,
    handleUpload, confirmNewDir, requestDeleteSingle, requestBatchDelete, handleDownload,
    loadFiles,
    ...confirmRest,
    ...toastRest,
  };
}
