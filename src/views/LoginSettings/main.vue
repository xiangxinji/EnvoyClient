<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import logo from "../../assets/logo.png";

const { t } = useI18n();

const isTauri = "__TAURI_INTERNALS__" in window;
const router = useRouter();

const managerUrl = ref("http://localhost:8080");
const saved = ref(false);
const error = ref("");

async function loadSettings() {
  if (!isTauri) return;
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    const settings = (await invoke("get_settings")) as any;
    if (settings?.env?.manager_url) managerUrl.value = settings.env.manager_url;
  } catch {}
}

async function handleSave() {
  const url = managerUrl.value.trim();
  if (!url) {
    error.value = t('loginSettings.managerUrl');
    return;
  }

  try {
    new URL(url);
  } catch {
    error.value = t('loginSettings.invalidUrl');
    return;
  }

  if (!isTauri) {
    router.push("/");
    return;
  }

  try {
    const { invoke } = await import("@tauri-apps/api/core");
    const settings = (await invoke("get_settings")) as any;
    settings.env = settings.env || {};
    settings.env.manager_url = url;
    await invoke("save_settings", { settings });
    saved.value = true;
    error.value = "";
    setTimeout(() => (saved.value = false), 1500);
  } catch (e) {
    error.value = t('loginSettings.saveFailed');
  }
}

function handleBack() {
  router.push("/");
}

onMounted(loadSettings);
</script>

<template>
  <div class="settings-page">
    <div class="card">
      <img :src="logo" class="logo" alt="Envoy" />
      <h1>{{ $t('loginSettings.title') }}</h1>

      <div class="fields">
        <div class="field">
          <label for="managerUrl">Manager URL</label>
          <input
            id="managerUrl"
            v-model="managerUrl"
            placeholder="http://localhost:8080"
            @keydown.enter="handleSave"
          />
          <span class="hint">{{ $t('loginSettings.managerUrlHint') }}</span>
        </div>

      </div>

      <div class="actions">
        <button class="btn-back" @click="handleBack">{{ $t('common.back') }}</button>
        <button class="btn-save" @click="handleSave">
          <span v-if="saved" class="check">✓</span>
          <span>{{ saved ? $t('common.saved') : $t('common.save') }}</span>
        </button>
      </div>

      <p v-if="error" class="error">{{ error }}</p>
    </div>
  </div>
</template>

<style scoped>
@import './styles.css';
</style>
