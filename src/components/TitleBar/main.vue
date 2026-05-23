<script setup lang="ts">
import { ref } from "vue";
import { useTheme } from "../../composables/useTheme";
import { useI18n } from "vue-i18n";
import { useMouseGradient } from "../../composables/useMouseGradient";
import SvgIcon from "../SvgIcon";

const { t } = useI18n();

const emit = defineEmits<{
  (e: "close-requested"): void;
}>();

defineProps<{ username?: string }>();

import { isTauri } from "../../utils/platform";

const appWindow = ref<any>(null);

if (isTauri) {
  import("@tauri-apps/api/window").then(({ getCurrentWindow }) => {
    appWindow.value = getCurrentWindow();
  });
}

const { theme, toggle, isThemeLocked } = useTheme();

const isPinned = ref(false);

function minimize() {
  appWindow.value?.minimize();
}

function toggleMaximize() {
  appWindow.value?.toggleMaximize();
}

async function togglePin() {
  if (!appWindow.value) return;
  const pinned = await appWindow.value.isAlwaysOnTop();
  await appWindow.value.setAlwaysOnTop(!pinned);
  isPinned.value = !pinned;
}

const titlebarRef = ref<HTMLElement | null>(null);
const { onMouseMove, onMouseLeave } = useMouseGradient(titlebarRef, {
  initialX: 50,
  initialY: 50,
});

function close() {
  emit("close-requested");
}
</script>

<template>
  <div class="titlebar" ref="titlebarRef" data-tauri-drag-region @mousemove="onMouseMove" @mouseleave="onMouseLeave">
    <div class="titlebar-left">
      <div class="window-controls">
        <button class="traffic-btn close-btn" @click="close" :title="t('titlebar.close')">
          <SvgIcon name="close" :size="8" />
        </button>
        <button class="traffic-btn minimize-btn" @click="minimize" :title="t('titlebar.minimize')">
          <SvgIcon name="minus" :size="8" />
        </button>
        <button class="traffic-btn maximize-btn" @click="toggleMaximize" :title="t('titlebar.maximize')">
          <SvgIcon name="expand" :size="8" />
        </button>
      </div>
    </div>
    <div class="titlebar-center" data-tauri-drag-region>
      <span class="titlebar-dot"></span>
      <span class="titlebar-title">{{ username ? `Envoy · ${username}` : 'Envoy' }}</span>
    </div>
    <div class="titlebar-right">
      <button class="tool-btn" :class="{ active: isPinned }" @click="togglePin" :title="isPinned ? t('titlebar.unpin') : t('titlebar.pin')">
        <SvgIcon name="pin" :size="14" />
      </button>
      <button v-if="!isThemeLocked" class="tool-btn" @click="toggle" :title="theme === 'dark' ? t('titlebar.lightMode') : t('titlebar.darkMode')">
        <SvgIcon v-if="theme === 'dark'" name="sun" :size="14" />
        <SvgIcon v-else name="moon" :size="14" />
      </button>
    </div>
  </div>
</template>

<style scoped>
@import './styles.css';
</style>
