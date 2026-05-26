<script setup lang="ts">
import { ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { getCloudResourceService } from "../../composables/teamClientContext";
import { downloadFileWithDialog } from "../../utils/notification";
import { formatFileSize } from "../../utils/taskFormatters";
import type { CloudFileItem } from "../../services/types";
import SvgIcon from "../SvgIcon";

const { t } = useI18n();

const props = defineProps<{
  visible: boolean;
  dirId: string;
  dirName: string;
  teamName?: string;
}>();

const emit = defineEmits<{
  "update:visible": [value: boolean];
}>();

const loading = ref(false);
const items = ref<CloudFileItem[]>([]);
const currentDirId = ref<string | null>(null);
const downloading = ref(false);

interface Breadcrumb { id: string | null; label: string }
const breadcrumbs = ref<Breadcrumb[]>([]);

async function loadDir(dirId: string | null) {
  loading.value = true;
  currentDirId.value = dirId;
  try {
    const result = await getCloudResourceService().listFiles(dirId);
    items.value = result.items;
    // Update breadcrumbs
    if (dirId === null) {
      breadcrumbs.value = [];
    } else {
      const chain = await getCloudResourceService().getBreadcrumb(dirId);
      breadcrumbs.value = chain.map(b => ({ id: b.id, label: b.name }));
    }
  } catch {
    items.value = [];
  } finally {
    loading.value = false;
  }
}

function enterDir(item: CloudFileItem) {
  if (item.type !== "directory") return;
  loadDir(item.id);
}

function navigateTo(dirId: string | null) {
  loadDir(dirId);
}

async function handleDownload(item: CloudFileItem) {
  if (downloading.value) return;
  downloading.value = true;
  try {
    const url = getCloudResourceService().downloadUrl(item.id);
    await downloadFileWithDialog(url, item.name, props.teamName ? { team: props.teamName } : undefined);
  } catch {
    // silent
  } finally {
    downloading.value = false;
  }
}

function close() {
  emit("update:visible", false);
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === "Escape") close();
}

watch(() => props.visible, (open) => {
  if (open) {
    loadDir(props.dirId);
    document.addEventListener("keydown", handleKeydown);
  } else {
    items.value = [];
    currentDirId.value = null;
    breadcrumbs.value = [];
    document.removeEventListener("keydown", handleKeydown);
  }
});
</script>

<template>
  <Teleport to="body">
    <Transition name="viewer">
      <div v-if="visible" class="dir-dialog-overlay">
        <div class="dir-dialog" @click.stop>
          <div class="dir-dialog-header">
            <span>{{ dirName }}</span>
            <button class="dir-dialog-close" @click="close"><SvgIcon name="close" :size="16" /></button>
          </div>

          <div class="dir-breadcrumb">
            <button class="breadcrumb-btn" @click="navigateTo(null)">
              <SvgIcon name="home" :size="14" />
            </button>
            <template v-for="(crumb, idx) in breadcrumbs" :key="crumb.id">
              <span class="breadcrumb-sep">/</span>
              <button class="breadcrumb-btn" :class="{ current: idx === breadcrumbs.length - 1 }" @click="navigateTo(crumb.id)">{{ crumb.label }}</button>
            </template>
          </div>

          <div class="dir-dialog-body">
            <div v-if="loading" class="dir-empty">
              <span class="spinner-small"></span> {{ t('common.loading') }}
            </div>
            <div v-else-if="items.length === 0" class="dir-empty">{{ t('cloud.empty') }}</div>
            <div v-else class="dir-list">
              <div v-for="item in items" :key="item.id" class="dir-item" :class="{ clickable: item.type === 'directory' }" @click="item.type === 'directory' ? enterDir(item) : undefined">
                <div class="dir-item-icon"><SvgIcon :name="item.type === 'directory' ? 'folder' : 'file'" :size="16" /></div>
                <span class="dir-item-name">{{ item.name }}</span>
                <span v-if="item.type === 'file'" class="dir-item-size">{{ formatFileSize(item.size) }}</span>
                <button v-if="item.type === 'file'" class="dir-item-download" :disabled="downloading" @click.stop="handleDownload(item)" :title="t('cloud.download')">
                  <SvgIcon name="download" :size="14" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.dir-dialog-overlay { position: fixed; inset: 0; z-index: 9998; background: var(--overlay-bg); backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px); display: flex; align-items: center; justify-content: center; }
