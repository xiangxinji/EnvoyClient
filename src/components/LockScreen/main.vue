<template>
  <Transition name="lock">
    <div v-if="locked" class="lock-screen">
      <div class="lock-card">
        <div class="lock-icon">
          <SvgIcon name="lock" :size="28" />
        </div>
        <h2 class="lock-title">{{ t('lock.title') }}</h2>
        <p class="lock-desc">{{ t('lock.desc') }}</p>
        <div class="lock-field">
          <input
            ref="passwordInput"
            v-model="password"
            type="password"
            class="lock-input"
            :placeholder="t('lock.enterPassword')"
            :disabled="verifying"
            @keydown.enter="handleUnlock"
          />
        </div>
        <p v-if="error" class="lock-error">{{ error }}</p>
        <p v-if="quitAttempted && !error" class="lock-warning">{{ t('lock.quitBlocked') }}</p>
        <button class="lock-btn" :disabled="verifying || !password" @click="handleUnlock">
          <span v-if="verifying" class="spinner"></span>
          <span>{{ verifying ? t('common.loading') : t('lock.unlock') }}</span>
        </button>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { ref, nextTick, watch } from "vue";
import { useI18n } from "vue-i18n";
import { getManagerUrl, managerFetch } from "../../api";
import { rsaEncrypt } from "../../utils/rsa";
import { useLockScreen } from "../../composables/useLockScreen";
import SvgIcon from "../SvgIcon";

const { t } = useI18n();
const { quitAttempted } = useLockScreen();

const props = defineProps<{
  locked: boolean;
  username: string;
}>();

const emit = defineEmits<{
  (e: "unlock"): void;
}>();

const password = ref("");
const error = ref("");
const verifying = ref(false);
const passwordInput = ref<HTMLInputElement | null>(null);

watch(() => props.locked, async (val) => {
  if (val) {
    password.value = "";
    error.value = "";
    await nextTick();
    passwordInput.value?.focus();
  }
});

async function handleUnlock() {
  if (!password.value || verifying.value) return;
  verifying.value = true;
  error.value = "";

  try {
    const base = getManagerUrl();
    const keyRes = await fetch(`${base}/api/public-key`);
    if (!keyRes.ok) throw new Error(t("role.fetchKeyFailed"));
    const { key: pubKey } = await keyRes.json();
    const encrypted = await rsaEncrypt(pubKey, password.value);

    await managerFetch("/api/auth/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: props.username, password: encrypted }),
    });

    emit("unlock");
  } catch (e: unknown) {
    error.value = t("lock.invalidPassword");
  } finally {
    verifying.value = false;
  }
}
</script>

<style scoped>
.lock-screen {
  position: absolute;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--overlay-bg);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
}

.lock-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-sm);
  background: var(--glass-bg-heavy);
  backdrop-filter: blur(var(--glass-blur));
  -webkit-backdrop-filter: blur(var(--glass-blur));
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-xl);
  padding: var(--space-xl) var(--space-2xl);
  min-width: 320px;
  box-shadow: var(--glass-shadow-heavy);
}

.lock-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: var(--accent-light);
  color: var(--accent);
  margin-bottom: var(--space-xs);
}

.lock-title {
  margin: 0;
  font-size: 1.1em;
  font-weight: 600;
  color: var(--text-primary);
}

.lock-desc {
  margin: 0;
  font-size: 0.85em;
  color: var(--text-secondary);
  text-align: center;
}

.lock-field {
  width: 100%;
  margin-top: var(--space-sm);
}

.lock-input {
  width: 100%;
  box-sizing: border-box;
  padding: 0 var(--space-md);
  height: 40px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--glass-bg-light);
  color: var(--text-primary);
  font-size: 0.9em;
  outline: none;
  transition: border-color 0.15s;
}

.lock-input::placeholder {
  color: var(--text-muted);
}

.lock-input:focus {
  border-color: var(--accent);
}

.lock-error {
  margin: 0;
  font-size: 0.82em;
  color: var(--error);
}

.lock-warning {
  margin: 0;
  font-size: 0.82em;
  color: var(--warning, #f59e0b);
  animation: shake 0.4s ease;
}

.lock-btn {
  margin-top: var(--space-sm);
  width: 100%;
  height: 40px;
  border: none;
  border-radius: var(--radius-sm);
  background: var(--accent);
  color: var(--text-on-accent);
  font-size: 0.9em;
  font-weight: 500;
  cursor: pointer;
  transition: opacity 0.15s;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-xs);
}

.lock-btn:hover:not(:disabled) {
  opacity: 0.9;
}

.lock-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.spinner {
  width: 14px;
  height: 14px;
  border: 2px solid var(--text-on-accent);
  border-top-color: transparent;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

@keyframes shake {
  0%, 100% { transform: translateX(0); }
  20% { transform: translateX(-6px); }
  40% { transform: translateX(6px); }
  60% { transform: translateX(-4px); }
  80% { transform: translateX(4px); }
}

.lock-enter-active {
  transition: opacity 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}
.lock-enter-active .lock-card {
  transition:
    transform 0.35s cubic-bezier(0.16, 1, 0.3, 1),
    filter 0.35s cubic-bezier(0.16, 1, 0.3, 1),
    opacity 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}
.lock-leave-active {
  transition: opacity 0.2s cubic-bezier(0.4, 0, 1, 1);
}
.lock-leave-active .lock-card {
  transition:
    transform 0.2s cubic-bezier(0.4, 0, 1, 1),
    filter 0.2s cubic-bezier(0.4, 0, 1, 1),
    opacity 0.2s cubic-bezier(0.4, 0, 1, 1);
}
.lock-enter-from {
  opacity: 0;
}
.lock-enter-from .lock-card {
  transform: scale(0.92);
  filter: blur(8px);
  opacity: 0;
}
.lock-leave-to {
  opacity: 0;
}
.lock-leave-to .lock-card {
  transform: scale(0.97);
  filter: blur(4px);
  opacity: 0;
}
</style>
