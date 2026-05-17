<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from "vue";
import TitleBar from "./components/TitleBar.vue";
import CloseConfirmDialog from "./components/CloseConfirmDialog.vue";
import { useTheme } from "./composables/useTheme";
import { useTeamClientInstance } from "./composables/teamClientContext";

useTheme();

const instance = useTeamClientInstance();
const username = computed(() => instance.value?.myId ?? undefined);

const showDialog = ref(false);
const isTauri = "__TAURI_INTERNALS__" in window;

let unlisten: (() => void) | null = null;

async function getCloseAction(): Promise<string> {
  if (!isTauri) return "ask";
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    const settings = (await invoke("get_settings")) as Record<string, unknown>;
    return (settings.close_action as string) || "ask";
  } catch {
    return "ask";
  }
}

async function saveCloseAction(action: string): Promise<void> {
  if (!isTauri) return;
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    const settings = (await invoke("get_settings")) as Record<string, unknown>;
    settings.close_action = action;
    await invoke("save_settings", { settings });
  } catch {}
}

async function handleHide() {
  if (!isTauri) return;
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  await getCurrentWindow().hide();
}

async function handleExit() {
  if (!isTauri) return;
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("app_exit");
  } catch {}
}

async function handleCloseRequested() {
  const action = await getCloseAction();
  if (action === "hide") {
    await handleHide();
    return;
  }
  if (action === "exit") {
    await handleExit();
    return;
  }
  showDialog.value = true;
}

async function onDialogHide(remember: boolean) {
  if (remember) await saveCloseAction("hide");
  await handleHide();
}

async function onDialogExit(remember: boolean) {
  if (remember) await saveCloseAction("exit");
  await handleExit();
}

function preventRefresh(e: KeyboardEvent) {
  if (import.meta.env.PROD && (e.key === "F5" || (e.ctrlKey && e.key === "r"))) {
    e.preventDefault();
  }
}

onMounted(async () => {
  const splash = document.getElementById("splash");
  if (splash) {
    splash.classList.add("fade-out");
    splash.addEventListener("transitionend", () => splash.classList.add("gone"));
    setTimeout(() => splash.classList.add("gone"), 600);
  }

  if (isTauri) {
    window.addEventListener("keydown", preventRefresh);
    try {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      const unlistenFn = await (getCurrentWindow() as any).listen(
        "close-requested",
        () => {
          handleCloseRequested();
        }
      );
      unlisten = unlistenFn;
    } catch {}
  }
});

onUnmounted(() => {
  unlisten?.();
  if (isTauri) {
    window.removeEventListener("keydown", preventRefresh);
  }
});
</script>

<template>
  <div class="app-container">
    <TitleBar :username="username" @close-requested="handleCloseRequested" />
    <router-view v-slot="{ Component }">
      <transition name="page" mode="out-in">
        <component :is="Component" />
      </transition>
    </router-view>
    <CloseConfirmDialog
      v-model="showDialog"
      @hide="onDialogHide"
      @exit="onDialogExit"
    />
  </div>
</template>

