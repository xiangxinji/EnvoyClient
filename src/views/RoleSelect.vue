<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useRouter } from "vue-router";
import { useTeamClient } from "../composables/useTeamClient";
import { setTeamClientInstance } from "../composables/teamClientContext";
import { setManagerUrl, setClientToken } from "../api";
import logo from "../assets/logo.png";
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
    error.value = "请输入用户名和密码";
    return;
  }

  loading.value = true;
  error.value = "";

  try {
    const base = managerUrl.value.trim();

    // Fetch server public key and encrypt password
    const keyRes = await fetch(`${base}/api/public-key`);
    if (!keyRes.ok) throw new Error("获取公钥失败");
    const { key: pubKey } = await keyRes.json();
    const encrypted = await rsaEncrypt(pubKey, pass);

    const res = await fetch(`${base}/api/auth`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: user, password: encrypted }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "认证失败" }));
      throw new Error(err.error || "认证失败");
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

    const teamsRes = await fetch(`${base}/api/teams`);
    const teamsData = await teamsRes.json();
    teams.value = teamsData.map((t: { name: string; port: number }) => ({ name: t.name, port: t.port }));

    if (teams.value.length === 0) {
      error.value = "暂无可用的团队，请先在 Manager 中创建";
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
    error.value = e instanceof Error ? e.message : "连接失败";
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
    <div class="card">
      <img :src="logo" class="logo" alt="Envoy" />
      <h1>Envoy</h1>
      <p class="subtitle">团队协作客户端</p>

      <!-- Step 1: Login -->
      <template v-if="!authenticated">
        <div class="fields">
          <div class="field">
            <label for="username">用户名</label>
            <input id="username" v-model="username" placeholder="输入用户名" :disabled="loading" @keydown.enter="handleLogin" />
          </div>
          <div class="field">
            <label for="password">密码</label>
            <input id="password" v-model="password" type="password" placeholder="输入密码" :disabled="loading" @keydown.enter="handleLogin" />
          </div>
        </div>

        <button class="connect-btn" @click="handleLogin" :disabled="loading">
          <span v-if="loading" class="spinner"></span>
          <span>{{ loading ? "登录中..." : "登录" }}</span>
        </button>

        <button class="btn-settings" @click="router.push('/settings')">设置</button>
      </template>

      <!-- Step 2: Select team -->
      <template v-else>
        <div class="auth-info">
          <span class="auth-user">{{ username }}</span>
          <span class="role-badge" :class="role">{{ role }}</span>
          <button class="btn-logout" @click="handleLogout">退出</button>
        </div>

        <div class="fields">
          <div class="field">
            <label>选择团队</label>
            <select v-model="selectedTeam" :disabled="loading">
              <option v-for="t in teams" :key="t.name" :value="t.name">
                {{ t.name }}
              </option>
            </select>
          </div>
        </div>

        <button class="connect-btn" @click="handleConnect" :disabled="loading">
          <span v-if="loading" class="spinner"></span>
          <span>{{ loading ? "连接中..." : "连接" }}</span>
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
  background: var(--bg-primary);
  position: relative;
}

.role-select::before {
  content: "";
  position: absolute;
  inset: 0;
  background:
    radial-gradient(ellipse at 20% 50%, rgba(47, 179, 139, 0.15), transparent 50%),
    radial-gradient(ellipse at 80% 20%, rgba(47, 179, 139, 0.1), transparent 50%);
  pointer-events: none;
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
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.08);
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

input,
select {
  padding: 10px 14px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--input-border);
  background: var(--bg-input);
  color: var(--text-primary);
  outline: none;
  transition: border-color 0.15s;
  font-size: 0.9em;
}

input:focus,
select:focus {
  border-color: var(--accent);
}

input::placeholder {
  color: var(--text-muted);
}

select {
  cursor: pointer;
}

.auth-info {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  width: 100%;
  padding: var(--space-md);
  background: var(--bg-primary);
  border-radius: var(--radius-md);
  border: 1px solid var(--border);
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
  background: rgba(255, 159, 10, 0.12);
  color: #ff9f0a;
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
  color: white;
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
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
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
</style>
