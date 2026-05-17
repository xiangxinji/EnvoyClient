<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { useI18n } from "vue-i18n";
import type { MemberInfo } from "../types";

const props = defineProps<{
  visible: boolean;
  members: MemberInfo[];
  currentPeerId: string;
}>();

const emit = defineEmits<{
  confirm: [targetId: string];
  cancel: [];
}>();

const { t } = useI18n();
const selectedId = ref<string | null>(null);

const targets = computed(() => props.members.filter((m) => m.id !== props.currentPeerId));

watch(() => props.visible, (v) => {
  if (!v) selectedId.value = null;
});

function handleConfirm() {
  if (selectedId.value) {
    emit("confirm", selectedId.value);
    selectedId.value = null;
  }
}

function handleCancel() {
  selectedId.value = null;
  emit("cancel");
}

function getInitial(name: string): string {
  return name.charAt(0).toUpperCase();
}
</script>

<template>
  <Teleport to="body">
    <div v-if="visible" class="forward-overlay" @click.self="handleCancel">
      <div class="forward-dialog">
        <div class="forward-title">{{ t('chat.forwardTo') }}</div>
        <div v-if="targets.length === 0" class="forward-empty">{{ t('chat.noForwardTarget') }}</div>
        <div v-else class="forward-list">
          <div
            v-for="m in targets"
            :key="m.id"
            class="forward-item"
            :class="{ active: m.id === selectedId }"
            @click="selectedId = m.id"
          >
            <div class="forward-avatar">{{ getInitial(m.id) }}</div>
            <div class="forward-info">
              <span class="forward-name">{{ m.id }}</span>
              <span class="forward-role" :class="m.role">{{ m.role }}</span>
            </div>
            <div class="forward-radio" :class="{ checked: m.id === selectedId }">
              <svg v-if="m.id === selectedId" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
          </div>
        </div>
        <div class="forward-actions">
          <button class="btn-cancel" @click="handleCancel">{{ t('common.cancel') }}</button>
          <button class="btn-confirm" @click="handleConfirm" :disabled="!selectedId">{{ t('chat.confirmForward') }}</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.forward-overlay {
  position: fixed;
  inset: 0;
  z-index: 10000;
  background: var(--overlay-bg);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
}

.forward-dialog {
  width: 340px;
  max-height: 70vh;
  display: flex;
  flex-direction: column;
  background: var(--glass-bg-heavy);
  backdrop-filter: blur(var(--glass-blur));
  -webkit-backdrop-filter: blur(var(--glass-blur));
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  box-shadow: var(--glass-shadow-heavy);
  overflow: hidden;
}

.forward-title {
  padding: var(--space-md) var(--space-lg);
  font-weight: 600;
  font-size: 0.95em;
  color: var(--text-primary);
  border-bottom: 1px solid var(--glass-border);
}

.forward-empty {
  padding: var(--space-xl) var(--space-lg);
  text-align: center;
  color: var(--text-muted);
  font-size: 0.85em;
}

.forward-list {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-xs);
}

.forward-item {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-sm);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: background 0.1s;
}

.forward-item:hover {
  background: var(--glass-bg-light);
}

.forward-item.active {
  background: var(--accent-light);
}

.forward-avatar {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: var(--accent-light);
  color: var(--accent);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: 0.75em;
  flex-shrink: 0;
}

.forward-info {
  flex: 1;
  display: flex;
  align-items: baseline;
  gap: var(--space-xs);
  min-width: 0;
}

.forward-name {
  font-weight: 500;
  font-size: 0.85em;
  color: var(--text-primary);
}

.forward-role {
  font-size: 0.65em;
  padding: 1px 5px;
  border-radius: var(--radius-sm);
  font-weight: 500;
}

.forward-role.leader {
  background: var(--role-leader-bg);
  color: var(--role-leader-text);
}

.forward-role.member {
  background: var(--role-member-bg);
  color: var(--role-member-text);
}

.forward-radio {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  border: 2px solid var(--glass-border);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: all 0.15s;
}

.forward-radio.checked {
  background: var(--accent);
  border-color: var(--accent);
  color: var(--text-on-accent);
}

.forward-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-sm);
  padding: var(--space-sm) var(--space-lg) var(--space-md);
  border-top: 1px solid var(--glass-border);
}

.btn-cancel {
  padding: 6px 16px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--glass-border);
  background: transparent;
  color: var(--text-secondary);
  font-size: 0.85em;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-cancel:hover {
  background: var(--glass-bg-light);
}

.btn-confirm {
  padding: 6px 16px;
  border-radius: var(--radius-sm);
  border: none;
  background: var(--accent);
  color: var(--text-on-accent);
  font-size: 0.85em;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-confirm:hover {
  background: var(--accent-hover);
}

.btn-confirm:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
