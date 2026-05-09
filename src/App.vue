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
  --bg-primary: #ffffff;
  --bg-secondary: #f7f7f7;
  --bg-tertiary: #fafafa;
  --bg-input: #ffffff;
  --border: #ddd;
  --border-light: #eee;
  --text-primary: #1a1a1a;
  --text-secondary: #555;
  --text-muted: #999;
  --accent: #396cd8;
  --accent-hover: #2b5ab8;
  --task-pending-bg: #edf2f7;
  --task-pending-text: #718096;
  --task-running-border: #3182ce;
  --task-running-bg: #ebf8ff;
  --task-running-text: #3182ce;
  --task-completed-border: #38a169;
  --task-completed-bg: #f0fff4;
  --task-completed-text: #38a169;
  --task-failed-border: #e53e3e;
  --task-failed-bg: #fff5f5;
  --task-failed-text: #e53e3e;
  --task-card-bg: #fff;
  --bubble-other: #e8e8e8;
  --bubble-other-text: #1a1a1a;
  --badge-bg: #e53e3e;
  --task-btn-bg: #e8a817;
  --task-btn-text: #333;
  --role-leader-bg: #ffd700;
  --role-leader-text: #333;
  --role-member-bg: #ddd;
  --role-member-text: #555;
  --error: #e53e3e;
  --input-border: #ccc;
  --sidebar-active: #d0e0f0;
  --sidebar-hover: #e8e8e8;
  --titlebar-bg: #e8e8e8;
  --titlebar-border: #d0d0d0;
  --titlebar-text: #333;
}

html.dark {
  --bg-primary: #1e1e1e;
  --bg-secondary: #252525;
  --bg-tertiary: #2b2b2b;
  --bg-input: #333;
  --border: #3a3a3a;
  --border-light: #333;
  --text-primary: #e0e0e0;
  --text-secondary: #aaa;
  --text-muted: #777;
  --accent: #5b8def;
  --accent-hover: #4a7cdd;
  --task-pending-bg: #2d333b;
  --task-pending-text: #8b949e;
  --task-running-border: #3182ce;
  --task-running-bg: #1a2633;
  --task-running-text: #6cb4ee;
  --task-completed-border: #2ea043;
  --task-completed-bg: #1a2e1f;
  --task-completed-text: #56d364;
  --task-failed-border: #e5534b;
  --task-failed-bg: #2e1a1a;
  --task-failed-text: #f47067;
  --task-card-bg: #2b2b2b;
  --bubble-other: #333;
  --bubble-other-text: #e0e0e0;
  --badge-bg: #e53e3e;
  --task-btn-bg: #b8860b;
  --task-btn-text: #e0e0e0;
  --role-leader-bg: #b8860b;
  --role-leader-text: #e0e0e0;
  --role-member-bg: #444;
  --role-member-text: #aaa;
  --error: #f47067;
  --input-border: #444;
  --sidebar-active: #2a3a4a;
  --sidebar-hover: #333;
  --titlebar-bg: #2b2b2b;
  --titlebar-border: #1a1a1a;
  --titlebar-text: #999;
}

html, body {
  margin: 0;
  padding: 0;
  height: 100%;
  overflow: hidden;
  background: var(--bg-primary);
  color: var(--text-primary);
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

* {
  transition: background-color 0.2s, border-color 0.2s, color 0.2s;
}
</style>
