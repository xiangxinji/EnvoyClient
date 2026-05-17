<script setup lang="ts">
import GlassButton from "../components/GlassButton.vue";
import { useInstaller } from "../composables/useInstaller";
import { getCurrentWindow } from "@tauri-apps/api/window";

const { launchApp } = useInstaller();

async function handleLaunch() {
  await launchApp();
  await getCurrentWindow().close();
}

async function handleClose() {
  await getCurrentWindow().close();
}
</script>

<template>
  <div class="complete-page">
    <div class="check-circle">
      <svg width="48" height="48" viewBox="0 0 48 48">
        <circle cx="24" cy="24" r="22" fill="none" stroke="var(--accent)" stroke-width="2.5" />
        <polyline points="14,24 21,31 34,17" fill="none" stroke="var(--accent)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </div>

    <h2 class="complete-title">安装完成</h2>
    <p class="complete-desc">Envoy 已成功安装到您的计算机上</p>

    <div class="actions">
      <GlassButton @click="handleClose">关闭</GlassButton>
      <GlassButton variant="primary" @click="handleLaunch">启动 Envoy</GlassButton>
    </div>
  </div>
</template>

<style scoped>
.complete-page {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-lg);
  padding: var(--space-2xl);
}

.check-circle {
  width: 64px;
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--glass-bg);
  backdrop-filter: blur(var(--glass-blur));
  -webkit-backdrop-filter: blur(var(--glass-blur));
  border: 1px solid var(--glass-border);
  border-radius: 50%;
  box-shadow: var(--glass-shadow);
}

.complete-title {
  margin: 0;
  font-size: 1.3em;
  font-weight: 700;
  color: var(--text-primary);
}

.complete-desc {
  margin: 0;
  font-size: 0.9em;
  color: var(--text-secondary);
}

.actions {
  display: flex;
  gap: var(--space-sm);
  margin-top: var(--space-md);
}
</style>
