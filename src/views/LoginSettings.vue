<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import logo from "../assets/logo.png";

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
.settings-page {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
  background: var(--app-gradient);
  position: relative;
  overflow: hidden;
}

.settings-page::before {
  content: "";
  position: absolute;
  width: 450px;
  height: 450px;
  border-radius: 50%;
  background: var(--orb-1);
  filter: blur(60px);
  top: -100px;
  left: -80px;
  pointer-events: none;
  animation: float1 6s ease-in-out infinite;
}

.settings-page::after {
  content: "";
  position: absolute;
  width: 350px;
  height: 350px;
  border-radius: 50%;
  background: var(--orb-3);
  filter: blur(60px);
  bottom: -80px;
  right: -60px;
  pointer-events: none;
  animation: float2 5s ease-in-out infinite;
}

@keyframes float1 {
  0%, 100% { transform: translate(0, 0); }
  25% { transform: translate(80px, 60px); }
  50% { transform: translate(30px, 120px); }
  75% { transform: translate(-60px, 50px); }
}

@keyframes float2 {
  0%, 100% { transform: translate(0, 0); }
  25% { transform: translate(-70px, -80px); }
  50% { transform: translate(-100px, -20px); }
  75% { transform: translate(-20px, -90px); }
}

.card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-lg);
  width: 380px;
  padding: var(--space-2xl);
  background: var(--glass-bg-heavy);
  backdrop-filter: blur(var(--glass-blur));
  -webkit-backdrop-filter: blur(var(--glass-blur));
  border-radius: var(--radius-xl);
  border: 1px solid var(--glass-border);
  box-shadow: var(--glass-shadow);
}

.logo {
  width: 48px;
  height: 48px;
  border-radius: var(--radius-md);
  object-fit: cover;
}

h1 {
  margin: 0;
  font-size: 1.3em;
  font-weight: 700;
  color: var(--text-primary);
}

.fields {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
  width: 100%;
}

.field {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.field label {
  font-size: 0.8em;
  font-weight: 500;
  color: var(--text-secondary);
}

input {
  padding: 10px 14px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--input-border);
  background: var(--bg-input);
  color: var(--text-primary);
  outline: none;
  transition: border-color 0.15s;
  font-size: 0.9em;
}

input:focus {
  border-color: var(--accent);
}

input::placeholder {
  color: var(--text-muted);
}

.hint {
  font-size: 0.75em;
  color: var(--text-muted);
}

.actions {
  display: flex;
  gap: var(--space-sm);
  width: 100%;
}

.btn-back {
  flex: 1;
  padding: 10px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: var(--bg-primary);
  color: var(--text-secondary);
  font-size: 0.9em;
  cursor: pointer;
  transition: background 0.15s;
}

.btn-back:hover {
  background: var(--bg-secondary);
}

.btn-save {
  flex: 2;
  padding: 10px;
  border-radius: var(--radius-sm);
  border: none;
  background: var(--accent);
  color: white;
  font-weight: 600;
  font-size: 0.9em;
  cursor: pointer;
  transition: background 0.15s;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-xs);
}

.btn-save:hover {
  background: var(--accent-hover);
}

.check {
  font-size: 1em;
}

.error {
  color: var(--error);
  font-size: 0.8em;
  margin: 0;
}

</style>
