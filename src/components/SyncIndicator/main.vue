<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { getBrainsSync } from "../../composables/teamClientContext";

const { t } = useI18n();
const brainsSync = getBrainsSync();

const progressText = computed(() => {
  if (!brainsSync.syncing.value) return "";
  const { current, total } = brainsSync.syncProgress.value;
  return t("settings.brainsSyncProgress", { current, total });
});

const currentFileName = computed(() => {
  const f = brainsSync.currentFile.value;
  if (!f) return "";
  const idx = f.lastIndexOf("/");
  return idx >= 0 ? f.slice(idx + 1) : f;
});
</script>

<template>
  <Transition name="sync-float">
    <div v-if="brainsSync.syncing.value" class="sync-float">
      <span class="sync-spinner"></span>
      <span class="sync-text">{{ progressText }}</span>
      <span v-if="currentFileName" class="sync-file" :title="brainsSync.currentFile.value">{{ currentFileName }}</span>
    </div>
  </Transition>
</template>

<style scoped>
.sync-float {
  position: fixed;
  bottom: 16px;
  right: 16px;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: var(--glass-bg-heavy);
  backdrop-filter: blur(var(--glass-blur));
  -webkit-backdrop-filter: blur(var(--glass-blur));
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  box-shadow: var(--glass-shadow-heavy);
  z-index: 9999;
  max-width: 320px;
}

.sync-spinner {
  width: 12px;
  height: 12px;
  border: 2px solid var(--glass-border);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: sync-spin 0.8s linear infinite;
  flex-shrink: 0;
}

.sync-text {
  font-size: 0.72em;
  color: var(--text-muted);
  white-space: nowrap;
}

.sync-file {
  font-size: 0.68em;
  color: var(--text-muted);
  opacity: 0.7;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 120px;
}

@keyframes sync-spin {
  to { transform: rotate(360deg); }
}

.sync-float-enter-active { transition: opacity 0.2s, transform 0.2s; }
.sync-float-leave-active { transition: opacity 0.15s, transform 0.15s; }
.sync-float-enter-from { opacity: 0; transform: translateY(8px); }
.sync-float-leave-to { opacity: 0; transform: translateY(4px); }
</style>
