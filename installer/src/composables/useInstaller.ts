import { ref, computed } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import router from "../router";

const installPath = ref("");
const progress = ref(0);
const currentFile = ref("");
const error = ref("");
const isInstalling = ref(false);

export function useInstaller() {
  const canProceed = computed(() => installPath.value.length > 0);

  async function loadDefaultPath() {
    try {
      const path = await invoke<string>("get_default_install_path");
      installPath.value = path;
    } catch (_e: unknown) {
      installPath.value = "C:\\Users\\Default\\AppData\\Local\\Envoy";
    }
  }

  async function startInstall() {
    isInstalling.value = true;
    progress.value = 0;
    currentFile.value = "";
    error.value = "";

    const unlisten = await listen<{ percent: number; file: string }>("install-progress", (e) => {
      progress.value = e.payload.percent;
      currentFile.value = e.payload.file;
    });

    router.push("/installing");

    try {
      await invoke("start_install", { targetPath: installPath.value });
      progress.value = 100;
      await invoke("create_shortcuts", { installPath: installPath.value });
      await invoke("register_uninstaller", { installPath: installPath.value });
      router.push("/complete");
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : String(e);
    } finally {
      isInstalling.value = false;
      unlisten();
    }
  }

  async function cancelInstall() {
    try {
      await invoke("cancel_install");
    } catch {
      // ignore
    }
    router.push("/path");
  }

  async function launchApp() {
    try {
      await invoke("launch_app", { installPath: installPath.value });
    } catch {
      // ignore
    }
  }

  return {
    installPath,
    progress,
    currentFile,
    error,
    isInstalling,
    canProceed,
    loadDefaultPath,
    startInstall,
    cancelInstall,
    launchApp,
  };
}