<style>
:root {
  --font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  --radius-sm: 6px;
  --radius-md: 10px;
  --radius-lg: 16px;
  --radius-xl: 20px;
  --shadow-sm: 0 1px 2px rgba(0,0,0,0.06);
  --shadow-md: 0 2px 8px rgba(0,0,0,0.08);
  --space-xs: 4px;
  --space-sm: 8px;
  --space-md: 12px;
  --space-lg: 16px;
  --space-xl: 24px;
  --space-2xl: 32px;
  --bg-primary: #ffffff;
  --bg-secondary: #f5f5f7;
  --bg-tertiary: #eeeef0;
  --bg-elevated: #ffffff;
  --bg-input: #f5f5f7;
  --border: #e5e5e7;
  --border-light: #eeeef0;
  --text-primary: #1d1d1f;
  --text-secondary: #6e6e73;
  --text-muted: #aeaeb2;
  --accent: #2fb38b;
  --accent-hover: #269c77;
  --accent-light: #eaf7f2;
  --text-on-accent: #ffffff;
  --task-pending-bg: #f0f0f2;
  --task-pending-text: #86868b;
  --task-running-border: #2fb38b;
  --task-running-bg: #eaf7f2;
  --task-running-text: #2fb38b;
  --task-completed-border: #34c759;
  --task-completed-bg: #eefbf2;
  --task-completed-text: #248a3d;
  --task-failed-border: #ff3b30;
  --task-failed-bg: #fff1f0;
  --task-failed-text: #d70015;
  --task-reviewing-border: #5ac8fa;
  --task-reviewing-bg: rgba(90, 200, 250, 0.12);
  --task-reviewing-text: #32a0c4;
  --bubble-mine: #2fb38b;
  --bubble-mine-text: #ffffff;
  --bubble-other: #f0f0f2;
  --bubble-other-text: #1d1d1f;
  --badge-bg: #ff3b30;
  --role-leader-bg: #ff9500;
  --role-leader-text: #ffffff;
  --role-member-bg: #e5e5e7;
  --role-member-text: #6e6e73;
  --error: #ff3b30;
  --input-border: #d2d2d7;
  --sidebar-active: #eaf7f2;
  --sidebar-hover: #f0f0f2;
  --titlebar-text: #6e6e73;
  --online-dot: #34c759;
  --empty-icon: #d2d2d7;
  --md-code-bg: #f0f0f2;
  --md-code-text: #d63384;
  --md-pre-bg: #f5f5f7;
  --md-pre-text: #1d1d1f;
  --md-link-color: #2fb38b;
  --md-blockquote-border: #d2d2d7;
  --md-blockquote-text: #6e6e73;
  --glass-bg: rgba(255, 255, 255, 0.6);
  --glass-bg-heavy: rgba(255, 255, 255, 0.75);
  --glass-bg-light: rgba(255, 255, 255, 0.45);
  --glass-border: rgba(255, 255, 255, 0.3);
  --glass-blur: 20px;
  --glass-shadow: 0 4px 24px rgba(0, 0, 0, 0.06);
  --glass-shadow-heavy: 0 8px 40px rgba(0, 0, 0, 0.12);
  --overlay-bg: rgba(0, 0, 0, 0.3);
  --image-overlay-bg: rgba(0, 0, 0, 0.65);
  --image-toolbar-bg: rgba(255, 255, 255, 0.75);
  --image-toolbar-border: rgba(0, 0, 0, 0.08);
  --image-toolbar-btn: rgba(0, 0, 0, 0.65);
  --image-toolbar-btn-hover: rgba(0, 0, 0, 0.06);
  --image-toolbar-btn-active: #1d1d1f;
  --image-toolbar-text: rgba(0, 0, 0, 0.45);
  --image-toolbar-divider: rgba(0, 0, 0, 0.08);
  --image-toolbar-shadow: 0 4px 24px rgba(0, 0, 0, 0.12);
  --app-gradient: #f0f0f3;
  --warning: #ff9f0a;
  --warning-bg: rgba(255, 159, 10, 0.1);
  --warning-border: rgba(255, 159, 10, 0.3);
  --orb-1: rgba(47, 179, 139, 0.6);
  --orb-2: rgba(47, 179, 139, 0.45);
  --orb-3: rgba(47, 179, 139, 0.5);
  --orb-4: rgba(47, 179, 139, 0.4);
}

