<script setup lang="ts">
import { ref, watch, onMounted } from "vue";
import { useI18n } from "vue-i18n";
import { getSystemSettingService } from "../../composables/teamClientContext";
import { useToast } from "../../composables/useToast";
import { isTauri } from "../../utils/platform";
import { getErrorMessage } from "../../utils/error";
import BackButton from "../BackButton";
import GlassSelect from "../GlassSelect";
import GlassCheckbox from "../GlassCheckbox";
import Toast from "../Toast";

const { t } = useI18n();
const emit = defineEmits<{ back: [] }>();

const sysSettings = getSystemSettingService();
const currentLocale = ref(sysSettings.locale);
watch(currentLocale, (val) => sysSettings.switchLocale(val as "zh-CN" | "en"));

const { toastVisible, toastMessage, toastType, showToast, hideToast } = useToast();

const autoStart = ref(false);
let autoStartInitialized = false;

onMounted(async () => {
  if (isTauri) {
    try {
      const { isEnabled } = await import("@tauri-apps/plugin-autostart");
      autoStart.value = await isEnabled();
    } catch (e) {
      console.error("Failed to load autostart state:", getErrorMessage(e));
    }
    autoStartInitialized = true;
  }
});

watch(autoStart, async (val) => {
  if (!autoStartInitialized) return;
  try {
    const { enable, disable } = await import("@tauri-apps/plugin-autostart");
    if (val) {
      await enable();
    } else {
      await disable();
    }
  } catch (e) {
    console.error("Failed to toggle autostart:", getErrorMessage(e));
    showToast(t('common.operationFailed'), "error");
    try {
      const { isEnabled } = await import("@tauri-apps/plugin-autostart");
      autoStart.value = await isEnabled();
    } catch {
      autoStart.value = false;
    }
  }
});
</script>

<template>
  <div class="settings-panel">
    <div class="settings-header">
      <span class="header-title">{{ t('settings.groupGeneral') }}</span>
      <BackButton @click="emit('back')" />
    </div>

    <div class="settings-body">
      <section class="settings-section">
        <div class="section-body">
          <div class="setting-group">
            <label class="setting-label">{{ t('settings.autoStart') }}</label>
            <GlassCheckbox v-model="autoStart">{{ t('settings.autoStartDesc') }}</GlassCheckbox>
          </div>

          <div class="setting-group">
            <label class="setting-label">{{ t('settings.language') }}</label>
            <GlassSelect v-model="currentLocale">
              <option value="zh-CN">简体中文</option>
              <option value="en">English</option>
            </GlassSelect>
          </div>
        </div>
      </section>
    </div>

    <Toast :visible="toastVisible" :message="toastMessage" :type="toastType" @done="hideToast" />
  </div>
</template>

<style scoped>
@import '../SettingsPanel/styles.css';
</style>
