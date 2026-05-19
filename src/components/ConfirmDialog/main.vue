<script setup lang="ts">
import { ref, watch } from "vue";
import { useI18n } from "vue-i18n";

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

const show = ref(false);

watch(() => props.visible, (val) => {
  if (val) {
    requestAnimationFrame(() => { show.value = true; });
  } else {
    show.value = false;
  }
});

function handleConfirm() {
  show.value = false;
  setTimeout(() => emit("confirm"), 200);
}

function handleCancel() {
  show.value = false;
  setTimeout(() => emit("cancel"), 200);
}

function handleBackdropClick() {
  handleCancel();
}
</script>

<template>
  <Teleport to="body">
    <div v-if="visible" class="confirm-overlay" :class="{ active: show }" @click="handleBackdropClick">
      <div class="confirm-dialog" @click.stop>
        <div class="confirm-title">{{ title ?? t('common.confirm') }}</div>
        <div class="confirm-message">{{ message }}</div>
        <div class="confirm-actions">
          <button class="btn-cancel" @click="handleCancel">{{ cancelText ?? t('common.cancel') }}</button>
          <button class="btn-confirm" :class="{ danger }" @click="handleConfirm">{{ confirmText ?? t('common.confirm') }}</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
@import './styles.css';
</style>
