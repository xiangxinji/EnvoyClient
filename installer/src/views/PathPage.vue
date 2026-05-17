<script setup lang="ts">
import { ref, watchEffect } from "vue";
import GlassButton from "../components/GlassButton.vue";
import { useInstaller } from "../composables/useInstaller";
import router from "../router";

const { installPath, canProceed, startInstall, getDiskInfo, error } = useInstaller();

const diskInfo = ref({ free_gb: 0, total_gb: 0 });
const installing = ref(false);

watchEffect(async () => {
  if (installPath.value) {
    diskInfo.value = await getDiskInfo(installPath.value);
  }
});

async function browse() {
  try {
    const { open } = await import("@tauri-apps/plugin-dialog");
    const selected = await open({ directory: true, multiple: false });
    if (typeof selected === "string") {
      installPath.value = selected;
    }
  } catch {
    // dialog not available
  }
}

async function handleInstall() {
  if (installing.value) return;
  installing.value = true;
  try {
    await startInstall();
  } catch (e: unknown) {
    console.error("Install failed:", e);
  } finally {
    installing.value = false;
  }
}
</script>

<template>
  <div class="path-page">
    <h2 class="page-title">选择安装位置</h2>

    <div class="path-field">
      <input
        type="text"
        class="path-input"
        v-model="installPath"
        placeholder="安装路径"
      />
      <GlassButton @click="browse">浏览</GlassButton>
    </div>

    <div class="disk-info" v-if="diskInfo.total_gb > 0">
      <span class="disk-label">可用空间</span>
      <span class="disk-value">{{ diskInfo.free_gb.toFixed(1) }} GB / {{ diskInfo.total_gb.toFixed(1) }} GB</span>
    </div>

    <div class="disk-bar" v-if="diskInfo.total_gb > 0">
      <div
        class="disk-bar-used"
        :style="{ width: ((diskInfo.total_gb - diskInfo.free_gb) / diskInfo.total_gb * 100) + '%' }"
      />
    </div>

    <div class="actions">
      <GlassButton @click="router.push('/welcome')">上一步</GlassButton>
      <GlassButton variant="primary" :disabled="!canProceed || installing" @click="handleInstall">安装</GlassButton>
    </div>

    <p v-if="error" class="error-msg">{{ error }}</p>
  </div>
</template>

<style scoped>
.path-page {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
  padding: var(--space-2xl);
}

.page-title {
  margin: 0;
  font-size: 1.15em;
  font-weight: 600;
  color: var(--text-primary);
}

.path-field {
  display: flex;
  gap: var(--space-sm);
}

.path-input {
  flex: 1;
  height: 36px;
  box-sizing: border-box;
  padding: 0 12px;
  background: var(--glass-bg-light);
  border: 1px solid var(--input-border);
  border-radius: var(--radius-sm);
  color: var(--text-primary);
  font-family: inherit;
  font-size: 0.88em;
  outline: none;
  transition: border-color 0.15s;
}

.path-input:focus {
  border-color: var(--accent);
}

.disk-info {
  display: flex;
  justify-content: space-between;
  font-size: 0.82em;
}

.disk-label {
  color: var(--text-muted);
}

.disk-value {
  color: var(--text-secondary);
}

.disk-bar {
  height: 4px;
  background: var(--glass-bg-light);
  border-radius: 2px;
  overflow: hidden;
}

.disk-bar-used {
  height: 100%;
  background: var(--accent);
  border-radius: 2px;
  transition: width 0.3s;
}

.actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-sm);
  margin-top: auto;
}

.error-msg {
  margin: 0;
  font-size: 0.82em;
  color: var(--error);
  text-align: center;
}
</style>
