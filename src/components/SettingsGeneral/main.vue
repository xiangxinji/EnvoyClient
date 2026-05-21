<script setup lang="ts">
import { ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { getSystemSettingService } from "../../composables/teamClientContext";
import BackButton from "../BackButton";
import GlassSelect from "../GlassSelect";

const { t } = useI18n();
const emit = defineEmits<{ back: [] }>();

const sysSettings = getSystemSettingService();
const currentLocale = ref(sysSettings.locale);
watch(currentLocale, (val) => sysSettings.switchLocale(val as "zh-CN" | "en"));
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
            <label class="setting-label">{{ t('settings.language') }}</label>
            <GlassSelect v-model="currentLocale">
              <option value="zh-CN">简体中文</option>
              <option value="en">English</option>
            </GlassSelect>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
@import '../SettingsPanel/styles.css';
</style>
