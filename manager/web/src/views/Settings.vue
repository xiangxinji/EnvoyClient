<script setup lang="ts">
import { ref, onMounted, watch, computed } from "vue";
import { useRouter } from "vue-router";
import { api } from "../api";

const router = useRouter();

// ─── Admin ───

const username = ref("");
const password = ref("");
const confirm = ref("");
const loading = ref(false);
const error = ref("");
const success = ref("");

onMounted(async () => {
  try {
    const profile = await api.getAdminProfile();
    username.value = profile.username;
  } catch {}

  try {
    const cfg = await api.getAIConfig();
    aiProvider.value = cfg.provider;
    aiModel.value = cfg.model;
    aiTemperature.value = cfg.temperature ?? 0.7;
    aiMaxTokens.value = cfg.maxTokens ?? 4096;
    aiConfigured.value = cfg.configured;
  } catch (e: any) {
    if (e.message?.includes("unauthorized")) {
      localStorage.removeItem("admin_token");
      router.push("/login");
      return;
    }
  }
});

async function handleSave() {
  const user = username.value.trim();
  const pass = password.value;
  const confirmPass = confirm.value;

  if (!user) {
    error.value = "用户名不能为空";
    return;
  }
  if (!pass || pass.length < 6) {
    error.value = "密码不能少于 6 位";
    return;
  }
  if (pass !== confirmPass) {
    error.value = "两次密码不一致";
    return;
  }

  loading.value = true;
  error.value = "";
  success.value = "";

  try {
    await api.updateAdmin(user, pass);
    success.value = "修改成功，请重新登录";
    setTimeout(() => {
      localStorage.removeItem("admin_token");
      router.push("/login");
    }, 1500);
  } catch (e: any) {
    error.value = e.message || "修改失败";
  } finally {
    loading.value = false;
  }
}

async function handleLogout() {
  if (!confirm("确定要退出登录吗？")) return;
  try {
    await api.adminLogout();
  } catch {}
  localStorage.removeItem("admin_token");
  router.push("/login");
}

// ─── AI Config ───

const PROVIDERS = [
  { id: "openai", label: "OpenAI", models: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "o1", "o1-mini", "o3-mini"] },
  { id: "anthropic", label: "Anthropic", models: ["claude-sonnet-4-20250514", "claude-haiku-4-20250414", "claude-opus-4-20250514"] },
  { id: "google", label: "Google", models: ["gemini-2.5-pro", "gemini-2.5-flash", "gemini-2.0-flash"] },
  { id: "deepseek", label: "DeepSeek", models: ["deepseek-chat", "deepseek-reasoner"] },
] as const;

const aiProvider = ref("openai");
const aiApiKey = ref("");
const aiModel = ref("gpt-4o");
const aiTemperature = ref(0.7);
const aiMaxTokens = ref(4096);
const aiConfigured = ref(false);
const aiLoading = ref(false);
const aiError = ref("");
const aiSuccess = ref("");

const availableModels = computed(() => {
  const found = PROVIDERS.find((p) => p.id === aiProvider.value);
  return found?.models ?? [];
});

watch(aiProvider, () => {
  aiModel.value = availableModels.value[0] ?? "";
});

async function handleAISave() {
  aiLoading.value = true;
  aiError.value = "";
  aiSuccess.value = "";

  try {
    const update: Record<string, any> = {
      provider: aiProvider.value,
      model: aiModel.value,
      temperature: aiTemperature.value,
      maxTokens: aiMaxTokens.value,
    };
    if (aiApiKey.value) {
      update.apiKey = aiApiKey.value;
    }

    const result = await api.updateAIConfig(update);
    aiConfigured.value = result.configured;
    aiApiKey.value = "";
    aiSuccess.value = "AI 配置已保存";
  } catch (e: any) {
    aiError.value = e.message || "保存失败";
  } finally {
    aiLoading.value = false;
  }
}
</script>

