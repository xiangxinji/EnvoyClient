<script setup lang="ts">
import { ref } from "vue";
import { useI18n } from "vue-i18n";
import { useEventListener } from "@vueuse/core";
import GlassCheckbox from "../GlassCheckbox";
import GlassButton from "../GlassButton";

useI18n();

const emit = defineEmits<{
  (e: "hide", remember: boolean): void;
  (e: "exit", remember: boolean): void;
}>();

const visible = defineModel<boolean>({ required: true });
const remember = ref(false);

useEventListener("keydown", (e: KeyboardEvent) => {
  if (e.key === "Escape" && visible.value) {
    visible.value = false;
  }
});
</script>

<template>
  <Teleport to="body">
    <Transition name="overlay">
      <div v-if="visible" class="overlay">
        <div class="dialog">
	          <h3 class="dialog-title">{{ $t('dialog.closeConfirm') }}</h3>
	          <p class="dialog-desc">{{ $t('dialog.closeConfirmDesc') }}</p>

          <div class="dialog-actions">
            <GlassButton variant="default" @click="visible = false">{{ $t('common.cancel') }}</GlassButton>
            <GlassButton variant="primary" @click="visible = false; emit('hide', remember);">{{ $t('dialog.hideToTray') }}</GlassButton>
            <GlassButton variant="danger" @click="visible = false; emit('exit', remember);">{{ $t('dialog.quitApp') }}</GlassButton>
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
