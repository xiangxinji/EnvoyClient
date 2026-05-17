<script setup lang="ts">
import GlassButton from "../components/GlassButton.vue";
import { useInstaller } from "../composables/useInstaller";

const { progress, currentFile, cancelInstall } = useInstaller();

async function handleCancel() {
  await cancelInstall();
}
</script>

<template>
  <div class="installing-page">
    <div class="progress-ring-container">
      <svg class="progress-ring" viewBox="0 0 120 120">
        <circle class="ring-bg" cx="60" cy="60" r="52" />
        <circle
          class="ring-fill"
          cx="60" cy="60" r="52"
          :stroke-dasharray="2 * Math.PI * 52"
          :stroke-dashoffset="2 * Math.PI * 52 * (1 - progress / 100)"
        />
      </svg>
      <div class="progress-text">{{ Math.round(progress) }}%</div>
    </div>

    <p class="status-text">正在安装...</p>
    <p class="file-text">{{ currentFile }}</p>

    <div class="actions">
      <GlassButton variant="danger" @click="handleCancel">取消安装</GlassButton>
    </div>
  </div>
</template>

<style scoped>
.installing-page {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-lg);
  padding: var(--space-2xl);
}

.progress-ring-container {
  position: relative;
  width: 120px;
  height: 120px;
}

.progress-ring {
  width: 100%;
  height: 100%;
  transform: rotate(-90deg);
}

.ring-bg {
  fill: none;
  stroke: var(--glass-bg-light);
  stroke-width: 6;
}

.ring-fill {
  fill: none;
  stroke: var(--accent);
  stroke-width: 6;
  stroke-linecap: round;
  transition: stroke-dashoffset 0.3s ease;
}

.progress-text {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 1.6em;
  font-weight: 700;
  color: var(--text-primary);
}

.status-text {
  margin: 0;
  font-size: 1em;
  font-weight: 500;
  color: var(--text-secondary);
}

.file-text {
  margin: 0;
  font-size: 0.8em;
  color: var(--text-muted);
  max-width: 280px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.actions {
  margin-top: var(--space-lg);
}
</style>
