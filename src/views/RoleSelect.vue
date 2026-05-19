<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { useLocale, type Locale } from "../i18n";
import { useTeamClient } from "../composables/useTeamClient";
import { setTeamClientInstance } from "../composables/teamClientContext";
import { setManagerUrl, setClientToken } from "../api";
import GlassSelect from "../components/GlassSelect.vue";
import logo from "../assets/logo.png";
const { t } = useI18n();
const { locale, switchLocale, loadFromSettings } = useLocale();
const currentLocale = ref(locale.value as Locale);

function handleLangChange(val: string) {
  currentLocale.value = val as Locale;
  switchLocale(val as Locale);
}

const isTauri = "__TAURI_INTERNALS__" in window;

const router = useRouter();

const managerUrl = ref("http://localhost:8080");
const username = ref("");
const password = ref("");
const loading = ref(false);
const error = ref("");
const role = ref<"leader" | "member">("member");
const teams = ref<{ name: string; port: number }[]>([]);
const selectedTeam = ref("");
const authenticated = ref(false);

async function loadSettings() {
  await loadFromSettings();
  currentLocale.value = locale.value as Locale;
  if (!isTauri) {
    // Browser mode: just use default
    return;
  }
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    const settings = (await invoke("get_settings")) as any;
    if (settings?.env?.manager_url) managerUrl.value = settings.env.manager_url;
    if (settings?.last_login) {
      const { username: savedUser, team: savedTeam } = settings.last_login;
      if (savedUser) username.value = savedUser;
      if (savedTeam) selectedTeam.value = savedTeam;
      // Load password from OS keychain
      const account = `${savedUser}|${managerUrl.value}`;
      try {
        const pass = (await invoke("get_credential", { account })) as string;
        if (pass) password.value = pass;
      } catch {
        // Credential not found in keychain, ignore
      }
    }
  } catch {}
}

async function rsaEncrypt(publicKeyPem: string, plaintext: string): Promise<string> {
  const binaryDer = pemToArrayBuffer(publicKeyPem);
  const key = await crypto.subtle.importKey("spki", binaryDer, { name: "RSA-OAEP", hash: "SHA-256" }, false, ["encrypt"]);
  const encoded = new TextEncoder().encode(plaintext);
  const encrypted = await crypto.subtle.encrypt({ name: "RSA-OAEP" }, key, encoded);
  return btoa(String.fromCharCode(...new Uint8Array(encrypted)));
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const b64 = pem.replace(/-----BEGIN.*?-----/, "").replace(/-----END.*?-----/, "").replace(/\s/g, "");
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

async function handleLogin() {
  const user = username.value.trim();
  const pass = password.value;
  if (!user || !pass) {
    error.value = t("role.enterUserAndPass");
    return;
  }

  loading.value = true;
  error.value = "";

  try {
    const base = managerUrl.value.trim();

    // Fetch server public key and encrypt password
    const keyRes = await fetch(`${base}/api/public-key`);
    if (!keyRes.ok) throw new Error(t("role.fetchKeyFailed"));
    const { key: pubKey } = await keyRes.json();
    const encrypted = await rsaEncrypt(pubKey, pass);

    const res = await fetch(`${base}/api/auth`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: user, password: encrypted }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: t("role.authFailed") }));
      throw new Error(err.error || t("role.authFailed"));
    }

    const data = await res.json();
    role.value = data.role;

    // Store client token for authenticated API calls
    if (data.token) setClientToken(data.token);

    // Save credentials + initialize workspace
    if (isTauri) {
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        const account = `${user}|${base}`;
        await invoke("save_credential", { account, password: pass });
        const settings = (await invoke("get_settings")) as any;
        settings.last_login = { username: user, team: selectedTeam.value || null };
        await invoke("save_settings", { settings });
        await invoke("init_brains", { username: user });
        await invoke("init_workspace", { username: user });
      } catch (e) {
        console.warn("save credentials / init workspace failed:", e);
      }
    }

    const user = username.value.trim();
    const teamsRes = await fetch(`${base}/api/teams?username=${encodeURIComponent(user)}`);
    const teamsData = await teamsRes.json();
    teams.value = teamsData.map((t: { name: string; port: number }) => ({ name: t.name, port: t.port }));

    if (teams.value.length === 0) {
      error.value = t("role.noTeams");
      loading.value = false;
      return;
    }

    if (!teams.value.find((t) => t.name === selectedTeam.value)) {
      selectedTeam.value = teams.value[0].name;
    }
    authenticated.value = true;
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : String(e);
  } finally {
    loading.value = false;
  }
}

