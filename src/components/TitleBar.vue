<script setup lang="ts">
import { ref } from "vue";
import { useTheme } from "../composables/useTheme";

const emit = defineEmits<{
  (e: "close-requested"): void;
}>();

defineProps<{ username?: string }>();

const isTauri = "__TAURI_INTERNALS__" in window;

const appWindow = ref<any>(null);

if (isTauri) {
  import("@tauri-apps/api/window").then(({ getCurrentWindow }) => {
    appWindow.value = getCurrentWindow();
  });
}

const { theme, toggle } = useTheme();

function minimize() {
  appWindow.value?.minimize();
}

function toggleMaximize() {
  appWindow.value?.toggleMaximize();
}

function close() {
  emit("close-requested");
}
</script>

<template>
  <div class="titlebar" data-tauri-drag-region>
    <div class="traffic-lights">
      <button class="light close" @click="close" title="关闭">
        <svg width="8" height="8" viewBox="0 0 8 8">
          <line x1="1" y1="1" x2="7" y2="7" stroke="#4d0000" stroke-width="1.2" />
          <line x1="7" y1="1" x2="1" y2="7" stroke="#4d0000" stroke-width="1.2" />
        </svg>
      </button>
      <button class="light minimize" @click="minimize" title="最小化">
        <svg width="8" height="8" viewBox="0 0 8 8">
          <line x1="1" y1="4" x2="7" y2="4" stroke="#995700" stroke-width="1.2" />
        </svg>
      </button>
      <button class="light maximize" @click="toggleMaximize" title="最大化">
        <svg width="8" height="8" viewBox="0 0 8 8">
          <path d="M1 3 L4 6 L7 3" fill="none" stroke="#006500" stroke-width="1.2" />
        </svg>
      </button>
    </div>
    <div class="title" data-tauri-drag-region>
      <span>{{ username ? `Envoy · ${username}` : 'Envoy' }}</span>
    </div>
    <button class="theme-toggle" @click="toggle" :title="theme === 'dark' ? '浅色模式' : '深色模式'">
      <svg v-if="theme === 'dark'" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="5" />
        <line x1="12" y1="1" x2="12" y2="3" />
        <line x1="12" y1="21" x2="12" y2="23" />
        <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
        <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
        <line x1="1" y1="12" x2="3" y2="12" />
        <line x1="21" y1="12" x2="23" y2="12" />
        <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
        <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
      </svg>
      <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
      </svg>
    </button>
  </div>
</template>

<style scoped>
.titlebar {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 42px;
  background: var(--glass-bg-heavy);
  backdrop-filter: blur(var(--glass-blur));
  -webkit-backdrop-filter: blur(var(--glass-blur));
  border-bottom: 1px solid var(--glass-border);
  user-select: none;
  -webkit-user-select: none;
  position: relative;
  z-index: 100;
}

.traffic-lights {
  display: flex;
  gap: 8px;
  position: absolute;
  left: 16px;
  top: 50%;
  transform: translateY(-50%);
}

.light {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
}

.light svg {
  opacity: 0;
  transition: opacity 0.15s;
}

.traffic-lights:hover .light svg {
  opacity: 1;
}

.close { background: #ff5f57; }
.minimize { background: #febc2e; }
.maximize { background: #28c840; }

.light:hover { filter: brightness(0.85); }
.close:hover { background: #ff3b30; }
.minimize:hover { background: #f5a623; }
.maximize:hover { background: #1db954; }

.title {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  font-size: 0.82em;
  font-weight: 600;
  color: var(--titlebar-text);
  letter-spacing: 0.3px;
}

.theme-toggle {
  position: absolute;
  right: 16px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: 6px;
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
}

.theme-toggle:hover {
  color: var(--text-primary);
  background: var(--border);
}
</style>
