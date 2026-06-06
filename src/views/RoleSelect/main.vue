<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useRouter } from "vue-router";
import { type Locale } from "../../i18n";
import { getSystemSettingService } from "../../composables/teamClientContext";
import { useAuth } from "../../composables/useAuth";
import { useMouseGradient } from "../../composables/useMouseGradient";
import GlassSelect from "../../components/GlassSelect";
import GlassInput from "../../components/GlassInput";
import GlassButton from "../../components/GlassButton";
import logo from "../../assets/logo.png";

const router = useRouter();
const sysSettings = getSystemSettingService();
const currentLocale = ref(sysSettings.locale as Locale);

function handleLangChange(val: string) {
  currentLocale.value = val as Locale;
  sysSettings.switchLocale(val as Locale);
}

const cardRef = ref<HTMLElement | null>(null);
const { onMouseMove, onMouseLeave } = useMouseGradient(cardRef, { radius: 200, opacity: 0.12 });

const {
  username, password, loading, error,
  role, teams, selectedTeam, authenticated,
  loadSettings, handleLogin, handleConnect, handleLogout,
} = useAuth({ router });

onMounted(() => loadSettings(sysSettings, currentLocale));
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
    <div ref="cardRef" class="card" @mousemove="onMouseMove" @mouseleave="onMouseLeave">
      <img :src="logo" class="logo" alt="Envoy" />
      <h1>Envoy</h1>
      <p class="subtitle">{{ $t('role.subtitle') }}</p>

      <!-- Step 1: Login -->
      <template v-if="!authenticated">
        <div class="fields">
          <div class="field">
            <label for="username">{{ $t('role.username') }}</label>
            <GlassInput id="username" v-model="username" :placeholder="$t('role.enterUsername')" :disabled="loading" @keydown.enter="handleLogin" />
          </div>
          <div class="field">
            <label for="password">{{ $t('role.password') }}</label>
            <div class="password-field">
              <GlassInput id="password" v-model="password" type="password" :placeholder="$t('role.enterPassword')" :disabled="loading" clearable @keydown.enter="handleLogin" />
            </div>
          </div>
        </div>

        <GlassButton variant="primary" class="connect-btn" :disabled="loading" :loading="loading" @click="handleLogin">
          <span>{{ loading ? $t("role.loggingIn") : $t("role.login") }}</span>
        </GlassButton>

        <GlassButton variant="default" class="btn-settings" @click="router.push('/settings')">{{ $t('common.settings') }}</GlassButton>
      </template>

      <!-- Step 2: Select team -->
      <template v-else>
        <div class="auth-info">
          <span class="auth-user">{{ username }}</span>
          <span class="role-badge" :class="role">{{ role }}</span>
          <GlassButton variant="default" class="btn-logout" @click="handleLogout">{{ $t('role.logout') }}</GlassButton>
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

        <GlassButton variant="primary" class="connect-btn" :disabled="loading" :loading="loading" @click="handleConnect">
          <span>{{ loading ? $t("role.connecting") : $t("role.connect") }}</span>
        </GlassButton>
      </template>

      <p v-if="error" class="error">{{ error }}</p>
    </div>
  </div>
</template>

<style scoped>
@import './styles.css';
</style>
