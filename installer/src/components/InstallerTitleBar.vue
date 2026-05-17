<script setup lang="ts">
import GlassButton from "./GlassButton.vue";
</script>

<template>
  <div class="titlebar" data-tauri-drag-region>
    <div class="title" data-tauri-drag-region>Envoy 安装程序</div>
    <div class="close-area">
      <GlassButton variant="danger" @click="$emit('close')">✕</GlassButton>
    </div>
  </div>
</template>

<script lang="ts">
export default { emits: ["close"] };
</script>

<style scoped>
.titlebar {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 38px;
  background: var(--glass-bg-heavy);
  backdrop-filter: blur(var(--glass-blur));
  -webkit-backdrop-filter: blur(var(--glass-blur));
  border-bottom: 1px solid var(--glass-border);
  user-select: none;
  -webkit-user-select: none;
  position: relative;
  z-index: 100;
  flex-shrink: 0;
}

.title {
  font-size: 0.82em;
  font-weight: 600;
  color: var(--titlebar-text);
  letter-spacing: 0.3px;
}

.close-area {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
}
</style>