async function handleConnect() {
  const team = teams.value.find((t) => t.name === selectedTeam.value);
  if (!team) return;

  loading.value = true;
  error.value = "";

  try {
    setManagerUrl(managerUrl.value.trim());
    const url = new URL(managerUrl.value.trim());
    const wsUrl = `ws://${url.hostname}:${team.port}`;

    const teamClient = useTeamClient(role.value, {
      id: username.value.trim(),
      servers: [wsUrl],
      teamName: team.name,
    });

    await teamClient.connect();
    setTeamClientInstance(teamClient);

    // Update last selected team
    if (isTauri) {
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        const settings = (await invoke("get_settings")) as any;
        if (settings.last_login) {
          settings.last_login.team = team.name;
          await invoke("save_settings", { settings });
        }
      } catch {}
    }

    router.push("/chat");
  } catch (e) {
    error.value = e instanceof Error ? e.message : t("role.connectFailed");
    loading.value = false;
  }
}

function handleLogout() {
  authenticated.value = false;
  teams.value = [];
  selectedTeam.value = "";
  error.value = "";
}

onMounted(loadSettings);

</script>

<template>
  <div class="role-select">
    <div class="orb orb-1"></div>
    <div class="orb orb-2"></div>
    <div class="orb orb-3"></div>
    <div class="locale-switch">
      <GlassSelect v-model="currentLocale" @update:model-value="handleLangChange">
        <option value="zh-CN">简体中文</option>
        <option value="en">English</option>
      </GlassSelect>
    </div>
    <div class="card">
      <img :src="logo" class="logo" alt="Envoy" />
      <h1>Envoy</h1>
      <p class="subtitle">{{ $t('role.subtitle') }}</p>

      <!-- Step 1: Login -->
      <template v-if="!authenticated">
        <div class="fields">
          <div class="field">
            <label for="username">{{ $t('role.username') }}</label>
            <input id="username" v-model="username" :placeholder="$t('role.enterUsername')" :disabled="loading" @keydown.enter="handleLogin" />
          </div>
          <div class="field">
            <label for="password">{{ $t('role.password') }}</label>
            <input id="password" v-model="password" type="password" :placeholder="$t('role.enterPassword')" :disabled="loading" @keydown.enter="handleLogin" />
          </div>
        </div>

        <button class="connect-btn" @click="handleLogin" :disabled="loading">
          <span v-if="loading" class="spinner"></span>
          <span>{{ loading ? $t("role.loggingIn") : $t("role.login") }}</span>
        </button>

        <button class="btn-settings" @click="router.push('/settings')">{{ $t('common.settings') }}</button>
      </template>

      <!-- Step 2: Select team -->
      <template v-else>
        <div class="auth-info">
          <span class="auth-user">{{ username }}</span>
          <span class="role-badge" :class="role">{{ role }}</span>
          <button class="btn-logout" @click="handleLogout">{{ $t('role.logout') }}</button>
        </div>

        <div class="fields">
          <div class="field">
            <label>{{ $t('role.selectTeam') }}</label>
            <GlassSelect v-model="selectedTeam" :disabled="loading">
              <option v-for="t in teams" :key="t.name" :value="t.name">
                {{ t.name }}
              </option>
            </GlassSelect>
          </div>
        </div>

        <button class="connect-btn" @click="handleConnect" :disabled="loading">
          <span v-if="loading" class="spinner"></span>
          <span>{{ loading ? $t("role.connecting") : $t("role.connect") }}</span>
        </button>
      </template>

      <p v-if="error" class="error">{{ error }}</p>
    </div>
  </div>
</template>

<style scoped>
.role-select {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
  background: var(--app-gradient);
  position: relative;
  overflow: hidden;
}

/* Shared orb base — positioned at corners, breathing toward center */
.orb {
  position: absolute;
  border-radius: 50%;
  pointer-events: none;
  z-index: 0;
  will-change: transform, opacity;
}

/* Top-left orb → breathes down-right toward center */
.orb-1 {
  width: 500px;
  height: 500px;
  background: var(--orb-1);
  filter: blur(60px);
  top: -120px;
  left: -100px;
  animation: breathe-1 8s cubic-bezier(0.37, 0, 0.63, 1) infinite;
}

/* Bottom-right orb → breathes up-left toward center */
.orb-2 {
  width: 400px;
  height: 400px;
  background: var(--orb-3);
  filter: blur(60px);
  bottom: -100px;
  right: -80px;
  animation: breathe-2 7s cubic-bezier(0.37, 0, 0.63, 1) infinite;
  animation-delay: -3s;
}

