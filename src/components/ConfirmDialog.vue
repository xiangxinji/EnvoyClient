<script setup lang="ts">
import { ref, watch } from "vue";

const props = defineProps<{
  visible: boolean;
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
}>();

const emit = defineEmits<{
  confirm: [];
  cancel: [];
}>();

const show = ref(false);

watch(() => props.visible, (val) => {
  if (val) {
    requestAnimationFrame(() => { show.value = true; });
  } else {
    show.value = false;
  }
});

function handleConfirm() {
  show.value = false;
  setTimeout(() => emit("confirm"), 150);
}

function handleCancel() {
  show.value = false;
  setTimeout(() => emit("cancel"), 150);
}

function handleBackdropClick() {
  handleCancel();
}
</script>

<template>
  <Teleport to="body">
    <div v-if="visible" class="confirm-overlay" :class="{ active: show }" @click="handleBackdropClick">
      <div class="confirm-dialog" :class="{ active: show }" @click.stop>
        <div class="confirm-title">{{ title ?? "确认" }}</div>
        <div class="confirm-message">{{ message }}</div>
        <div class="confirm-actions">
          <button class="btn-cancel" @click="handleCancel">{{ cancelText ?? "取消" }}</button>
          <button class="btn-confirm" :class="{ danger }" @click="handleConfirm">{{ confirmText ?? "确认" }}</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.confirm-overlay {
  position: fixed;
  inset: 0;
  background: var(--overlay-bg);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  opacity: 0;
  transition: opacity 0.15s ease;
}

.confirm-overlay.active {
  opacity: 1;
}

.confirm-dialog {
  background: var(--glass-bg-heavy);
  backdrop-filter: blur(var(--glass-blur));
  -webkit-backdrop-filter: blur(var(--glass-blur));
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  padding: var(--space-xl);
  min-width: 300px;
  max-width: 400px;
  box-shadow: var(--glass-shadow-heavy);
  transform: scale(0.95);
  transition: transform 0.15s ease;
}

.confirm-dialog.active {
  transform: scale(1);
}

.confirm-title {
  font-weight: 600;
  font-size: 1em;
  color: var(--text-primary);
  margin-bottom: var(--space-sm);
}

.confirm-message {
  font-size: 0.88em;
  color: var(--text-secondary);
  line-height: 1.5;
  margin-bottom: var(--space-xl);
}

.confirm-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-sm);
}

.btn-cancel,
.btn-confirm {
  padding: 6px 16px;
  border-radius: var(--radius-sm);
  border: none;
  font-size: 0.85em;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-cancel {
  background: var(--bg-secondary);
  color: var(--text-primary);
  border: 1px solid var(--border);
}

.btn-cancel:hover {
  background: var(--bg-tertiary);
}

.btn-confirm {
  background: var(--accent);
  color: white;
}

.btn-confirm:hover {
  background: var(--accent-hover);
}

.btn-confirm.danger {
  background: var(--error);
}

.btn-confirm.danger:hover {
  opacity: 0.85;
}
</style>
