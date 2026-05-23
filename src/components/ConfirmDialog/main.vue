<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { useEventListener } from "@vueuse/core";
import GlassButton from "../GlassButton";

const { t } = useI18n();

const props = defineProps<{
  visible: boolean;
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
}>();

const emit = defineEmits<{
  confirm: [];
  cancel: [];
}>();

function handleConfirm() {
  emit("confirm");
}

function handleCancel() {
  emit("cancel");
}

useEventListener("keydown", (e: KeyboardEvent) => {
  if (e.key === "Escape" && props.visible) {
    handleCancel();
  }
});
</script>

<template>
  <Teleport to="body">
    <Transition name="dialog-overlay">
      <div v-if="visible" class="confirm-overlay">
        <div class="confirm-dialog" @click.stop>
          <div class="confirm-title">{{ title ?? t('common.confirm') }}</div>
          <div class="confirm-message">{{ message }}</div>
          <div class="confirm-actions">
            <GlassButton variant="default" @click="handleCancel">{{ cancelText ?? t('common.cancel') }}</GlassButton>
            <GlassButton :variant="danger ? 'danger' : 'primary'" @click="handleConfirm">{{ confirmText ?? t('common.confirm') }}</GlassButton>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
@import './styles.css';
</style>
