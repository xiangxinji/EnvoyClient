<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";
import { useTeamClient } from "../composables/useTeamClient";
import { setTeamClientInstance } from "../composables/teamClientContext";
import logo from "../assets/logo.png";

const router = useRouter();

const role = ref<"leader" | "member">("member");
const clientId = ref("");
const password = ref("");
const serverUrl = ref("ws://localhost:3000");
const managerUrl = ref("http://localhost:8080");
const loading = ref(false);
const error = ref("");
const idError = ref("");
const urlError = ref("");

function validate(): boolean {
  idError.value = "";
  urlError.value = "";
  let valid = true;

  if (!clientId.value.trim()) {
    idError.value = "请输入 Client ID";
    valid = false;
  }

  const url = serverUrl.value.trim();
  if (!url.startsWith("ws://") && !url.startsWith("wss://")) {
    urlError.value = "URL 需要以 ws:// 或 wss:// 开头";
    valid = false;
  }

  return valid;
}

async function handleConnect() {
  if (!validate()) return;

  loading.value = true;
  error.value = "";

  try {
    // Auth via Manager HTTP API
    const res = await fetch(`${managerUrl.value.trim()}/api/auth`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: clientId.value.trim(),
        password: password.value,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "认证失败" }));
      throw new Error(err.error || "认证失败");
    }

    const teamClient = useTeamClient(role.value, {
      id: clientId.value.trim(),
      servers: [serverUrl.value.trim()],
    });

    await teamClient.connect();
    setTeamClientInstance(teamClient);
    router.push("/chat");
  } catch (e) {
    error.value = e instanceof Error ? e.message : "Connection failed";
    loading.value = false;
  }
}
</script>

<template>
  <div class="role-select">
    <div class="card">
      <img :src="logo" class="logo" alt="Envoy" />
      <h1>Envoy</h1>
      <p class="subtitle">团队协作客户端</p>

      <div class="role-cards">
        <div
          class="role-card"
          :class="{ active: role === 'leader' }"
          @click="role = 'leader'"
        >
          <div class="role-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
          </div>
          <span class="role-label">Leader</span>
        </div>
        <div
          class="role-card"
          :class="{ active: role === 'member' }"
          @click="role = 'member'"
        >
          <div class="role-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </div>
          <span class="role-label">Member</span>
        </div>
      </div>

      <div class="fields">
        <div class="field">
          <label for="client-id">用户名</label>
          <input id="client-id" v-model="clientId" placeholder="例如 alice" :disabled="loading" />
          <span v-if="idError" class="error">{{ idError }}</span>
        </div>

        <div class="field">
          <label for="password">密码</label>
          <input id="password" v-model="password" type="password" placeholder="输入密码" :disabled="loading" />
        </div>

        <div class="field">
          <label for="server-url">Server URL</label>
          <input id="server-url" v-model="serverUrl" placeholder="ws://localhost:3001" :disabled="loading" />
          <span v-if="urlError" class="error">{{ urlError }}</span>
        </div>

        <div class="field">
          <label for="manager-url">Manager URL</label>
          <input id="manager-url" v-model="managerUrl" placeholder="http://localhost:8080" :disabled="loading" />
        </div>
      </div>

      <button class="connect-btn" @click="handleConnect" :disabled="loading">
        <span v-if="loading" class="spinner"></span>
        <span>{{ loading ? "连接中..." : "连接" }}</span>
      </button>

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
}

.card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-lg);
  width: 380px;
  padding: var(--space-2xl);
  background: var(--bg-elevated);
  border-radius: var(--radius-xl);
  border: 1px solid var(--border);
  box-shadow: var(--shadow-md);
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

.role-cards {
  display: flex;
  gap: var(--space-md);
  width: 100%;
}

.role-card {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-lg);
  border-radius: var(--radius-md);
  border: 2px solid var(--border);
  background: var(--bg-primary);
  cursor: pointer;
  transition: all 0.15s ease;
}

.role-card:hover {
  border-color: var(--text-muted);
}

.role-card.active {
  border-color: var(--accent);
  background: var(--accent-light);
}

.role-icon {
  color: var(--text-muted);
}

.role-card.active .role-icon {
  color: var(--accent);
}

.role-label {
  font-size: 0.9em;
  font-weight: 600;
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
}

input:focus {
  border-color: var(--accent);
}

input::placeholder {
  color: var(--text-muted);
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
  border: 2px solid rgba(255,255,255,0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.error {
  color: var(--error);
  font-size: 0.8em;
  margin: 0;
}
</style>
