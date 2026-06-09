<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from "vue";
import TitleBar from "./components/TitleBar";
import CloseConfirmDialog from "./components/CloseConfirmDialog";
import SyncIndicator from "./components/SyncIndicator";
import { useTheme } from "./composables/useTheme";
import { useTeamClientInstance } from "./composables/teamClientContext";
import { useLockScreen } from "./composables/useLockScreen";
import { useScreenshot } from "./composables/useScreenshot";
import { cancelTaskbarAttention } from "./utils/notification";
import { isTauri } from "./utils/platform";

useTheme();

const instance = useTeamClientInstance();
const username = computed(() => instance.value?.myId ?? undefined);

const { locked, notifyQuitAttempt } = useLockScreen();
const { triggerScreenshot } = useScreenshot();

const showDialog = ref(false);

let unlisten: (() => void) | null = null;
let unlistenQuit: (() => void) | null = null;
let unlistenScreenshot: (() => void) | null = null;

async function getCloseAction(): Promise<string> {
  if (!isTauri) return "ask";
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    const settings = (await invoke("get_settings")) as Record<string, unknown>;
    return (settings.close_action as string) || "ask";
  } catch (e) {
    console.error("Failed to get close action:", e);
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
  } catch (e) {
    console.error("Failed to save close action:", e);
  }
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
  } catch (e) {
    console.error("Failed to exit app:", e);
  }
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

  window.addEventListener("focus", cancelTaskbarAttention);

  if (isTauri) {
    window.addEventListener("keydown", preventRefresh);
    try {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      const currentWindow = getCurrentWindow();

      // Show window after content is ready (avoids white flash)
      await currentWindow.show();

      const unlistenFn = await currentWindow.listen(
        "close-requested",
        () => {
          handleCloseRequested();
        }
      );
      unlisten = unlistenFn;

      const unlistenQuitFn = await currentWindow.listen(
        "quit-requested",
        () => {
          if (locked.value) {
            notifyQuitAttempt();
          } else {
            handleExit();
          }
        }
      );
      unlistenQuit = unlistenQuitFn;

      const unlistenScreenshotFn = await currentWindow.listen(
        "screenshot-requested",
        () => {
          triggerScreenshot();
        }
      );
      unlistenScreenshot = unlistenScreenshotFn;
    } catch (e) {
      console.error("Failed to setup window listeners:", e);
    }
  }
});

onUnmounted(() => {
  unlisten?.();
  unlistenQuit?.();
  unlistenScreenshot?.();
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
    <SyncIndicator />
  </div>
</template>

<style>
@import './App/styles.css';
</style>
