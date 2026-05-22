<script setup lang="ts">
import { ref, onMounted, computed, watch } from "vue";
import { useI18n } from "vue-i18n";
import { getTeamClientInstance, getCloudResourceService } from "../../composables/teamClientContext";
import { useToast } from "../../composables/useToast";
import { useConfirm } from "../../composables/useConfirm";
import type { CloudFileItem } from "../../services/types";
import { downloadFileWithDialog } from "../../utils/notification";
import { getErrorMessage } from "../../utils/error";
import { formatFileSize } from "../../utils/taskFormatters";
import { pickFiles } from "../../utils/filePicker";
import { getFileCategory } from "../../utils/fileCategories";
import FileIcon from "../FileIcon";
import ConfirmDialog from "../ConfirmDialog";
import Toast from "../Toast";
import SvgIcon from "../SvgIcon";
import GlassInput from "../GlassInput";
import GlassButton from "../GlassButton";

const { t } = useI18n();
const ctx = getTeamClientInstance()!;
const cloudService = getCloudResourceService();

const { toastVisible, toastMessage, toastType, showToast, hideToast } = useToast();
const { confirmVisible, confirmTitle, confirmMessage, confirmDanger, showConfirm, handleConfirm, handleCancel } = useConfirm();

const currentPath = ref("");
const items = ref<CloudFileItem[]>([]);
const loading = ref(false);
const uploadProgress = ref<number | null>(null);
const showNewDirDialog = ref(false);
const newDirName = ref("");
const selectMode = ref(false);
const selectedIds = ref<Set<string>>(new Set());

const dirDialogShow = ref(false);
watch(showNewDirDialog, (val) => {
  if (val) requestAnimationFrame(() => { dirDialogShow.value = true; });
  else dirDialogShow.value = false;
});

const isLeader = computed(() => ctx.role === "leader");
const selectedItems = computed(() => items.value.filter(i => selectedIds.value.has(i.id)));

function toggleSelect(item: CloudFileItem) {
  const s = new Set(selectedIds.value);
  if (s.has(item.id)) s.delete(item.id); else s.add(item.id);
  selectedIds.value = s;
}

function exitSelectMode() {
  selectMode.value = false;
  selectedIds.value = new Set();
}

// ─── Breadcrumb ────────────────────────────────────────────────

interface Breadcrumb { label: string; path: string }

const breadcrumbs = computed<Breadcrumb[]>(() => {
  if (!currentPath.value) return [];
  const parts = currentPath.value.split("/").filter(Boolean);
  const crumbs: Breadcrumb[] = [];
  let acc = "";
  for (const part of parts) { acc += part + "/"; crumbs.push({ label: part, path: acc }); }
  return crumbs;
});

// ─── Core actions ──────────────────────────────────────────────

async function loadFiles() {
  loading.value = true;
  try {
    const result = await cloudService.listFiles(currentPath.value);
    items.value = result.items;
  } catch { items.value = []; }
  finally { loading.value = false; }
}

function navigateTo(path: string) {
  currentPath.value = path;
  exitSelectMode();
  loadFiles();
}

function enterDir(item: CloudFileItem) {
  if (item.type !== "directory") return;
  navigateTo(currentPath.value + item.name + "/");
}

async function handleUpload() {
  const files = await pickFiles();
  const file = files[0];
  if (!file) return;
  uploadProgress.value = 0;
  try {
    await cloudService.uploadFile(file, currentPath.value, pct => { uploadProgress.value = pct; });
    await loadFiles();
  } catch (e: unknown) { showToast(getErrorMessage(e) || t("common.uploadFailed"), "error"); }
  finally { uploadProgress.value = null; }
}

async function confirmNewDir() {
  const name = newDirName.value.trim();
  if (!name) return;
  dirDialogShow.value = false;
  setTimeout(async () => {
    showNewDirDialog.value = false;
    try {
      await cloudService.createDirectory(name, currentPath.value);
      await loadFiles();
    } catch (e: unknown) { showToast(getErrorMessage(e) || t("common.operationFailed"), "error"); }
  }, 200);
}

function closeDirDialog() {
  dirDialogShow.value = false;
  setTimeout(() => { showNewDirDialog.value = false; }, 200);
}

function requestDeleteSingle(item: CloudFileItem) {
  const msg = item.type === "directory"
    ? t("cloud.confirmDeleteDir", { name: item.name })
    : t("cloud.confirmDeleteFile", { name: item.name });
  showConfirm(t("common.delete"), msg, () => performDelete([item]), true);
}

function requestBatchDelete() {
  const count = selectedItems.value.length;
  const msg = t("cloud.confirmBatchDelete", { count });
  showConfirm(t("common.delete"), msg, () => performDelete([...selectedItems.value]), true);
}

async function performDelete(targets: CloudFileItem[]) {
  for (const item of targets) {
    const filePath = item.type === "directory" ? currentPath.value + item.name + "/" : currentPath.value + item.name;
    try { await cloudService.deleteFile(filePath); }
    catch (e: unknown) { showToast(getErrorMessage(e) || t("common.operationFailed"), "error"); break; }
  }
  exitSelectMode();
  await loadFiles();
}

async function handleDownload(item: CloudFileItem) {
  try {
    const url = cloudService.downloadUrl(currentPath.value + item.name);
    await downloadFileWithDialog(url, item.name, { team: ctx.teamName });
  } catch (e: unknown) { showToast(getErrorMessage(e) || t("common.fileDownloadFailed"), "error"); }
}