<template>
  <div class="settings-page">
    <h2>设置</h2>

    <div class="card">
      <h3>管理员账号</h3>
      <div class="fields">
        <div class="field">
          <label for="username">用户名</label>
          <input id="username" v-model="username" placeholder="管理员用户名" :disabled="loading" />
        </div>
        <div class="field">
          <label for="password">新密码</label>
          <input id="password" v-model="password" type="password" placeholder="输入新密码" :disabled="loading" />
        </div>
        <div class="field">
          <label for="confirm">确认密码</label>
          <input id="confirm" v-model="confirm" type="password" placeholder="再次输入密码" :disabled="loading" @keydown.enter="handleSave" />
        </div>
      </div>

      <div class="actions">
        <button class="save-btn" @click="handleSave" :disabled="loading">
          {{ loading ? "保存中..." : "保存" }}
        </button>
        <p v-if="error" class="error">{{ error }}</p>
        <p v-if="success" class="success">{{ success }}</p>
      </div>
    </div>

    <div class="card">
      <h3>AI 配置</h3>
      <div class="status-row">
        <span :class="['status-dot', aiConfigured ? 'active' : 'inactive']"></span>
        <span class="status-text">{{ aiConfigured ? "已配置" : "未配置" }}</span>
      </div>

      <div class="fields">
        <div class="field">
          <label for="ai-provider">服务商</label>
          <select id="ai-provider" v-model="aiProvider" :disabled="aiLoading">
            <option v-for="p in PROVIDERS" :key="p.id" :value="p.id">{{ p.label }}</option>
          </select>
        </div>

        <div class="field">
          <label for="ai-key">API Key {{ aiConfigured ? "(已设置，留空保持不变)" : "" }}</label>
          <input id="ai-key" v-model="aiApiKey" type="password" placeholder="sk-..." :disabled="aiLoading" />
        </div>

        <div class="field">
          <label for="ai-model">模型</label>
          <select id="ai-model" v-model="aiModel" :disabled="aiLoading">
            <option v-for="m in availableModels" :key="m" :value="m">{{ m }}</option>
          </select>
        </div>

        <div class="field">
          <label for="ai-temp">Temperature: {{ aiTemperature }}</label>
          <input id="ai-temp" v-model.number="aiTemperature" type="range" min="0" max="1" step="0.1" :disabled="aiLoading" />
        </div>

        <div class="field">
          <label for="ai-tokens">Max Tokens</label>
          <input id="ai-tokens" v-model.number="aiMaxTokens" type="number" min="256" max="32768" step="256" :disabled="aiLoading" />
        </div>
      </div>

      <div class="actions">
        <button class="save-btn" @click="handleAISave" :disabled="aiLoading">
          {{ aiLoading ? "保存中..." : "保存 AI 配置" }}
        </button>
        <p v-if="aiError" class="error">{{ aiError }}</p>
        <p v-if="aiSuccess" class="success">{{ aiSuccess }}</p>
      </div>
    </div>

    <div class="card">
      <h3>退出登录</h3>
      <p class="hint">退出当前管理员会话</p>
      <button class="logout-btn" @click="handleLogout">退出登录</button>
    </div>
  </div>
</template>

<style scoped>
.settings-page {
  max-width: 600px;
}

.settings-page h2 {
  font-size: 1.3em;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: var(--space-xl);
}

.card {
  background: var(--card-bg);
  border: 1px solid var(--card-border);
  border-radius: var(--radius-lg);
  padding: var(--space-xl);
  margin-bottom: var(--space-lg);
  box-shadow: var(--shadow-sm);
}

.card h3 {
  font-size: 1em;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: var(--space-lg);
}

.status-row {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  margin-bottom: var(--space-lg);
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.status-dot.active {
  background: var(--status-running);
}

.status-dot.inactive {
  background: var(--text-muted);
}

.status-text {
  font-size: 0.85em;
  color: var(--text-secondary);
}

.fields {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
  margin-bottom: var(--space-lg);
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

input, select {
  padding: 10px 14px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: var(--bg-primary);
  color: var(--text-primary);
  outline: none;
  transition: border-color 0.15s;
  font-size: 0.9em;
}

input:focus, select:focus {
  border-color: var(--accent);
}

input::placeholder {
  color: var(--text-muted);
}

input[type="range"] {
  padding: 0;
  border: none;
  height: 6px;
  -webkit-appearance: none;
  appearance: none;
  background: var(--border);
  border-radius: 3px;
  cursor: pointer;
}

input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--accent);
  cursor: pointer;
}

.actions {
  display: flex;
  align-items: center;
  gap: var(--space-md);
}

.save-btn {
  padding: 10px 24px;
  border-radius: var(--radius-sm);
  border: none;
  background: var(--accent);
  color: white;
  font-weight: 600;
  font-size: 0.9em;
  cursor: pointer;
  transition: background 0.15s;
}

.save-btn:hover {
  background: var(--accent-hover);
}

.save-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.error {
  color: var(--error);
  font-size: 0.8em;
  margin: 0;
}

.success {
  color: var(--status-running);
  font-size: 0.8em;
  margin: 0;
}

.hint {
  font-size: 0.85em;
  color: var(--text-muted);
  margin-bottom: var(--space-md);
}

.logout-btn {
  padding: 8px 20px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--error);
  background: transparent;
  color: var(--error);
  font-weight: 500;
  font-size: 0.9em;
  cursor: pointer;
  transition: all 0.15s;
}

.logout-btn:hover {
  background: var(--error);
  color: white;
}
</style>
