# EnvoyClient 项目规范

## Composable 使用规范

### useToast — Toast 提示

**文件**: `src/composables/useToast.ts`

所有需要 Toast 提示的组件必须使用 `useToast` composable，禁止手动管理 `toastVisible/toastMessage/toastType` 状态。

```ts
import { useToast } from "../../composables/useToast";

const { toastVisible, toastMessage, toastType, showToast, hideToast } = useToast();
```

**模板用法**:
```vue
<Toast :visible="toastVisible" :message="toastMessage" :type="toastType" @done="hideToast" />
```

**调用方式**:
```ts
showToast("操作成功", "success");
showToast("操作失败", "error");
showToast("提示信息", "info");
```

### useConfirm — 确认对话框

**文件**: `src/composables/useConfirm.ts`

所有需要确认对话框的组件必须使用 `useConfirm` composable，禁止手动管理 `confirmVisible/confirmTitle/confirmMessage/confirmDanger/pendingAction` 状态。

```ts
import { useConfirm } from "../../composables/useConfirm";

const { confirmVisible, confirmTitle, confirmMessage, confirmDanger, showConfirm, handleConfirm, handleCancel } = useConfirm();
```

**模板用法**:
```vue
<ConfirmDialog
  :visible="confirmVisible"
  :title="confirmTitle"
  :message="confirmMessage"
  :danger="confirmDanger"
  @confirm="handleConfirm"
  @cancel="handleCancel"
/>
```

**调用方式**:
```ts
// 普通确认
showConfirm("确认标题", "确认消息", () => {
  // 确认后执行的操作
});

// 危险操作确认（红色按钮）
showConfirm("删除确认", "确定要删除吗？", () => {
  // 删除操作
}, true);
```

## 代码结构原则

1. **禁止重复状态管理**: 如果多个组件存在相同的状态管理模式（如 Toast、Confirm），必须提取为 composable 复用
2. **Composable 命名**: 以 `use` 前缀命名，文件放在 `src/composables/` 目录
3. **组件职责单一**: 组件中不应包含可提取的通用逻辑，如 Toast 显示、确认弹窗等

## 组件拆分规范

### 文件大小阈值

- 单文件组件（`main.vue`）script + template 超过 **250 行**时应考虑拆分
- 超过 **350 行**时必须拆分

### 拆分策略

1. **重复业务逻辑 → composable**: 多个组件共享的操作逻辑（如任务操作、文件下载）必须提取为 composable，禁止复制粘贴
2. **重复模板片段 → 子组件**: 模板中相同结构出现 2 次以上时，必须提取为子组件
3. **大段 CSS 变量 → 独立样式文件**: 全局 CSS 变量（如主题色）应放在 `src/styles/` 目录，不在组件中定义
4. **内嵌对话框/浮层 → 独立组件**: 组件内的 Teleport 弹窗（如全屏图片查看器、转发对话框）应提取为独立组件

## 通用工具函数规范

### 平台判断 — `src/utils/platform.ts`

**禁止内联 `"__TAURI_INTERNALS__" in window`**，必须从 `platform.ts` 导入。

```ts
import { isTauri, safeInvoke } from "../utils/platform";

// isTauri — 运行时判断是否在 Tauri 环境
if (isTauri) { ... }

// safeInvoke — 安全调用 Tauri invoke，非 Tauri 环境返回 null
const result = await safeInvoke<Settings>("get_settings");
```

### 错误消息提取 — `src/utils/error.ts`

**禁止内联 `e instanceof Error ? e.message : String(e)`**，必须使用 `getErrorMessage`。

```ts
import { getErrorMessage } from "../utils/error";

catch (e: unknown) {
  console.error("操作失败:", getErrorMessage(e));
}
```

### 文件大小格式化 — `src/utils/taskFormatters.ts`

`formatFileSize` 的唯一实现在 `taskFormatters.ts`，禁止在其他文件重复定义。

```ts
import { formatFileSize } from "../../utils/taskFormatters";
```

### 任务状态标签 — `src/utils/taskFormatters.ts`

`getStatusLabels(t)` 返回 `Record<TaskMessage["status"], string>`，禁止在组件内重复定义 `statusLabels` 映射。

```ts
import { getStatusLabels } from "../../utils/taskFormatters";
const statusLabels = getStatusLabels(t);
```

### POST 请求 — `managerPost`

所有 POST JSON 请求必须使用 `managerPost`，禁止手动构造 `method: "POST"` + `Content-Type` + `JSON.stringify`。

```ts
import { managerPost } from "../../api";

const res = await managerPost("/api/path", { key: "value" });
```

仅 SSE 流式请求（需读取 `response.body`）可使用 `managerFetch` 手动构造。

## SVG 图标使用规范

### 禁止内联 SVG

**所有组件中禁止使用内联 `<svg>` 标签**，必须通过 `SvgIcon` 组件引用图标文件。

**文件结构**:
- 图标组件: `src/components/SvgIcon/main.vue`
- 图标注册: `src/assets/icons/index.ts`
- 图标文件: `src/assets/icons/*.svg`

### 添加新图标

1. 在 `src/assets/icons/` 目录下创建 `.svg` 文件（文件名即图标名）
2. SVG 文件需包含 `xmlns`、`viewBox`、`fill="none"`、`stroke="currentColor"`、`stroke-width="2"` 等标准属性
3. 无需手动注册，`index.ts` 通过 `import.meta.glob` 自动加载

### 使用方式

```vue
<script setup lang="ts">
import SvgIcon from "../SvgIcon";
</script>

<template>
  <SvgIcon name="check-circle" :size="16" />
  <SvgIcon name="close" size="12" />
</template>
```

### 现有图标列表

cloud, tasks, lightning, search, keyboard, chat, settings, plus, close, check, check-circle, check-square, more-vertical, forward, reply, delete-back, paperclip, smile, chevron-right, zoom-out, zoom-in, rotate-ccw, rotate-cw, refresh, download, file, trash, camera, log-out
