<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { useI18n } from "vue-i18n";
import type { MemberInfo } from "../../types";
import SvgIcon from "../SvgIcon";
import { useUserProfile } from "../../composables/useUserProfile";

const props = defineProps<{
  visible: boolean;
  members: MemberInfo[];
  currentPeerId: string;
}>();

const emit = defineEmits<{
  confirm: [targetId: string];
  cancel: [];
}>();

const { t } = useI18n();
const { getInitial } = useUserProfile();
const selectedId = ref<string | null>(null);

const targets = computed(() => props.members.filter((m) => m.id !== props.currentPeerId));

watch(() => props.visible, (v) => {
  if (!v) selectedId.value = null;
});

function handleConfirm() {
  if (selectedId.value) {
    emit("confirm", selectedId.value);
    selectedId.value = null;
  }
}

function handleCancel() {
  selectedId.value = null;
  emit("cancel");
}
</script>

<template>
  <Teleport to="body">
    <div v-if="visible" class="forward-overlay" @click.self="handleCancel">
      <div class="forward-dialog">
        <div class="forward-title">{{ t('chat.forwardTo') }}</div>
        <div v-if="targets.length === 0" class="forward-empty">{{ t('chat.noForwardTarget') }}</div>
        <div v-else class="forward-list">
          <div
            v-for="m in targets"
            :key="m.id"
            class="forward-item"
            :class="{ active: m.id === selectedId }"
            @click="selectedId = m.id"
          >
            <div class="forward-avatar">{{ getInitial(m.id) }}</div>
            <div class="forward-info">
              <span class="forward-name">{{ m.id }}</span>
              <span class="forward-role" :class="m.role">{{ m.role }}</span>
            </div>
            <div class="forward-radio" :class="{ checked: m.id === selectedId }">
              <SvgIcon v-if="m.id === selectedId" name="check" :size="12" />
            </div>
          </div>
        </div>
        <div class="forward-actions">
          <button class="btn-cancel" @click="handleCancel">{{ t('common.cancel') }}</button>
          <button class="btn-confirm" @click="handleConfirm" :disabled="!selectedId">{{ t('chat.confirmForward') }}</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
@import './styles.css';
</style>
