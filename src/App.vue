<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from "vue";
import TitleBar from "./components/TitleBar";
import CloseConfirmDialog from "./components/CloseConfirmDialog";
import { useTheme } from "./composables/useTheme";
import { useTeamClientInstance } from "./composables/teamClientContext";
import { cancelTaskbarAttention } from "./utils/notification";

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

function preventContextMenu(e: MouseEvent) {
  e.preventDefault();
}

onMounted(async () => {
  const splash = document.getElementById("splash");
  if (splash) {
    splash.classList.add("fade-out");
    splash.addEventListener("transitionend", () => splash.classList.add("gone"));
    setTimeout(() => splash.classList.add("gone"), 600);
  }

  // window.addEventListener("contextmenu", preventContextMenu);
  // window.addEventListener("focus", cancelTaskbarAttention);

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
  window.removeEventListener("contextmenu", preventContextMenu);
  window.removeEventListener("focus", cancelTaskbarAttention);
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
@import './styles/variables.css';

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