onMounted(loadFiles);
</script>

<template>
  <div class="cloud-panel">
    <div class="cloud-header">
      <span class="header-name">{{ t('cloud.title') }}</span>
    </div>

    <div class="cloud-toolbar">
      <div class="breadcrumb">
        <button class="breadcrumb-btn root-btn" :class="{ current: !currentPath }" @click="navigateTo('')">
          <SvgIcon name="home" :size="14" />
        </button>
        <template v-for="(crumb, idx) in breadcrumbs" :key="idx">
          <span class="breadcrumb-sep">/</span>
          <button class="breadcrumb-btn" :class="{ current: idx === breadcrumbs.length - 1 }" @click="navigateTo(crumb.path)">{{ crumb.label }}</button>
        </template>
      </div>
      <div class="toolbar-actions">
        <button v-if="isLeader && !selectMode" class="action-btn" @click="selectMode = true">
          <SvgIcon name="check-square" :size="14" />
          {{ t('cloud.select') }}
        </button>
        <button v-if="selectMode" class="action-btn" @click="exitSelectMode">{{ t('common.cancel') }}</button>
        <button class="action-btn" :disabled="uploadProgress !== null" @click="handleUpload">
          <SvgIcon name="upload" :size="14" />
          {{ uploadProgress !== null ? `${uploadProgress}%` : t('cloud.upload') }}
        </button>
        <button class="action-btn" @click="newDirName = ''; showNewDirDialog = true">
          <SvgIcon name="folder-plus" :size="14" />
          {{ t('cloud.createDir') }}
        </button>
      </div>
    </div>

    <div v-if="uploadProgress !== null" class="upload-progress">
      <div class="upload-progress-bar" :style="{ width: uploadProgress + '%' }"></div>
    </div>

    <!-- Batch action bar -->
    <div v-if="selectMode && selectedItems.length > 0" class="batch-bar">
      <span class="batch-count">{{ t('cloud.selectedCount', { count: selectedItems.length }) }}</span>
      <button class="batch-delete-btn" @click="requestBatchDelete">{{ t('common.delete') }}</button>
    </div>

    <div class="cloud-content">
      <div v-if="loading" class="cloud-empty">{{ t('common.loading') }}</div>
      <div v-else-if="items.length === 0" class="cloud-empty">{{ t('cloud.empty') }}</div>
      <table v-else class="cloud-table">
        <thead>
          <tr>
            <th v-if="selectMode" class="col-check"></th>
            <th class="col-name">{{ t('cloud.colName') }}</th>
            <th class="col-size">{{ t('cloud.colSize') }}</th>
            <th class="col-uploader">{{ t('cloud.colUploader') }}</th>
            <th class="col-time">{{ t('cloud.colTime') }}</th>
            <th v-if="!selectMode" class="col-actions"></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in items" :key="item.id" class="file-row" :class="{ selected: selectedIds.has(item.id) }">
            <td v-if="selectMode" class="col-check" @click="toggleSelect(item)">
              <div class="checkbox" :class="{ checked: selectedIds.has(item.id) }">
                <SvgIcon v-if="selectedIds.has(item.id)" name="check" :size="12" />
              </div>
            </td>
            <td class="col-name" @click="selectMode ? toggleSelect(item) : (item.type === 'directory' ? enterDir(item) : undefined)" :class="{ clickable: selectMode || item.type === 'directory' }">
              <FileIcon :category="getFileCategory(item.name, item.type)" />
              <span>{{ item.name }}</span>
            </td>
            <td class="col-size">{{ item.type === 'file' ? formatFileSize(item.size) : '-' }}</td>
            <td class="col-uploader">{{ item.uploadedBy }}</td>
            <td class="col-time">{{ new Date(item.createdAt).toLocaleString() }}</td>
            <td v-if="!selectMode" class="col-actions">
              <button v-if="item.type === 'file'" class="icon-btn" :title="t('cloud.download')" @click="handleDownload(item)">
                <SvgIcon name="download" :size="14" />
              </button>
              <button v-if="isLeader" class="icon-btn danger" :title="t('common.delete')" @click="requestDeleteSingle(item)">
                <SvgIcon name="trash" :size="14" />
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- New directory dialog -->
    <Teleport to="body">
      <div v-if="showNewDirDialog" class="dir-overlay" :class="{ active: dirDialogShow }" @click.self="closeDirDialog">
        <div class="dir-dialog" @click.stop>
          <h3>{{ t('cloud.createDir') }}</h3>
          <GlassInput v-model="newDirName" :placeholder="t('cloud.createDirPrompt')" bordered @keydown.enter="confirmNewDir" @keydown.escape="closeDirDialog" />
          <div class="dir-actions">
            <GlassButton variant="default" @click="closeDirDialog">{{ t('common.cancel') }}</GlassButton>
            <GlassButton variant="primary" :disabled="!newDirName.trim()" @click="confirmNewDir">{{ t('common.confirm') }}</GlassButton>
          </div>
        </div>
      </div>
    </Teleport>

    <ConfirmDialog
      :visible="confirmVisible"
      :title="confirmTitle"
      :message="confirmMessage"
      :danger="confirmDanger"
      @confirm="handleConfirm"
      @cancel="handleCancel"
    />

    <Toast :visible="toastVisible" :message="toastMessage" :type="toastType" @done="hideToast" />
  </div>
</template>

<style scoped>
@import './styles.css';
</style>
