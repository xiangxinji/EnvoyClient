<script setup lang="ts">
import TitleBar from "./components/InstallerTitleBar.vue";
</script>

<template>
  <div class="app-container">
    <TitleBar />
    <router-view />
  </div>
</template>

<style>
:root {
  --font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  --radius-sm: 6px;
  --radius-md: 10px;
  --radius-lg: 16px;
  --space-xs: 4px;
  --space-sm: 8px;
  --space-md: 12px;
  --space-lg: 16px;
  --space-xl: 24px;
  --space-2xl: 32px;
  --text-primary: #f5f5f7;
  --text-secondary: #98989d;
  --text-muted: #636366;
  --accent: #3dd9a5;
  --accent-hover: #5ee4b8;
  --text-on-accent: #ffffff;
  --error: #ff453a;
  --border: #2c2c2e;
  --glass-bg: rgba(28, 28, 30, 0.6);
  --glass-bg-heavy: rgba(28, 28, 30, 0.75);
  --glass-bg-light: rgba(28, 28, 30, 0.45);
  --glass-border: rgba(255, 255, 255, 0.08);
  --glass-blur: 20px;
  --glass-shadow: 0 4px 24px rgba(0, 0, 0, 0.25);
  --glass-shadow-heavy: 0 8px 40px rgba(0, 0, 0, 0.4);
  --app-gradient: #141416;
  --input-border: #3a3a3c;
  --titlebar-text: #98989d;
  --orb-1: rgba(61, 217, 165, 0.3);
  --orb-2: rgba(61, 217, 165, 0.22);
  --orb-3: rgba(61, 217, 165, 0.25);
  --orb-4: rgba(61, 217, 165, 0.18);
}

html, body {
  margin: 0;
  padding: 0;
  height: 100%;
  overflow: hidden;
  background: var(--app-gradient);
  color: var(--text-primary);
  font-family: var(--font-sans);
  font-size: 14px;
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
}

#app {
  height: 100%;
}

.app-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
  position: relative;
  z-index: 1;
  background: var(--app-gradient);
}

input, button, textarea {
  font-family: inherit;
  font-size: inherit;
}

::selection {
  background: var(--accent);
  color: var(--text-on-accent);
}
</style>
