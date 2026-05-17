<script setup lang="ts">
import { ref } from "vue";
import GlassButton from "../components/GlassButton.vue";
import { useInstaller } from "../composables/useInstaller";
import router from "../router";

const { installPath, canProceed, startInstall, error } = useInstaller();

const installing = ref(false);

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

    <p class="path-hint">将安装到: {{ installPath }}</p>

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
}

.path-input:focus {
  border-color: var(--accent);
}

.path-hint {
  margin: 0;
  font-size: 0.8em;
  color: var(--text-muted);
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