.dir-dialog { width: 480px; max-height: 70vh; display: flex; flex-direction: column; background: var(--glass-bg-heavy); backdrop-filter: blur(var(--glass-blur)); -webkit-backdrop-filter: blur(var(--glass-blur)); border: 1px solid var(--glass-border); border-radius: var(--radius-lg); box-shadow: var(--glass-shadow-heavy); overflow: hidden; }
.dir-dialog-header { display: flex; align-items: center; justify-content: space-between; padding: var(--space-md) var(--space-lg); font-weight: 600; font-size: 0.95em; color: var(--text-primary); border-bottom: 1px solid var(--glass-border); }
.dir-dialog-close { display: flex; align-items: center; justify-content: center; width: 28px; height: 28px; border: none; border-radius: var(--radius-sm); background: transparent; color: var(--text-muted); cursor: pointer; transition: all 0.15s; }
.dir-dialog-close:hover { background: var(--bg-tertiary); color: var(--text-primary); }

.dir-breadcrumb { display: flex; align-items: center; gap: 2px; padding: var(--space-xs) var(--space-lg); border-bottom: 1px solid var(--glass-border); font-size: 0.82em; overflow-x: auto; flex-shrink: 0; }
.breadcrumb-btn { display: inline-flex; align-items: center; gap: 2px; padding: 2px 6px; border: none; border-radius: var(--radius-sm); background: transparent; color: var(--text-muted); cursor: pointer; font-size: inherit; white-space: nowrap; transition: all 0.15s; }
.breadcrumb-btn:hover { background: var(--glass-bg-light); color: var(--text-primary); }
.breadcrumb-btn.current { color: var(--text-primary); font-weight: 500; }
.breadcrumb-sep { color: var(--text-muted); margin: 0 1px; }

.dir-dialog-body { flex: 1; overflow-y: auto; padding: var(--space-sm) 0; }
.dir-empty { padding: var(--space-lg); text-align: center; color: var(--text-muted); font-size: 0.85em; display: flex; align-items: center; justify-content: center; gap: var(--space-xs); }
.dir-list { display: flex; flex-direction: column; }
.dir-item { display: flex; align-items: center; gap: var(--space-sm); padding: var(--space-sm) var(--space-lg); transition: background 0.1s; }
.dir-item.clickable { cursor: pointer; }
.dir-item:hover { background: var(--glass-bg-light); }
.dir-item-icon { width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; background: var(--accent-light); border-radius: var(--radius-sm); color: var(--accent); flex-shrink: 0; }
.dir-item-name { flex: 1; font-size: 0.88em; color: var(--text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dir-item-size { font-size: 0.78em; color: var(--text-muted); flex-shrink: 0; }
.dir-item-download { display: flex; align-items: center; justify-content: center; width: 28px; height: 28px; border: none; border-radius: var(--radius-sm); background: transparent; color: var(--text-muted); cursor: pointer; flex-shrink: 0; transition: all 0.15s; }
.dir-item-download:hover { background: var(--bg-tertiary); color: var(--accent); }
.dir-item-download:disabled { opacity: 0.5; cursor: not-allowed; }

.spinner-small { width: 12px; height: 12px; border: 2px solid var(--border); border-top-color: var(--accent); border-radius: 50%; animation: spin 0.6s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

.viewer-enter-active { transition: opacity 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
.viewer-enter-active .dir-dialog { transition: transform 0.32s cubic-bezier(0.16, 1, 0.3, 1), filter 0.32s cubic-bezier(0.16, 1, 0.3, 1); }
.viewer-leave-active { transition: opacity 0.2s cubic-bezier(0.4, 0, 1, 1); }
.viewer-leave-active .dir-dialog { transition: transform 0.18s ease-in, filter 0.18s ease-in; }
.viewer-enter-from, .viewer-leave-to { opacity: 0; }
.viewer-enter-from .dir-dialog { transform: scale(0.94); filter: blur(8px); }
.viewer-leave-to .dir-dialog { transform: scale(0.97); filter: blur(4px); }
</style>
