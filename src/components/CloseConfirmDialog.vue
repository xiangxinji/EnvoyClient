<script setup lang="ts">
import { ref } from "vue";
import GlassCheckbox from "./GlassCheckbox.vue";

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
          <h3 class="dialog-title">关闭确认</h3>
          <p class="dialog-desc">你想要如何处理？</p>

          <div class="dialog-actions">
            <button class="btn btn-secondary" @click="visible = false">取消</button>
            <button
              class="btn btn-primary"
              @click="
                visible = false;
                emit('hide', remember);
              "
            >
              隐藏到托盘
            </button>
            <button
              class="btn btn-danger"
              @click="
                visible = false;
                emit('exit', remember);
              "
            >
              退出应用
            </button>
          </div>

          <GlassCheckbox v-model="remember">记住我的选择，下次不再询问</GlassCheckbox>
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
  color: #fff;
}

.btn-danger {
  background: var(--error);
  color: #fff;
}

.dialog :deep(.glass-checkbox) {
  margin-top: var(--space-lg);
  font-size: 0.82em;
}

.overlay-enter-active,
.overlay-leave-active {
  transition: opacity 0.18s ease;
}

.overlay-enter-from,
.overlay-leave-to {
  opacity: 0;
}
</style>
