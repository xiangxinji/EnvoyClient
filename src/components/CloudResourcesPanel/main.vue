<script setup lang="ts">
import { ref, onMounted, computed, watch, nextTick } from "vue";
import { useI18n } from "vue-i18n";
import { useEventListener } from "@vueuse/core";
import { getTeamClientInstance, getCloudResourceService } from "../../composables/teamClientContext";
import { useToast } from "../../composables/useToast";
import { useConfirm } from "../../composables/useConfirm";
import { motionPresets } from "../../styles/motion-presets";
import { useReducedMotion } from "../../composables/useReducedMotion";
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
const isReduced = useReducedMotion();

const dialogMotion = computed(() =>
  isReduced.value
    ? { initial: { opacity: 0 }, enter: { opacity: 1 } }
    : motionPresets.scaleIn
);

const { toastVisible, toastMessage, toastType, showToast, hideToast } = useToast();
const { confirmVisible, confirmTitle, confirmMessage, confirmDanger, showConfirm, handleConfirm, handleCancel } = useConfirm();

const currentDirId = ref<string | null>(null);
const items = ref<CloudFileItem[]>([]);
const loading = ref(false);
const uploadProgress = ref<number | null>(null);
const showNewDirDialog = ref(false);
const newDirName = ref("");
const newDirInputRef = ref<InstanceType<typeof GlassInput> | null>(null);

watch(showNewDirDialog, (val) => {
  if (val) nextTick(() => { newDirInputRef.value?.focus(); });
});

useEventListener("keydown", (e) => {
  if (e.key === "Escape" && showNewDirDialog.value) closeDirDialog();
});

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

interface Breadcrumb { id: string | null; label: string }

const breadcrumbs = ref<Breadcrumb[]>([]);

// ─── Core actions ──────────────────────────────────────────────

async function loadFiles() {
  loading.value = true;
  try {
    const result = await cloudService.listFiles(currentDirId.value);
    items.value = result.items;
    // Update breadcrumb from listing metadata
    if (currentDirId.value === null) {
      breadcrumbs.value = [];
    } else {
      // Build breadcrumb by querying the server
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
  } catch (e: unknown) { showToast(getErrorMessage(e) || t("common.uploadFailed"), "error"); }
  finally { uploadProgress.value = null; }
}

async function confirmNewDir() {
  const name = newDirName.value.trim();
  if (!name) return;
  showNewDirDialog.value = false;
  try {
    await cloudService.createDirectory(name, currentDirId.value);
    await loadFiles();
  } catch (e: unknown) { showToast(getErrorMessage(e) || t("common.operationFailed"), "error"); }
}

function closeDirDialog() {
  showNewDirDialog.value = false;
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
    try { await cloudService.deleteFile(item.id); }
    catch (e: unknown) { showToast(getErrorMessage(e) || t("common.operationFailed"), "error"); break; }
  }
  exitSelectMode();
  await loadFiles();
}

async function handleDownload(item: CloudFileItem) {
  try {
    const url = cloudService.downloadUrl(item.id);
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
        <button class="breadcrumb-btn root-btn" :class="{ current: !currentDirId }" @click="navigateTo(null)">
          <SvgIcon name="home" :size="14" />
        </button>
        <template v-for="(crumb, idx) in breadcrumbs" :key="crumb.id">
          <span class="breadcrumb-sep">/</span>
          <button class="breadcrumb-btn" :class="{ current: idx === breadcrumbs.length - 1 }" @click="navigateTo(crumb.id)">{{ crumb.label }}</button>
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
      <Transition name="fade">
        <div v-if="showNewDirDialog" class="dir-overlay">
          <div
            class="dir-dialog"
            @click.stop
            v-motion="dialogMotion"
          >
            <h3>{{ t('cloud.createDir') }}</h3>
            <GlassInput ref="newDirInputRef" v-model="newDirName" :placeholder="t('cloud.createDirPrompt')" bordered @keydown.enter="confirmNewDir" />
            <div class="dir-actions">
              <GlassButton variant="default" @click="closeDirDialog">{{ t('common.cancel') }}</GlassButton>
              <GlassButton variant="primary" :disabled="!newDirName.trim()" @click="confirmNewDir">{{ t('common.confirm') }}</GlassButton>
            </div>
          </div>
        </div>
      </Transition>
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
