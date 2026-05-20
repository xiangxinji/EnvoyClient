<script setup lang="ts">
import { ref, onMounted, inject, computed } from "vue";
import { useI18n } from "vue-i18n";
import { TeamClientKey } from "../../composables/teamClientContext";
import { useToast } from "../../composables/useToast";
import {
  listCloudFiles, uploadCloudFile, createCloudDirectory, deleteCloudFile, cloudDownloadUrl,
  type CloudFileItem,
} from "../../api";
import { downloadFileWithDialog } from "../../utils/notification";
import { getErrorMessage } from "../../utils/error";
import { formatFileSize } from "../../utils/taskFormatters";
import { pickFiles } from "../../utils/filePicker";
import { getFileCategory } from "../../utils/fileCategories";
import FileIcon from "../FileIcon";
import Toast from "../Toast";
import SvgIcon from "../SvgIcon";

const { t } = useI18n();
const ctx = inject(TeamClientKey)!;

const { toastVisible, toastMessage, toastType, showToast, hideToast } = useToast();

const currentPath = ref("");
const items = ref<CloudFileItem[]>([]);
const loading = ref(false);
const uploadProgress = ref<number | null>(null);
const showNewDirDialog = ref(false);
const newDirName = ref("");
const deleteConfirm = ref<{ items: CloudFileItem[]; msg: string } | null>(null);
const selectMode = ref(false);
const selectedIds = ref<Set<string>>(new Set());

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
    const result = await listCloudFiles(ctx.teamName, currentPath.value);
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
    await uploadCloudFile(ctx.teamName, file, currentPath.value, ctx.myId, pct => { uploadProgress.value = pct; });
    await loadFiles();
  } catch (e: unknown) { showToast(getErrorMessage(e) || t("common.uploadFailed"), "error"); }
  finally { uploadProgress.value = null; }
}

async function confirmNewDir() {
  const name = newDirName.value.trim();
  if (!name) return;
  showNewDirDialog.value = false;
  try {
    await createCloudDirectory(ctx.teamName, name, currentPath.value, ctx.myId);
    await loadFiles();
  } catch (e: unknown) { showToast(getErrorMessage(e) || t("common.operationFailed"), "error"); }
}

function requestDeleteSingle(item: CloudFileItem) {
  const msg = item.type === "directory"
    ? t("cloud.confirmDeleteDir", { name: item.name })
    : t("cloud.confirmDeleteFile", { name: item.name });
  deleteConfirm.value = { items: [item], msg };
}

function requestBatchDelete() {
  const count = selectedItems.value.length;
  deleteConfirm.value = { items: [...selectedItems.value], msg: t("cloud.confirmBatchDelete", { count }) };
}

async function confirmDelete() {
  if (!deleteConfirm.value) return;
  const targets = deleteConfirm.value.items;
  deleteConfirm.value = null;
  for (const item of targets) {
    const filePath = item.type === "directory" ? currentPath.value + item.name + "/" : currentPath.value + item.name;
    try { await deleteCloudFile(ctx.teamName, filePath, ctx.myId); }
    catch (e: unknown) { showToast(getErrorMessage(e) || t("common.operationFailed"), "error"); break; }
  }
  exitSelectMode();
  await loadFiles();
}

async function handleDownload(item: CloudFileItem) {
  try {
    const url = cloudDownloadUrl(ctx.teamName, currentPath.value + item.name);
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
    <div v-if="showNewDirDialog" class="dialog-overlay" @click.self="showNewDirDialog = false">
      <div class="dialog">
        <h3>{{ t('cloud.createDir') }}</h3>
        <input v-model="newDirName" class="dialog-input" :placeholder="t('cloud.createDirPrompt')" autofocus @keyup.enter="confirmNewDir" @keyup.escape="showNewDirDialog = false" />
        <div class="dialog-actions">
          <button class="dialog-btn cancel" @click="showNewDirDialog = false">{{ t('common.cancel') }}</button>
          <button class="dialog-btn confirm" :disabled="!newDirName.trim()" @click="confirmNewDir">{{ t('common.confirm') }}</button>
        </div>
      </div>
    </div>

    <!-- Delete confirmation dialog -->
    <div v-if="deleteConfirm" class="dialog-overlay" @click.self="deleteConfirm = null">
      <div class="dialog">
        <h3>{{ t('common.delete') }}</h3>
        <p class="dialog-msg">{{ deleteConfirm.msg }}</p>
        <div class="dialog-actions">
          <button class="dialog-btn cancel" @click="deleteConfirm = null">{{ t('common.cancel') }}</button>
          <button class="dialog-btn danger" @click="confirmDelete">{{ t('common.delete') }}</button>
        </div>
      </div>
    </div>

    <Toast :visible="toastVisible" :message="toastMessage" :type="toastType" @done="hideToast" />
  </div>
</template>

<style scoped>
@import './styles.css';
</style>
