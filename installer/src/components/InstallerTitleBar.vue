<script setup lang="ts">
const isTauri = "__TAURI_INTERNALS__" in window;

async function close() {
  if (!isTauri) return;
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  await getCurrentWindow().close();
}
</script>

<template>
  <div class="titlebar" data-tauri-drag-region>
    <div class="title" data-tauri-drag-region>Envoy 安装程序</div>
    <button class="close-btn" @click="close" title="关闭">
      <svg width="10" height="10" viewBox="0 0 10 10">
        <line x1="1" y1="1" x2="9" y2="9" stroke="currentColor" stroke-width="1.5" />
        <line x1="9" y1="1" x2="1" y2="9" stroke="currentColor" stroke-width="1.5" />
      </svg>
    </button>
  </div>
</template>

<style scoped>
.titlebar {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 36px;
  background: var(--border);
  border-bottom: 1px solid var(--glass-border);
  user-select: none;
  -webkit-user-select: none;
  position: relative;
  flex-shrink: 0;
}

.title {
  font-size: 0.8em;
  font-weight: 500;
  color: var(--text-muted);
  letter-spacing: 0.2px;
}

.close-btn {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  width: 28px;
  height: 28px;
  border-radius: 6px;
  border: none;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.12s, color 0.12s;
}

.close-btn:hover {
  background: var(--error);
  color: var(--text-on-accent);
}
</style>