html.dark {
  --bg-primary: #0d0d0f;
  --bg-secondary: #161618;
  --bg-tertiary: #1c1c1e;
  --bg-elevated: #1c1c1e;
  --bg-input: #1c1c1e;
  --border: #2c2c2e;
  --border-light: #232325;
  --text-primary: #f5f5f7;
  --text-secondary: #98989d;
  --text-muted: #636366;
  --accent: #3dd9a5;
  --accent-hover: #5ee4b8;
  --accent-light: #152e24;
  --text-on-accent: #ffffff;
  --task-pending-bg: #1c1c1e;
  --task-pending-text: #98989d;
  --task-running-border: #3dd9a5;
  --task-running-bg: #0f241c;
  --task-running-text: #5ee4b8;
  --task-completed-border: #30d158;
  --task-completed-bg: #0d1f12;
  --task-completed-text: #30d158;
  --task-failed-border: #ff453a;
  --task-failed-bg: #1f0d0d;
  --task-failed-text: #ff453a;
  --task-reviewing-border: #64d2ff;
  --task-reviewing-bg: rgba(100, 210, 255, 0.1);
  --task-reviewing-text: #64d2ff;
  --bubble-mine: #3dd9a5;
  --bubble-mine-text: #ffffff;
  --bubble-other: #1c1c1e;
  --bubble-other-text: #f5f5f7;
  --badge-bg: #ff453a;
  --role-leader-bg: #ff9f0a;
  --role-leader-text: #1d1d1f;
  --role-member-bg: #2c2c2e;
  --role-member-text: #98989d;
  --error: #ff453a;
  --input-border: #3a3a3c;
  --sidebar-active: #152e24;
  --sidebar-hover: #1c1c1e;
  --titlebar-text: #98989d;
  --online-dot: #30d158;
  --empty-icon: #3a3a3c;
  --md-code-bg: #2c2c2e;
  --md-code-text: #ff6b9d;
  --md-pre-bg: #1c1c1e;
  --md-pre-text: #f5f5f7;
  --md-link-color: #3dd9a5;
  --md-blockquote-border: #3a3a3c;
  --md-blockquote-text: #98989d;
  --glass-bg: rgba(28, 28, 30, 0.6);
  --glass-bg-heavy: rgba(28, 28, 30, 0.75);
  --glass-bg-light: rgba(28, 28, 30, 0.45);
  --glass-border: rgba(255, 255, 255, 0.08);
  --glass-blur: 20px;
  --glass-shadow: 0 4px 24px rgba(0, 0, 0, 0.25);
  --glass-shadow-heavy: 0 8px 40px rgba(0, 0, 0, 0.4);
  --overlay-bg: rgba(0, 0, 0, 0.55);
  --image-overlay-bg: rgba(0, 0, 0, 0.85);
  --image-toolbar-bg: rgba(28, 28, 30, 0.85);
  --image-toolbar-border: rgba(255, 255, 255, 0.08);
  --image-toolbar-btn: rgba(255, 255, 255, 0.75);
  --image-toolbar-btn-hover: rgba(255, 255, 255, 0.1);
  --image-toolbar-btn-active: #fff;
  --image-toolbar-text: rgba(255, 255, 255, 0.5);
  --image-toolbar-divider: rgba(255, 255, 255, 0.1);
  --image-toolbar-shadow: 0 8px 32px rgba(0, 0, 0, 0.6);
  --app-gradient: #141416;
  --warning: #ffb340;
  --warning-bg: rgba(255, 179, 64, 0.1);
  --warning-border: rgba(255, 179, 64, 0.25);
  --orb-1: rgba(61, 217, 165, 0.3);
  --orb-2: rgba(61, 217, 165, 0.22);
  --orb-3: rgba(61, 217, 165, 0.25);
  --orb-4: rgba(61, 217, 165, 0.18);
}

html, body {
  margin: 0;
  padding: 0;
  height: 100%;
  overflow: hidden;
  background: var(--app-gradient);
  color: var(--text-primary);
  font-family: var(--font-sans);
  font-size: 14px;
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

#app {
  height: 100%;
}

.app-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
  position: relative;
  z-index: 1;
}

input, button, textarea {
  font-family: inherit;
  font-size: inherit;
}

::selection {
  background: var(--accent);
  color: var(--text-on-accent);
}

::-webkit-scrollbar {
  width: 6px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background: var(--border);
  border-radius: 3px;
}

::-webkit-scrollbar-thumb:hover {
  background: var(--text-muted);
}

.page-enter-active {
  transition:
    opacity 0.32s cubic-bezier(0.16, 1, 0.3, 1),
    transform 0.32s cubic-bezier(0.16, 1, 0.3, 1),
    filter 0.32s cubic-bezier(0.16, 1, 0.3, 1);
  will-change: opacity, transform, filter;
}

.page-leave-active {
  transition:
    opacity 0.18s cubic-bezier(0.4, 0, 1, 1),
    transform 0.18s cubic-bezier(0.4, 0, 1, 1),
    filter 0.18s cubic-bezier(0.4, 0, 1, 1);
  will-change: opacity, transform, filter;
}

.page-enter-from {
  opacity: 0;
  transform: scale(0.94);
  filter: blur(8px);
}

.page-leave-to {
  opacity: 0;
  transform: scale(0.97);
  filter: blur(4px);
}

@media (prefers-reduced-motion: reduce) {
  .page-enter-active,
  .page-leave-active {
    transition: opacity 0.1s ease;
  }
  .page-enter-from,
  .page-leave-to {
    transform: none;
    filter: none;
  }
}
</style>