/* Center-hint orb — subtle ambient glow */
.orb-3 {
  width: 300px;
  height: 300px;
  background: var(--orb-2);
  filter: blur(50px);
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%) scale(0.6);
  opacity: 0.3;
  animation: breathe-3 9s cubic-bezier(0.37, 0, 0.63, 1) infinite;
  animation-delay: -1.5s;
}

/*
 * Breathing keyframes — simulate lung inhale / hold / exhale / rest:
 *   0%  – rest (small, at anchor position)
 *   40% – full inhale (expanded, drifted toward center)
 *   50% – hold at peak
 *   90% – full exhale back to rest
 *  100% – brief rest before next cycle
 */
@keyframes breathe-1 {
  0%, 100% {
    transform: scale(0.75);
    opacity: 0.45;
  }
  40% {
    transform: scale(1.15) translate(100px, 80px);
    opacity: 0.75;
  }
  50% {
    transform: scale(1.15) translate(100px, 80px);
    opacity: 0.75;
  }
  90% {
    transform: scale(0.75);
    opacity: 0.45;
  }
}

@keyframes breathe-2 {
  0%, 100% {
    transform: scale(0.75);
    opacity: 0.45;
  }
  40% {
    transform: scale(1.15) translate(-90px, -70px);
    opacity: 0.75;
  }
  50% {
    transform: scale(1.15) translate(-90px, -70px);
    opacity: 0.75;
  }
  90% {
    transform: scale(0.75);
    opacity: 0.45;
  }
}

@keyframes breathe-3 {
  0%, 100% {
    transform: translate(-50%, -50%) scale(0.55);
    opacity: 0.25;
  }
  40% {
    transform: translate(-50%, -50%) scale(0.95);
    opacity: 0.5;
  }
  50% {
    transform: translate(-50%, -50%) scale(0.95);
    opacity: 0.5;
  }
  90% {
    transform: translate(-50%, -50%) scale(0.55);
    opacity: 0.25;
  }
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
  position: relative;
  z-index: 1;
}

.logo {
  width: 72px;
  height: 72px;
  border-radius: var(--radius-lg);
  object-fit: cover;
}

h1 {
  margin: 0;
  font-size: 1.5em;
  font-weight: 700;
  color: var(--text-primary);
  letter-spacing: -0.3px;
}

.subtitle {
  margin: 0;
  margin-top: -8px;
  font-size: 0.85em;
  color: var(--text-muted);
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
  padding: 0 14px;
  height: 36px;
  box-sizing: border-box;
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

.auth-info {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  width: 100%;
  padding: var(--space-md);
  box-sizing: border-box;
  background: var(--glass-bg-light);
  border-radius: var(--radius-md);
  border: 1px solid var(--glass-border);
}

.auth-user {
  font-weight: 600;
  color: var(--text-primary);
  flex: 1;
}

.role-badge {
  font-size: 0.75em;
  padding: 2px 8px;
  border-radius: 10px;
  font-weight: 500;
}

.role-badge.leader {
  background: var(--warning-bg);
  color: var(--warning);
}

.role-badge.member {
  background: var(--accent-light);
  color: var(--accent);
}

.btn-logout {
  background: none;
  border: none;
  color: var(--text-muted);
  font-size: 0.8em;
  cursor: pointer;
  padding: 2px 6px;
}

.btn-logout:hover {
  color: var(--error);
}

.connect-btn {
  width: 100%;
  padding: 12px;
  border-radius: var(--radius-sm);
  border: none;
  background: var(--accent);
  color: var(--text-on-accent);
  font-weight: 600;
  font-size: 0.95em;
  cursor: pointer;
  transition: background 0.15s;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-sm);
}

.connect-btn:hover {
  background: var(--accent-hover);
}

.connect-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.spinner {
  width: 14px;
  height: 14px;
  border: 2px solid var(--glass-border);
  border-top-color: var(--text-on-accent);
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.error {
  color: var(--error);
  font-size: 0.8em;
  margin: 0;
}

.btn-settings {
  background: none;
  border: none;
  color: var(--text-muted);
  font-size: 0.8em;
  cursor: pointer;
  padding: 0;
  transition: color 0.15s;
}

.btn-settings:hover {
  color: var(--text-secondary);
}

.locale-switch {
  position: absolute;
  top: var(--space-md);
  right: var(--space-md);
  z-index: 2;
  width: 100px;
  opacity: 0.45;
  transition: opacity 0.2s;
}

.locale-switch:hover {
  opacity: 1;
}

.locale-switch :deep(.glass-select-trigger) {
  height: 28px;
  font-size: 0.75em;
  padding: 0 10px;
  border-radius: var(--radius-sm);
}

.locale-switch :deep(.glass-select-option) {
  font-size: 0.78em;
  padding: 6px 10px;
}
</style>
