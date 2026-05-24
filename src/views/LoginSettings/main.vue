<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import logo from "../../assets/logo.png";
import { isTauri } from "../../utils/platform";
import GlassInput from "../../components/GlassInput";
import GlassButton from "../../components/GlassButton";
import { useMouseGradient } from "../../composables/useMouseGradient";

const { t } = useI18n();
const router = useRouter();

const managerUrl = ref("http://localhost:8080");
const saved = ref(false);
const error = ref("");
const cardRef = ref<HTMLElement | null>(null);
const { onMouseMove, onMouseLeave } = useMouseGradient(cardRef, {
  radius: 200,
  opacity: 0.12,
});

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
    <div ref="cardRef" class="card" @mousemove="onMouseMove" @mouseleave="onMouseLeave">
      <img :src="logo" class="logo" alt="Envoy" />
      <h1>{{ $t('loginSettings.title') }}</h1>

      <div class="fields">
        <div class="field">
          <label for="managerUrl">Manager URL</label>
          <GlassInput
            id="managerUrl"
            v-model="managerUrl"
            placeholder="http://localhost:8080"
            no-background
            @keydown.enter="handleSave"
          />
          <span class="hint">{{ $t('loginSettings.managerUrlHint') }}</span>
        </div>

      </div>

      <div class="actions">
        <GlassButton variant="default" @click="handleBack">{{ $t('common.back') }}</GlassButton>
        <GlassButton variant="primary" :loading="saved" @click="handleSave">
          <span v-if="saved" class="check">✓</span>
          <span>{{ saved ? $t('common.saved') : $t('common.save') }}</span>
        </GlassButton>
      </div>

      <p v-if="error" class="error">{{ error }}</p>
    </div>
  </div>
</template>

<style scoped>
@import './styles.css';
</style>
