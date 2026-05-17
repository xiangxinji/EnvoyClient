<script setup lang="ts">
import { ref } from "vue";
import { useI18n } from "vue-i18n";
import GlassCheckbox from "./GlassCheckbox.vue";

useI18n();

const emit = defineEmits<{
  (e: "hide", remember: boolean): void;
  (e: "exit", remember: boolean): void;
}>();

const visible = defineModel<boolean>({ required: true });
const remember = ref(false);
</script>

<template>
  <Teleport to="body">
    <Transition name="overlay">
      <div v-if="visible" class="overlay" @click.self="visible = false">
        <div class="dialog">
	          <h3 class="dialog-title">{{ $t('dialog.closeConfirm') }}</h3>
	          <p class="dialog-desc">{{ $t('dialog.closeConfirmDesc') }}</p>

          <div class="dialog-actions">
            <button class="btn btn-secondary" @click="visible = false">{{ $t('common.cancel') }}</button>
            <button
              class="btn btn-primary"
              @click="
                visible = false;
                emit('hide', remember);
              "
            >
              {{ $t('dialog.hideToTray') }}
            </button>
            <button
              class="btn btn-danger"
              @click="
                visible = false;
                emit('exit', remember);
              "
            >
              {{ $t('dialog.quitApp') }}
            </button>
          </div>

          <GlassCheckbox v-model="remember">{{ $t('dialog.rememberChoice') }}</GlassCheckbox>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--overlay-bg);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
}

.dialog {
  background: var(--glass-bg-heavy);
  backdrop-filter: blur(var(--glass-blur));
  -webkit-backdrop-filter: blur(var(--glass-blur));
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-xl);
  padding: var(--space-xl) var(--space-2xl);
  min-width: 340px;
  box-shadow: var(--glass-shadow-heavy);
}

.overlay-enter-active {
  transition: opacity 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}
.overlay-enter-active .dialog {
  transition:
    transform 0.32s cubic-bezier(0.16, 1, 0.3, 1),
    filter 0.32s cubic-bezier(0.16, 1, 0.3, 1),
    opacity 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}
.overlay-leave-active {
  transition: opacity 0.18s cubic-bezier(0.4, 0, 1, 1);
}
.overlay-leave-active .dialog {
  transition:
    transform 0.18s cubic-bezier(0.4, 0, 1, 1),
    filter 0.18s cubic-bezier(0.4, 0, 1, 1),
    opacity 0.18s cubic-bezier(0.4, 0, 1, 1);
}
.overlay-enter-from {
  opacity: 0;
}
.overlay-enter-from .dialog {
  transform: scale(0.94);
  filter: blur(8px);
  opacity: 0;
}
.overlay-leave-to {
  opacity: 0;
}
.overlay-leave-to .dialog {
  transform: scale(0.97);
  filter: blur(4px);
  opacity: 0;
}

.dialog-title {
  margin: 0 0 var(--space-xs);
  font-size: 1.05em;
  font-weight: 600;
  color: var(--text-primary);
}

.dialog-desc {
  margin: 0 0 var(--space-lg);
  font-size: 0.9em;
  color: var(--text-secondary);
}

.dialog-actions {
  display: flex;
  gap: var(--space-sm);
  justify-content: flex-end;
}

.btn {
  padding: 7px 16px;
  border-radius: var(--radius-sm);
  border: none;
  font-size: 0.88em;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s, opacity 0.15s;
}

.btn:hover {
  opacity: 0.88;
}

.btn-secondary {
  background: var(--bg-tertiary);
  color: var(--text-secondary);
}

.btn-primary {
  background: var(--accent);
  color: var(--text-on-accent);
}

.btn-danger {
  background: var(--error);
  color: var(--text-on-accent);
}

.dialog :deep(.glass-checkbox) {
  margin-top: var(--space-lg);
  font-size: 0.82em;
}
</style>
