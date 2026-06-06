<template>
  <Transition name="lock">
    <div v-if="locked" class="lock-screen">
      <div ref="lockCardRef" class="lock-card" @mousemove="onMouseMove" @mouseleave="onMouseLeave">
        <div class="lock-icon">
          <SvgIcon name="lock" :size="28" />
        </div>
        <h2 class="lock-title">{{ t('lock.title') }}</h2>
        <p class="lock-desc">{{ t('lock.desc') }}</p>
        <div class="lock-field">
          <GlassInput
            ref="passwordInput"
            v-model="password"
            type="password"
            :placeholder="t('lock.enterPassword')"
            @keydown.enter="handleUnlock"
          />
        </div>
        <p v-if="error" class="lock-error">{{ error }}</p>
        <p v-if="quitAttempted && !error" class="lock-warning">{{ t('lock.quitBlocked') }}</p>
        <GlassButton
          variant="primary"
          class="lock-btn"
          :disabled="!password"
          :loading="verifying"
          @click="handleUnlock"
        >
          <span>{{ verifying ? t('common.loading') : t('lock.unlock') }}</span>
        </GlassButton>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { ref, nextTick, watch } from "vue";
import { useI18n } from "vue-i18n";
import { verifyPassword } from "../../services/AuthService";
import { useLockScreen } from "../../composables/useLockScreen";
import { useMouseGradient } from "../../composables/useMouseGradient";
import GlassInput from "../GlassInput";
import GlassButton from "../GlassButton";
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
const passwordInput = ref<InstanceType<typeof GlassInput> | null>(null);
const lockCardRef = ref<HTMLElement | null>(null);
const { onMouseMove, onMouseLeave } = useMouseGradient(lockCardRef, {
  radius: 200,
  opacity: 0.12,
});

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
    await verifyPassword(props.username, password.value);
    emit("unlock");
  } catch (e: unknown) {
    error.value = t("lock.invalidPassword");
  } finally {
    verifying.value = false;
  }
}
</script>

<style scoped>@import './styles.css';</style>
