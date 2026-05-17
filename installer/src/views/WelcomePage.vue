<script setup lang="ts">
import GlassButton from "../components/GlassButton.vue";
import { useInstaller } from "../composables/useInstaller";
import router from "../router";

const { loadDefaultPath } = useInstaller();

async function goToPath() {
  await loadDefaultPath();
  router.push("/path");
}
</script>

<template>
  <div class="welcome">
    <div class="logo-area">
      <div class="logo-circle">
        <img src="../assets/logo.png" alt="Envoy" class="logo-img" />
      </div>
      <h1 class="app-name">Envoy</h1>
      <p class="version">v0.1.0</p>
    </div>

    <div class="features">
      <div class="feature">
        <span class="feature-icon">💬</span>
        <span>团队实时协作聊天</span>
      </div>
      <div class="feature">
        <span class="feature-icon">🤖</span>
        <span>AI 智能任务分派</span>
      </div>
      <div class="feature">
        <span class="feature-icon">⚡</span>
        <span>本地 Agent 自动执行</span>
      </div>
    </div>

    <div class="actions">
      <GlassButton variant="primary" @click="goToPath">开始安装</GlassButton>
    </div>
  </div>
</template>

<style scoped>
.welcome {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-xl);
  padding: var(--space-2xl);
}

.logo-area {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-sm);
}

.logo-circle {
  width: 80px;
  height: 80px;
  border-radius: var(--radius-lg);
  overflow: hidden;
  border: 1px solid var(--glass-border);
  box-shadow: var(--glass-shadow);
  margin-bottom: var(--space-sm);
}

.logo-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.app-name {
  margin: 0;
  font-size: 1.6em;
  font-weight: 700;
  letter-spacing: -0.5px;
  background: linear-gradient(135deg, var(--accent), var(--accent-hover));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.version {
  margin: 0;
  font-size: 0.85em;
  color: var(--text-muted);
}

.features {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  background: var(--glass-bg);
  backdrop-filter: blur(var(--glass-blur));
  -webkit-backdrop-filter: blur(var(--glass-blur));
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  padding: var(--space-lg);
  width: 100%;
  max-width: 320px;
}

.feature {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  font-size: 0.9em;
  color: var(--text-secondary);
}

.feature-icon {
  font-size: 1.1em;
}

.actions {
  display: flex;
  gap: var(--space-sm);
}

.actions .glass-btn {
  min-width: 180px;
}
</style>
