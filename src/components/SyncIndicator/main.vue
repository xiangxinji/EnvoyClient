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

<style scoped>@import './styles.css';</style>
