<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useRouter } from "vue-router";
import { api } from "../api";

const router = useRouter();
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
  try {
    await api.adminLogout();
  } catch {}
  localStorage.removeItem("admin_token");
  router.push("/login");
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

input {
  padding: 10px 14px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: var(--bg-primary);
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
