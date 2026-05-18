<script setup lang="ts">
import { useI18n } from "vue-i18n";

const { t } = useI18n();

defineProps<{
  status: "disconnected" | "connecting" | "reconnecting" | "reconnect_failed";
  attempt: number;
}>();

defineEmits<{
  logout: [];
}>();
</script>

<template>
  <Teleport to="body">
    <div class="reconnect-overlay">
      <div class="reconnect-card">
        <div class="reconnect-spinner" />
        <div class="reconnect-title">{{ t('reconnect.title') }}</div>
        <div class="reconnect-status">
          <template v-if="status === 'reconnect_failed'">
            {{ t('reconnect.slowRetry') }}
          </template>
          <template v-else>
            {{ t('reconnect.attempt', { attempt }) }}
          </template>
        </div>
        <button class="reconnect-logout" @click="$emit('logout')">
          {{ t('reconnect.backToLogin') }}
        </button>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.reconnect-overlay {
  position: fixed;
  inset: 0;
  background: var(--overlay-bg);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
}

.reconnect-card {
  background: var(--glass-bg-heavy);
  backdrop-filter: blur(var(--glass-blur));
  -webkit-backdrop-filter: blur(var(--glass-blur));
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  padding: var(--space-xl) var(--space-2xl);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-md);
  box-shadow: var(--glass-shadow-heavy);
  min-width: 260px;
}

.reconnect-spinner {
  width: 28px;
  height: 28px;
  border: 2px solid var(--glass-border);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }

.reconnect-title {
  font-weight: 600;
  font-size: 1em;
  color: var(--text-primary);
}

.reconnect-status {
  font-size: 0.85em;
  color: var(--text-secondary);
}

.reconnect-logout {
  margin-top: var(--space-sm);
  padding: 6px 18px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: var(--bg-secondary);
  color: var(--text-secondary);
  font-size: 0.85em;
  cursor: pointer;
  transition: all 0.15s;
}

.reconnect-logout:hover {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}
</style>
