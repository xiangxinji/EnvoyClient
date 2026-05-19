<script setup lang="ts">
import { useI18n } from "vue-i18n";

const { t } = useI18n();

defineProps<{
  status: "disconnected" | "connecting" | "reconnecting" | "reconnect_failed";
  attempt: number;
}>();

defineEmits<{
  logout: [];
}>();
</script>

<template>
  <Teleport to="body">
    <div class="reconnect-overlay">
      <div class="reconnect-card">
        <div class="reconnect-spinner" />
        <div class="reconnect-title">{{ t('reconnect.title') }}</div>
        <div class="reconnect-status">
          <template v-if="status === 'reconnect_failed'">
            {{ t('reconnect.slowRetry') }}
          </template>
          <template v-else>
            {{ t('reconnect.attempt', { attempt }) }}
          </template>
        </div>
        <button class="reconnect-logout" @click="$emit('logout')">
          {{ t('reconnect.backToLogin') }}
        </button>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
@import './styles.css';
</style>
