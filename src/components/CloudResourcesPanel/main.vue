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
import { getFileCategory } from "../../utils/fileCategories";
import FileIcon from "../FileIcon";
import Toast from "../Toast";

const { t } = useI18n();
const ctx = inject(TeamClientKey)!;

const { toastVisible, toastMessage, toastType, showToast, hideToast } = useToast();

function showError(msg: string) {
  showToast(msg, "error");
}

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
  const input = document.createElement("input");
  input.type = "file";
  input.onchange = async () => {
    const file = input.files?.[0];
    if (!file) return;
    uploadProgress.value = 0;
    try {
      await uploadCloudFile(ctx.teamName, file, currentPath.value, ctx.myId, pct => { uploadProgress.value = pct; });
      await loadFiles();
    } catch (e: unknown) { showError(e instanceof Error ? e.message : t("common.uploadFailed")); }
    finally { uploadProgress.value = null; }
  };
  input.click();
}

async function confirmNewDir() {
  const name = newDirName.value.trim();
  if (!name) return;
  showNewDirDialog.value = false;
  try {
    await createCloudDirectory(ctx.teamName, name, currentPath.value, ctx.myId);
    await loadFiles();
  } catch (e: unknown) { showError(e instanceof Error ? e.message : t("common.operationFailed")); }
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
    catch (e: unknown) { showError(e instanceof Error ? e.message : t("common.operationFailed")); break; }
  }
  exitSelectMode();
  await loadFiles();
}

async function handleDownload(item: CloudFileItem) {
  try {
    const url = cloudDownloadUrl(ctx.teamName, currentPath.value + item.name);
    await downloadFileWithDialog(url, item.name, { team: ctx.teamName });
  } catch (e: unknown) { showError(e instanceof Error ? e.message : t("common.fileDownloadFailed")); }
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
  if (bytes < 1073741824) return (bytes / 1048576).toFixed(1) + " MB";
  return (bytes / 1073741824).toFixed(1) + " GB";
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
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </svg>
        </button>
        <template v-for="(crumb, idx) in breadcrumbs" :key="idx">
          <span class="breadcrumb-sep">/</span>
          <button class="breadcrumb-btn" :class="{ current: idx === breadcrumbs.length - 1 }" @click="navigateTo(crumb.path)">{{ crumb.label }}</button>
        </template>
      </div>
      <div class="toolbar-actions">
        <button v-if="isLeader && !selectMode" class="action-btn" @click="selectMode = true">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="9 11 12 14 22 4" />
            <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
          </svg>
          {{ t('cloud.select') }}
        </button>
        <button v-if="selectMode" class="action-btn" @click="exitSelectMode">{{ t('common.cancel') }}</button>
        <button class="action-btn" :disabled="uploadProgress !== null" @click="handleUpload">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          {{ uploadProgress !== null ? `${uploadProgress}%` : t('cloud.upload') }}
        </button>
        <button class="action-btn" @click="newDirName = ''; showNewDirDialog = true">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
            <line x1="12" y1="11" x2="12" y2="17" /><line x1="9" y1="14" x2="15" y2="14" />
          </svg>
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
                <svg v-if="selectedIds.has(item.id)" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
            </td>
            <td class="col-name" @click="selectMode ? toggleSelect(item) : (item.type === 'directory' ? enterDir(item) : undefined)" :class="{ clickable: selectMode || item.type === 'directory' }">
              <FileIcon :category="getFileCategory(item.name, item.type)" />
              <span>{{ item.name }}</span>
            </td>
            <td class="col-size">{{ item.type === 'file' ? formatSize(item.size) : '-' }}</td>
            <td class="col-uploader">{{ item.uploadedBy }}</td>
            <td class="col-time">{{ new Date(item.createdAt).toLocaleString() }}</td>
            <td v-if="!selectMode" class="col-actions">
              <button v-if="item.type === 'file'" class="icon-btn" :title="t('cloud.download')" @click="handleDownload(item)">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
                </svg>
              </button>
              <button v-if="isLeader" class="icon-btn danger" :title="t('common.delete')" @click="requestDeleteSingle(item)">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
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
