<script setup lang="ts">
import { ref } from "vue";
import { useI18n } from "vue-i18n";
import GlassCheckbox from "../GlassCheckbox";

useI18n();

const emit = defineEmits<{
  (e: "hide", remember: boolean): void;
  (e: "exit", remember: boolean): void;
}>();

const visible = defineModel<boolean>({ required: true });
const remember = ref(false);
</script>

<template>
  <Teleport to="body">
    <Transition name="overlay">
      <div v-if="visible" class="overlay" @click.self="visible = false">
        <div class="dialog">
	          <h3 class="dialog-title">{{ $t('dialog.closeConfirm') }}</h3>
	          <p class="dialog-desc">{{ $t('dialog.closeConfirmDesc') }}</p>

          <div class="dialog-actions">
            <button class="btn btn-secondary" @click="visible = false">{{ $t('common.cancel') }}</button>
            <button
              class="btn btn-primary"
              @click="
                visible = false;
                emit('hide', remember);
              "
            >
              {{ $t('dialog.hideToTray') }}
            </button>
            <button
              class="btn btn-danger"
              @click="
                visible = false;
                emit('exit', remember);
              "
            >
              {{ $t('dialog.quitApp') }}
            </button>
          </div>

          <GlassCheckbox v-model="remember">{{ $t('dialog.rememberChoice') }}</GlassCheckbox>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
@import './styles.css';
</style>
