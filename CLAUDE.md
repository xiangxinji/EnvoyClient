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

### 头像初始字母 — `getInitial`

**禁止内联 `.charAt(0).toUpperCase()`**，必须使用 `useUserProfile` 的 `getInitial`。

```ts
const { getInitial } = useUserProfile();
{{ getInitial(username) }}
```

### 文件选择器 — `pickFiles`

**禁止内联 `document.createElement("input")` 文件选择器**，必须使用 `pickFiles` 工具函数。

```ts
import { pickFiles } from "../utils/filePicker";

const files = await pickFiles({ accept: "image/*", multiple: true });
```

### 任务映射 — `apiTaskToTaskMessage`

**禁止内联 API task → TaskMessage 映射**，必须使用 `taskFormatters.ts` 的 `apiTaskToTaskMessage`。

```ts
import { apiTaskToTaskMessage, type ApiTask } from "../../utils/taskFormatters";
const taskMsg = apiTaskToTaskMessage(apiTask);
```

### 资源类型安全 — `TypedTaskResource`

`useTaskResources` 返回的 `leaderReviews` 和 `fileResources` 已是 `TypedTaskResource<LeaderReviewData>` 和 `TypedTaskResource<FileResourceData>` 类型，**禁止 `as any` 或 `as Record<string, unknown>` 类型转换**，直接访问 `review.data.success`、`res.data.filename` 等属性。

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

## 高内聚低耦合重构指南

### 待提取的共享子组件（TaskCard 与 TaskDetailPanel 重复模板）

以下模板片段在 `TaskCard/main.vue` 和 `TaskDetailPanel/main.vue` 中高度重复，必须提取为共享子组件：

| 子组件名 | 用途 | 来源行数 | 去向 |
|---|---|---|---|
| `TaskActionButtons` | 开始/上传/完成/审批按钮组 | ~25 行/文件 | `src/components/TaskActionButtons/` |
| `TaskFileList` | 文件资源列表（文件名+大小+下载） | ~15 行/文件 | `src/components/TaskFileList/` |
| `TaskReviewList` | Leader 评审结果列表 | ~12 行/文件 | `src/components/TaskReviewList/` |
| `TaskTraceBlock` | 执行步骤/工具调用嵌套渲染 | ~25 行/文件 | `src/components/TaskTraceBlock/` |

### 待提取的 Composable

#### `useTaskLiveData(taskId)` — 任务实时数据

从 `TaskDetailPanel/main.vue` 和 `TaskCenterView/main.vue` 提取。两个文件存在几乎相同的基础设施代码：注入 `TeamClientKey`、`managerFetch` 拉取、WebSocket `on("task", ...)` 订阅/取消。

```ts
// src/composables/useTaskLiveData.ts
export function useTaskLiveData(taskId: Ref<string>) {
  const liveTask = ref<TaskMessage | null>(null);
  // 内部处理：inject TeamClientKey、fetchTask、WS 订阅
  return { liveTask, refresh };
}
```

#### `useTaskTimeline(resources, timestamp)` — 任务时间线

从 `TaskDetailPanel/main.vue` 提取约 52 行的 `TimelineEvent` 接口定义和 `timelineEvents`/`duration` 计算属性。

#### `useCloudFiles(teamName, myId)` — 云文件操作

从 `CloudResourcesPanel/main.vue` 提取约 75 行内联业务逻辑（加载、导航、上传、创建目录、删除、下载、选择模式）。

#### `useAIChat` 与 `useAITask` — 拆分 `useAI`

`useAI.ts`（238 行）混合了聊天建议和任务管理两类不相关的职责，共享一个 `aiError` ref 会导致互相覆盖。必须拆分为：
- `useAIChat` — `suggestReply`、`acceptSuggestion`、`clearSuggestion`
- `useAITask` — `planTask`、`analyzeTaskResult`、`dispatchTask`、`reviewTaskResult`

#### `useChatSend` — 消息发送流水线

从 `ChatPanel/main.vue` 的 `handleRichSend`（25 行）提取：图片上传、文件上传、引用快照构造、云资源引用提取、最终 `sendChat` 调用。

### 共享逻辑统一

#### AutoReply 切换逻辑（3 处重复）

`MemberSidebar/main.vue`、`SettingsPanel/main.vue`、`useGlobalShortcuts.ts` 三处存在相同的 autoReply 切换逻辑（计算 next boolean → saveSettings → 调用 autoReplyDispose）。必须在 `useMemberSettings` 中添加统一的 `toggleAutoReply` 方法。

#### Peer ID 解析（3 处重复）

`useMessages.ts` 中 `channel ? "__team__" : (from === myId ? to : from)` 出现 3 次。提取为 `resolvePeerId` 工具函数到 `src/utils/messageMapper.ts`。

#### ChatMessage 构造（3 处重复）

`useMessages.ts` 中 `ChatMessage` 对象字面量在 `handleIncomingMessage` 和 `sendChat` 中构造了 3 次。提取为 `buildChatMessage` 工厂函数。

### 状态管理规范

#### 禁止设置面板的影子状态

`SettingsPanel/main.vue` 和 `QuickSettingsPanel/main.vue` 在调用 `loadSettings` 后将字段复制到本地 ref，造成与 `useMemberSettings` 内部 `_settings` 的双源真相。必须改用 computed getter/setter 绑定到共享 settings ref。

```ts
// 正确做法
const executionMode = computed({
  get: () => settings.value.execution_mode ?? "local",
  set: (val) => saveSettings(myId, { execution_mode: val }),
});
```

#### 禁止组件直接依赖 API 层

UI 组件（如 `TaskDetailPanel`）不应直接 import `managerFetch` 或 envoy core 类型（如 `Task`）。数据获取和类型转换必须封装在 composable 中。

#### CloudResourcesPanel 必须使用 useConfirm

`CloudResourcesPanel/main.vue` 当前手写了删除确认对话框状态（`deleteConfirm` ref），违反了 "所有确认对话框必须使用 `useConfirm`" 的规范。必须替换为 `showConfirm(...)` 调用。

### 全局单例 vs provide/inject 统一

项目当前同时使用两种状态分发机制：
1. Vue provide/inject（`TeamClientKey` 在 `ChatView` 提供）
2. 模块级单例（`teamClientContext.ts` 的 `_instance` shallowRef）

建议统一为模块级单例，因为应用同时只存在一个 TeamClient。这消除了组件因移动位置而丢失 inject 的风险。

### 全屏图片查看器单例化

`BubbleContent/main.vue` 为每个消息气泡创建独立的 `useFullscreenViewer` 实例和 `Teleport`。50 条消息 = 50 个查看器实例。必须提升为 `ChatPanel` 或 `App` 层单例，`BubbleContent` 仅 emit `open-fullscreen` 事件。

### document 级事件监听器规范

`MessageBubble` 和 `BubbleContent` 在 `<script setup>` 顶层直接调用 `document.addEventListener("keydown", ...)`。N 条消息 = 2N 个 keydown 监听器。必须：
1. 使用 `onMounted` 注册、`onUnmounted` 清理（而非 setup 顶层）
2. 优先将监听器提升到父级组件（ChatPanel）统一处理
3. 或使用单例 composable 管理
