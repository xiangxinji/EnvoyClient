<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { type Locale } from "../../i18n";
import { getSystemSettingService } from "../../composables/teamClientContext";
import { useTeamClient } from "../../composables/useTeamClient";
import { setTeamClientInstance } from "../../composables/teamClientContext";
import { setManagerUrl, setClientToken } from "../../api";
import { rsaEncrypt } from "../../utils/rsa";
import GlassSelect from "../../components/GlassSelect";
import logo from "../../assets/logo.png";
import { isTauri } from "../../utils/platform";
import { getErrorMessage } from "../../utils/error";
const { t } = useI18n();
const sysSettings = getSystemSettingService();
const currentLocale = ref(sysSettings.locale as Locale);

function handleLangChange(val: string) {
  currentLocale.value = val as Locale;
  sysSettings.switchLocale(val as Locale);
}

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
  await sysSettings.loadLocaleFromSettings();
  currentLocale.value = sysSettings.locale as Locale;
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
    error.value = getErrorMessage(e);
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
    error.value = getErrorMessage(e) || t("role.connectFailed");
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
@import './styles.css';
</style>
