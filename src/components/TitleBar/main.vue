<script setup lang="ts">
import { ref } from "vue";
import { useTheme } from "../../composables/useTheme";
import { useI18n } from "vue-i18n";
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

const { theme, toggle } = useTheme();

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

function close() {
  emit("close-requested");
}
</script>

<template>
  <div class="titlebar" data-tauri-drag-region>
    <div class="traffic-lights">
      <button class="light close" @click="close" :title="t('titlebar.close')">
        <SvgIcon name="window-close" :size="8" />
      </button>
      <button class="light minimize" @click="minimize" :title="t('titlebar.minimize')">
        <SvgIcon name="window-minimize" :size="8" />
      </button>
      <button class="light maximize" @click="toggleMaximize" :title="t('titlebar.maximize')">
        <SvgIcon name="window-maximize" :size="8" />
      </button>
    </div>
    <div class="title" data-tauri-drag-region>
      <span>{{ username ? `Envoy · ${username}` : 'Envoy' }}</span>
    </div>
    <div class="titlebar-actions">
      <button class="theme-toggle" @click="toggle" :title="theme === 'dark' ? t('titlebar.lightMode') : t('titlebar.darkMode')">
        <SvgIcon v-if="theme === 'dark'" name="sun" :size="14" />
        <SvgIcon v-else name="moon" :size="14" />
      </button>
      <button class="pin-toggle" :class="{ active: isPinned }" @click="togglePin" :title="isPinned ? t('titlebar.unpin') : t('titlebar.pin')">
        <SvgIcon name="pin" :size="14" />
      </button>
    </div>
  </div>
</template>

<style scoped>
@import './styles.css';
</style>
