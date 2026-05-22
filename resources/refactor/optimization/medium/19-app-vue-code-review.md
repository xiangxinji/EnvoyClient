# 19 - App.vue 代码规范整改

## 问题描述

`src/App.vue` 存在多处违反项目代码规范的问题，包括样式未拆分、类型断言不当、错误处理缺失等。这些问题影响代码可维护性和类型安全性。

## 影响范围

| 文件 | 问题数量 | 严重程度 |
|------|---------|---------|
| `src/App.vue` | 5 | 中 |

## 涉及代码

### 问题 1 — 样式未拆分到独立文件

**位置**: [App.vue:164-251](c:\Users\xiangxj\Desktop\workspace\EnvoyClient\src\App.vue#L164-L251)

**规范要求**:
> CSS 必须写在 `styles.css` 中，禁止在 `.vue` 文件的 `<style scoped>` 内联样式（除非只有 1-2 行）

**问题**: App.vue 包含 80+ 行全局样式，应该拆分到独立文件

### 问题 2 — 使用 `as any` 类型断言

**位置**: [App.vue:64](c:\Users\xiangxj\Desktop\workspace\EnvoyClient\src\App.vue#L64), [App.vue:71](c:\Users\xiangxj\Desktop\workspace\EnvoyClient\src\App.vue#L71)

**规范要求**:
> 禁止 `as any` 或 `as Record<string, unknown>` 类型转换

**问题**:
```typescript
const unlistenFn = await (getCurrentWindow() as any).listen(...)
const unlistenQuitFn = await (getCurrentWindow() as any).listen(...)
```

### 问题 3 — 空的 catch 块（4 处）

**位置**: [App.vue:32](c:\Users\xiangxj\Desktop\workspace\EnvoyClient\src\App.vue#L32), [App.vue:40](c:\Users\xiangxj\Desktop\workspace\EnvoyClient\src\App.vue#L40), [App.vue:48](c:\Users\xiangxj\Desktop\workspace\EnvoyClient\src\App.vue#L48), [App.vue:75](c:\Users\xiangxj\Desktop\workspace\EnvoyClient\src\App.vue#L75)

**问题**: 多处空 catch 块，应该至少记录错误

### 问题 4 — 注释代码未清理

**位置**: [App.vue:86](c:\Users\xiangxj\Desktop\workspace\EnvoyClient\src\App.vue#L86)

**问题**: 
```typescript
// window.addEventListener("contextmenu", preventContextMenu);
```
这行代码被注释掉，但在 `onUnmounted` 中仍然尝试移除它

### 问题 5 — 事件监听器管理不一致

**位置**: [App.vue:86-87](c:\Users\xiangxj\Desktop\workspace\EnvoyClient\src\App.vue#L86-L87), [App.vue:100-101](c:\Users\xiangxj\Desktop\workspace\EnvoyClient\src\App.vue#L100-L101)

**问题**: `preventContextMenu` 监听器被注释掉，但在 `onUnmounted` 中仍然尝试移除它

## 详细整改方案

### 步骤 1：拆分样式到独立文件

创建 `src/App/styles.css` 文件：

```css
@import '../styles/variables.css';

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
  position: relative;
  z-index: 1;
}

input, button, textarea {
  font-family: inherit;
  font-size: inherit;
}

::selection {
  background: var(--accent);
  color: var(--text-on-accent);
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

.page-enter-active {
  transition:
    opacity 0.32s cubic-bezier(0.16, 1, 0.3, 1),
    transform 0.32s cubic-bezier(0.16, 1, 0.3, 1),
    filter 0.32s cubic-bezier(0.16, 1, 0.3, 1);
  will-change: opacity, transform, filter;
}

.page-leave-active {
  transition:
    opacity 0.18s cubic-bezier(0.4, 0, 1, 1),
    transform 0.18s cubic-bezier(0.4, 0, 1, 1),
    filter 0.18s cubic-bezier(0.4, 0, 1, 1);
  will-change: opacity, transform, filter;
}

.page-enter-from {
  opacity: 0;
  transform: scale(0.94);
  filter: blur(8px);
}

.page-leave-to {
  opacity: 0;
  transform: scale(0.97);
  filter: blur(4px);
}

@media (prefers-reduced-motion: reduce) {
  .page-enter-active,
  .page-leave-active {
    transition: opacity 0.1s ease;
  }
  .page-enter-from,
  .page-leave-to {
    transform: none;
    filter: none;
  }
}
```

修改 `src/App.vue` 的 `<style>` 部分：

```vue
<style scoped>
@import './styles.css';
</style>
```

### 步骤 2：修复 `as any` 类型断言

**方案 A**：定义正确的类型（推荐）

在 `src/types.ts` 中添加：

```typescript
export interface TauriWindow {
  listen<T = unknown>(event: string, handler: (event: T) => void): Promise<() => void>;
}
```

修改 `App.vue`：

```typescript
import type { TauriWindow } from "../types";

const unlistenFn = await (getCurrentWindow() as TauriWindow).listen(
  "close-requested",
  () => {
    handleCloseRequested();
  }
);
unlisten = unlistenFn;

const unlistenQuitFn = await (getCurrentWindow() as TauriWindow).listen(
  "quit-requested",
  () => {
    if (locked.value) {
      notifyQuitAttempt();
    } else {
      handleExit();
    }
  }
);
unlistenQuit = unlistenQuitFn;
```

**方案 B**：使用类型守卫（如果类型定义困难）

```typescript
function isTauriWindow(win: unknown): win is { listen: <T>(event: string, handler: (event: T) => void) => Promise<() => void> } {
  return typeof win === "object" && win !== null && "listen" in win && typeof (win as any).listen === "function";
}

const currentWindow = getCurrentWindow();
if (isTauriWindow(currentWindow)) {
  const unlistenFn = await currentWindow.listen("close-requested", () => {
    handleCloseRequested();
  });
  unlisten = unlistenFn;
}
```

### 步骤 3：添加错误日志到 catch 块

```typescript
async function getCloseAction(): Promise<string> {
  if (!isTauri) return "ask";
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    const settings = (await invoke("get_settings")) as Record<string, unknown>;
    return (settings.close_action as string) || "ask";
  } catch (e) {
    console.error("Failed to get close action:", e);
    return "ask";
  }
}

async function saveCloseAction(action: string): Promise<void> {
  if (!isTauri) return;
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    const settings = (await invoke("get_settings")) as Record<string, unknown>;
    settings.close_action = action;
    await invoke("save_settings", { settings });
  } catch (e) {
    console.error("Failed to save close action:", e);
  }
}

async function handleExit() {
  if (!isTauri) return;
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("app_exit");
  } catch (e) {
    console.error("Failed to exit app:", e);
  }
}

onMounted(async () => {
  // ... 其他代码 ...

  if (isTauri) {
    window.addEventListener("keydown", preventRefresh);
    try {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      const unlistenFn = await (getCurrentWindow() as TauriWindow).listen(
        "close-requested",
        () => {
          handleCloseRequested();
        }
      );
      unlisten = unlistenFn;

      const unlistenQuitFn = await (getCurrentWindow() as TauriWindow).listen(
        "quit-requested",
        () => {
          if (locked.value) {
            notifyQuitAttempt();
          } else {
            handleExit();
          }
        }
      );
      unlistenQuit = unlistenQuitFn;
    } catch (e) {
      console.error("Failed to setup window listeners:", e);
    }
  }
});
```

### 步骤 4：清理注释代码和修复事件监听器管理

**方案 A**：完全移除 `preventContextMenu` 功能

```typescript
function preventRefresh(e: KeyboardEvent) {
  if (import.meta.env.PROD && (e.key === "F5" || (e.ctrlKey && e.key === "r"))) {
    e.preventDefault();
  }
}

onMounted(async () => {
  const splash = document.getElementById("splash");
  if (splash) {
    splash.classList.add("fade-out");
    splash.addEventListener("transitionend", () => splash.classList.add("gone"));
    setTimeout(() => splash.classList.add("gone"), 600);
  }

  window.addEventListener("focus", cancelTaskbarAttention);

  if (isTauri) {
    window.addEventListener("keydown", preventRefresh);
    try {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      const unlistenFn = await (getCurrentWindow() as TauriWindow).listen(
        "close-requested",
        () => {
          handleCloseRequested();
        }
      );
      unlisten = unlistenFn;

      const unlistenQuitFn = await (getCurrentWindow() as TauriWindow).listen(
        "quit-requested",
        () => {
          if (locked.value) {
            notifyQuitAttempt();
          } else {
            handleExit();
          }
        }
      );
      unlistenQuit = unlistenQuitFn;
    } catch (e) {
      console.error("Failed to setup window listeners:", e);
    }
  }
});

onUnmounted(() => {
  unlisten?.();
  unlistenQuit?.();
  window.removeEventListener("focus", cancelTaskbarAttention);
  if (isTauri) {
    window.removeEventListener("keydown", preventRefresh);
  }
});
```

**方案 B**：如果需要保留 `preventContextMenu` 功能

```typescript
function preventRefresh(e: KeyboardEvent) {
  if (import.meta.env.PROD && (e.key === "F5" || (e.ctrlKey && e.key === "r"))) {
    e.preventDefault();
  }
}

function preventContextMenu(e: MouseEvent) {
  e.preventDefault();
}

onMounted(async () => {
  const splash = document.getElementById("splash");
  if (splash) {
    splash.classList.add("fade-out");
    splash.addEventListener("transitionend", () => splash.classList.add("gone"));
    setTimeout(() => splash.classList.add("gone"), 600);
  }

  window.addEventListener("contextmenu", preventContextMenu);
  window.addEventListener("focus", cancelTaskbarAttention);

  if (isTauri) {
    window.addEventListener("keydown", preventRefresh);
    try {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      const unlistenFn = await (getCurrentWindow() as TauriWindow).listen(
        "close-requested",
        () => {
          handleCloseRequested();
        }
      );
      unlisten = unlistenFn;

      const unlistenQuitFn = await (getCurrentWindow() as TauriWindow).listen(
        "quit-requested",
        () => {
          if (locked.value) {
            notifyQuitAttempt();
          } else {
            handleExit();
          }
        }
      );
      unlistenQuit = unlistenQuitFn;
    } catch (e) {
      console.error("Failed to setup window listeners:", e);
    }
  }
});

onUnmounted(() => {
  unlisten?.();
  unlistenQuit?.();
  window.removeEventListener("contextmenu", preventContextMenu);
  window.removeEventListener("focus", cancelTaskbarAttention);
  if (isTauri) {
    window.removeEventListener("keydown", preventRefresh);
  }
});
```

## 验证方法

1. **编译检查**：
   ```bash
   npx vue-tsc --noEmit
   ```
   确认零 `TS7006`（隐式 any）和 `TS2322`（类型不匹配）错误。

2. **代码规范检查**：
   ```bash
   grep -rn ": any" src/App.vue
   ```
   确认 `as any` 已移除。

3. **功能回归**：
   - 应用启动正常
   - 窗口关闭/隐藏功能正常
   - 页面切换动画正常
   - F5 刷新在生产环境被阻止

4. **样式验证**：
   - 确认 `src/App/styles.css` 文件存在
   - 确认样式加载正常
   - 确认页面动画效果正常

## 优先级

中优先级（代码质量/可维护性）

## 预计工作量

2-3 小时
