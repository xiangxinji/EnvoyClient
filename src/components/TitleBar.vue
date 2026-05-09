<script setup lang="ts">
import { getCurrentWindow } from "@tauri-apps/api/window";

const appWindow = getCurrentWindow();

function minimize() {
  appWindow.minimize();
}

function toggleMaximize() {
  appWindow.toggleMaximize();
}

function close() {
  appWindow.close();
}
</script>

<template>
  <div class="titlebar" data-tauri-drag-region>
    <div class="traffic-lights">
      <button class="light close" @click="close" title="Close">
        <svg width="8" height="8" viewBox="0 0 8 8">
          <line x1="1" y1="1" x2="7" y2="7" stroke="#4d0000" stroke-width="1.2" />
          <line x1="7" y1="1" x2="1" y2="7" stroke="#4d0000" stroke-width="1.2" />
        </svg>
      </button>
      <button class="light minimize" @click="minimize" title="Minimize">
        <svg width="8" height="8" viewBox="0 0 8 8">
          <line x1="1" y1="4" x2="7" y2="4" stroke="#995700" stroke-width="1.2" />
        </svg>
      </button>
      <button class="light maximize" @click="toggleMaximize" title="Maximize">
        <svg width="8" height="8" viewBox="0 0 8 8">
          <path d="M1 3 L4 6 L7 3" fill="none" stroke="#006500" stroke-width="1.2" />
        </svg>
      </button>
    </div>
    <div class="title" data-tauri-drag-region>Envoy</div>
  </div>
</template>

<style scoped>
.titlebar {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 38px;
  background: #2b2b2b;
  border-bottom: 1px solid #1a1a1a;
  user-select: none;
  -webkit-user-select: none;
  position: relative;
}

.traffic-lights {
  display: flex;
  gap: 8px;
  position: absolute;
  left: 14px;
  top: 50%;
  transform: translateY(-50%);
}

.light {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  transition: filter 0.15s;
}

.light svg {
  opacity: 0;
  transition: opacity 0.15s;
}

.traffic-lights:hover .light svg {
  opacity: 1;
}

.close {
  background: #ff5f57;
}

.minimize {
  background: #febc2e;
}

.maximize {
  background: #28c840;
}

.light:hover {
  filter: brightness(0.85);
}

.close:hover {
  background: #ff3b30;
}

.minimize:hover {
  background: #f5a623;
}

.maximize:hover {
  background: #1db954;
}

.title {
  font-size: 0.82em;
  font-weight: 500;
  color: #999;
  letter-spacing: 0.3px;
}
</style>
