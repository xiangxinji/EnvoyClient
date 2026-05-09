<script setup lang="ts">
import TitleBar from "./components/TitleBar.vue";
import { useTheme } from "./composables/useTheme";

useTheme();
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
  --radius-xl: 20px;
  --shadow-sm: 0 1px 2px rgba(0,0,0,0.06);
  --shadow-md: 0 2px 8px rgba(0,0,0,0.08);
  --space-xs: 4px;
  --space-sm: 8px;
  --space-md: 12px;
  --space-lg: 16px;
  --space-xl: 24px;
  --space-2xl: 32px;
  --bg-primary: #ffffff;
  --bg-secondary: #f5f5f7;
  --bg-tertiary: #eeeef0;
  --bg-elevated: #ffffff;
  --bg-input: #f5f5f7;
  --border: #e5e5e7;
  --border-light: #eeeef0;
  --text-primary: #1d1d1f;
  --text-secondary: #6e6e73;
  --text-muted: #aeaeb2;
  --accent: #0071e3;
  --accent-hover: #0062cc;
  --accent-light: #e8f2ff;
  --task-pending-bg: #f0f0f2;
  --task-pending-text: #86868b;
  --task-running-border: #0071e3;
  --task-running-bg: #e8f2ff;
  --task-running-text: #0071e3;
  --task-completed-border: #34c759;
  --task-completed-bg: #eefbf2;
  --task-completed-text: #248a3d;
  --task-failed-border: #ff3b30;
  --task-failed-bg: #fff1f0;
  --task-failed-text: #d70015;
  --task-card-bg: #ffffff;
  --bubble-mine: #0071e3;
  --bubble-mine-text: #ffffff;
  --bubble-other: #f0f0f2;
  --bubble-other-text: #1d1d1f;
  --badge-bg: #ff3b30;
  --task-btn-bg: #ff9500;
  --task-btn-text: #ffffff;
  --role-leader-bg: #ff9500;
  --role-leader-text: #ffffff;
  --role-member-bg: #e5e5e7;
  --role-member-text: #6e6e73;
  --error: #ff3b30;
  --input-border: #d2d2d7;
  --sidebar-active: #e8f2ff;
  --sidebar-hover: #f0f0f2;
  --titlebar-bg: #f5f5f7;
  --titlebar-border: #e5e5e7;
  --titlebar-text: #6e6e73;
  --online-dot: #34c759;
  --empty-icon: #d2d2d7;
}

html.dark {
  --bg-primary: #0d0d0f;
  --bg-secondary: #161618;
  --bg-tertiary: #1c1c1e;
  --bg-elevated: #1c1c1e;
  --bg-input: #1c1c1e;
  --border: #2c2c2e;
  --border-light: #232325;
  --text-primary: #f5f5f7;
  --text-secondary: #98989d;
  --text-muted: #636366;
  --accent: #0a84ff;
  --accent-hover: #409cff;
  --accent-light: #1a2a3d;
  --task-pending-bg: #1c1c1e;
  --task-pending-text: #98989d;
  --task-running-border: #0a84ff;
  --task-running-bg: #0d1a2a;
  --task-running-text: #64d2ff;
  --task-completed-border: #30d158;
  --task-completed-bg: #0d1f12;
  --task-completed-text: #30d158;
  --task-failed-border: #ff453a;
  --task-failed-bg: #1f0d0d;
  --task-failed-text: #ff453a;
  --task-card-bg: #1c1c1e;
  --bubble-mine: #0a84ff;
  --bubble-mine-text: #ffffff;
  --bubble-other: #1c1c1e;
  --bubble-other-text: #f5f5f7;
  --badge-bg: #ff453a;
  --task-btn-bg: #ff9f0a;
  --task-btn-text: #1d1d1f;
  --role-leader-bg: #ff9f0a;
  --role-leader-text: #1d1d1f;
  --role-member-bg: #2c2c2e;
  --role-member-text: #98989d;
  --error: #ff453a;
  --input-border: #3a3a3c;
  --sidebar-active: #1a2a3d;
  --sidebar-hover: #1c1c1e;
  --titlebar-bg: #161618;
  --titlebar-border: #2c2c2e;
  --titlebar-text: #98989d;
  --online-dot: #30d158;
  --empty-icon: #3a3a3c;
}

html, body {
  margin: 0;
  padding: 0;
  height: 100%;
  overflow: hidden;
  background: var(--bg-primary);
  color: var(--text-primary);
  font-family: var(--font-sans);
  font-size: 14px;
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

#app {
  height: 100%;
}

.app-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
}

input, button, textarea {
  font-family: inherit;
  font-size: inherit;
}

::selection {
  background: var(--accent);
  color: white;
}

::-webkit-scrollbar {
  width: 6px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background: var(--border);
  border-radius: 3px;
}

::-webkit-scrollbar-thumb:hover {
  background: var(--text-muted);
}
</style>
