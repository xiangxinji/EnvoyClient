# EnvoyClient 重构计划 — 高内聚低耦合

> 生成日期: 2026-05-20 | 分析范围: src/ 全部组件、composable、工具函数

---

## 一、当前架构概览

```
src/
├── components/       # 28 个组件（含子目录）
├── composables/      # 25 个 composable
├── views/            # 4 个页面视图
├── utils/            # 工具函数
├── agent/            # ReAct Agent 逻辑
├── envoy/            # WebSocket 传输层
├── i18n/             # 国际化
├── styles/           # 全局样式
├── api.ts            # HTTP 请求封装
├── types.ts          # 全局类型定义
└── App.vue           # 应用入口
```

### 文件规模统计（超阈值文件）

| 文件 | 行数 | 阈值 | 状态 |
|---|---|---|---|
| TaskDetailPanel/main.vue | 340 | 250 | **超限，需拆分** |
| MemberSidebar/main.vue | 320 | 250 | **超限，需拆分** |
| SettingsPanel/main.vue | 286 | 250 | **超限，需拆分** |
| RoleSelect/main.vue | 256 | 250 | 临界 |
| CloudResourcesPanel/main.vue | 254 | 250 | 临界 |
| MessageBubble/main.vue | 252 | 250 | 临界 |
| ChatPanel/main.vue | 240 | — | 偏大 |
| App.vue | 235 | — | 偏大 |
| TaskCard/main.vue | 231 | — | 偏大 |

| Composable | 行数 | 说明 |
|---|---|---|
| useMessages.ts | 284 | 消息管理，职责过多 |
| useAI.ts | 238 | 混合了聊天+任务两类 AI 功能 |
| useTeamClient.ts | 221 | God composable |
| useTaskActions.ts | 166 | 任务操作 |
| useGlobalShortcuts.ts | 151 | 全局快捷键 |
| useTaskExecution.ts | 148 | 任务执行 |

---

## 二、待提取的共享子组件

`TaskCard/main.vue` 和 `TaskDetailPanel/main.vue` 存在大量重复模板片段。

### 2.1 TaskActionButtons

**来源**: TaskCard（~181-206 行）、TaskDetailPanel（~294-318 行）

**重复内容**: 开始/上传/完成/审批按钮组，包含相同的 `v-if` 条件和事件处理。

```
目标路径: src/components/TaskActionButtons/main.vue
Props: canStart, canUpload, canComplete, canReview, isAssignedToMe, loading 状态
Emits: start, upload, complete, approve, reject
预估减少: ~25 行/文件 x 2 = 50 行
```

### 2.2 TaskFileList

**来源**: TaskCard（~127-145 行）、TaskDetailPanel（~277-291 行）

**重复内容**: 文件资源列表渲染 -- 下载 spinner、文件名、大小、时间戳。

```
目标路径: src/components/TaskFileList/main.vue
Props: files (TypedTaskResource<FileResourceData>[]), loading
Emits: download(file)
预估减少: ~15 行/文件 x 2 = 30 行
```

### 2.3 TaskReviewList

**来源**: TaskCard（~102-119 行）、TaskDetailPanel（~260-272 行）

**重复内容**: Leader 评审结果列表 -- 成功/失败状态、评论内容。

```
目标路径: src/components/TaskReviewList/main.vue
Props: reviews (TypedTaskResource<LeaderReviewData>[])
预估减少: ~12 行/文件 x 2 = 24 行
```

### 2.4 TaskTraceBlock

**来源**: TaskCard（~149-178 行）、TaskDetailPanel（~225-257 行）

**重复内容**: 执行步骤/工具调用/工具结果的嵌套渲染。DetailPanel 迭代多个 trace，Card 显示第一个，内部渲染逻辑相同。

```
目标路径: src/components/TaskTraceBlock/main.vue
Props: trace (执行追踪数据)
预估减少: ~25 行/文件 x 2 = 50 行
```

---

## 三、待提取的 Composable

### 3.1 useTaskLiveData（优先级: 高）

**来源**: `TaskDetailPanel/main.vue`（21, 35-57 行）、`TaskCenterView/main.vue`（14-58, 110-119 行）

**重复内容**: 注入 `TeamClientKey` -> `managerFetch` 拉取任务 -> `apiTaskToTaskMessage` 转换 -> WebSocket `on("task", ...)` 订阅/取消。两个文件几乎逐行相同。

```ts
// src/composables/useTaskLiveData.ts
import { ref, inject, onMounted, onUnmounted, type Ref } from "vue";
import type { TaskMessage } from "../types";
import { apiTaskToTaskMessage } from "../utils/taskFormatters";
import { TeamClientKey } from "./teamClientContext";

export function useTaskLiveData(taskId: Ref<string>) {
  const ctx = inject(TeamClientKey)!;
  const liveTask = ref<TaskMessage | null>(null);

  async function fetchTask() { /* managerFetch + apiTaskToTaskMessage */ }
  function onTaskUpdate(task: Task) { /* 更新 liveTask */ }

  onMounted(() => { fetchTask(); ctx.client.on("task", onTaskUpdate); });
  onUnmounted(() => { ctx.client.off("task", onTaskUpdate); });

  return { liveTask, refresh: fetchTask };
}
```

**收益**: 消除 ~30 行 x 2 = 60 行重复；解耦 UI 组件对 `managerFetch` 和 envoy core `Task` 类型的直接依赖。

### 3.2 useTaskTimeline（优先级: 中）

**来源**: `TaskDetailPanel/main.vue`（69-120 行，约 52 行）

**提取内容**: `TimelineEvent` 接口定义、`timelineEvents` computed（从 clientResults/leaderReviews/fileResources 派生）、`duration` computed。

```ts
// src/composables/useTaskTimeline.ts
export function useTaskTimeline(resources: Ref<TypedTaskResource[]>, timestamp: Ref<number>) {
  const timelineEvents = computed(() => { /* 从资源派生时间线 */ });
  const duration = computed(() => { /* 从事件计算耗时 */ });
  return { timelineEvents, duration };
}
```

### 3.3 useCloudFiles（优先级: 高）

**来源**: `CloudResourcesPanel/main.vue`（63-137 行，约 75 行）

**提取内容**: `currentPath`、`items`、`loading`、`uploadProgress`、`selectMode`、`selectedIds` 以及所有操作函数（加载、导航、上传、创建目录、删除/批量删除、下载）。

```ts
// src/composables/useCloudFiles.ts
export function useCloudFiles(teamName: Ref<string>, myId: Ref<string>) {
  // 状态: currentPath, items, loading, uploadProgress, selectMode, selectedIds
  // 操作: loadFiles, navigate, upload, createFolder, deleteItems, download, toggleSelectMode
  return { currentPath, items, loading, /* ... */ };
}
```

### 3.4 useAIChat + useAITask（优先级: 中，拆分 useAI）

**来源**: `src/composables/useAI.ts`（238 行）

**问题**: 聊天建议（`suggestReply`/`acceptSuggestion`/`clearSuggestion`）和任务管理（`planTask`/`analyzeTaskResult`/`dispatchTask`/`reviewTaskResult`）是不相关的两类职责，共享一个 `aiError` ref 会互相覆盖。

```
useAIChat.ts (~80 行): suggestReply, acceptSuggestion, clearSuggestion, chatAiError
useAITask.ts (~150 行): planTask, analyzeTaskResult, dispatchTask, reviewTaskResult, taskAiError
```

### 3.5 useChatSend（优先级: 低）

**来源**: `ChatPanel/main.vue` 的 `handleRichSend`（68-92 行，25 行）

**提取内容**: 图片上传、文件上传、引用快照构造、云资源引用提取、`sendChat` 调用。

---

## 四、共享逻辑统一

### 4.1 AutoReply 切换逻辑（3 处重复）

**重复位置**:
- `MemberSidebar/main.vue`（129-135 行）`toggleAutoReply`
- `SettingsPanel/main.vue`（90-102 行）`watch(aiAutoReply, ...)`
- `useGlobalShortcuts.ts`（110-115 行）快捷键处理

**重复内容**: 计算下一个 boolean -> `saveSettings(myId, { ai_auto_reply: next })` -> 条件调用 `ctx.autoReplyDispose?.()`

**方案**: 在 `useMemberSettings` 中添加统一的 `toggleAutoReply` 方法，三处调用统一入口。

### 4.2 执行模式切换逻辑（2 处重复）

**重复位置**: `MemberSidebar/main.vue`（124-127 行）、`useGlobalShortcuts.ts`（119-121 行）

**方案**: 在 `useMemberSettings` 中添加 `toggleExecutionMode` 方法。

### 4.3 Peer ID 解析（3 处重复）

**重复位置**: `useMessages.ts` 第 35 行、第 112 行、`sendChat` 内

**重复内容**: `channel ? "__team__" : (from === myId ? to : from)`

**方案**: 提取为 `resolvePeerId(msg, myId)` 到 `src/utils/messageMapper.ts`。

### 4.4 ChatMessage 构造（3 处重复）

**重复位置**: `useMessages.ts` 的 `handleIncomingMessage`（94-111 行）、`sendChat` 成功分支（189-206 行）、`sendChat` 回退分支（210-228 行）

**方案**: 提取 `buildChatMessage` 工厂函数，消除对象字面量重复。

---

## 五、状态管理规范

### 5.1 禁止设置面板的影子状态

**问题文件**: `SettingsPanel/main.vue`（38-51 行）、`QuickSettingsPanel/main.vue`（22-23 行）

**问题**: 调用 `loadSettings` 后将字段复制到本地 ref（`executionMode`、`workingDirectory`、`aiHistoryCount`、`aiAutoReply`），造成与 `useMemberSettings` 内部 `_settings` 的双源真相。

**方案**: 使用 computed getter/setter 绑定到共享 settings ref：

```ts
const executionMode = computed({
  get: () => settings.value.execution_mode ?? "local",
  set: (val) => saveSettings(myId, { execution_mode: val }),
});
```

### 5.2 禁止组件直接依赖 API 层

**问题文件**: `TaskDetailPanel/main.vue` 直接 import `managerFetch` 和 envoy core 的 `Task` 类型。

**方案**: 数据获取和类型转换封装在 `useTaskLiveData` composable 中（见 3.1）。

### 5.3 CloudResourcesPanel 必须使用 useConfirm

**问题**: `CloudResourcesPanel/main.vue` 手写了 `deleteConfirm` ref 和内联确认对话框模板，违反 CLAUDE.md "所有确认对话框必须使用 useConfirm" 规范。

**方案**: 替换为 `showConfirm("删除确认", msg, () => { ... }, true)` 调用，移除内联对话框。

### 5.4 SettingsPanel 退出确认对话框

**问题**: `SettingsPanel/main.vue`（128-136 行，模板 262-278 行）手写了 Teleport 退出确认对话框，管理 `showLogoutConfirm` 本地状态。

**方案**: 使用已有的 `useConfirm` 或提取 `LogoutDialog` 组件。

---

## 六、架构级优化

### 6.1 全局单例 vs provide/inject 统一

**现状**: 同一个 `TeamClientContext` 通过两种方式分发：
1. Vue provide/inject（`TeamClientKey` 在 `ChatView` 提供，8 个子组件注入）
2. 模块级单例（`teamClientContext.ts` 的 `_instance` shallowRef，App.vue 通过 `useTeamClientInstance()` 读取）

**风险**: 组件从 ChatView 子树移动到其他位置后，`inject(TeamClientKey)` 返回 undefined。

**方案**: 统一为模块级单例。应用同时只有一个 TeamClient，单例更简单。逐步将 `inject` 调用替换为 `getTeamClientInstance()`。

### 6.2 全屏图片查看器单例化

**问题**: `BubbleContent/main.vue` 每个消息气泡创建独立的 `useFullscreenViewer()` 实例和 `Teleport`。50 条消息 = 50 个 viewer 实例。

**方案**: 将 viewer 提升到 `ChatPanel` 或 `App` 层作为单例，`BubbleContent` 仅 emit `open-fullscreen` 事件。

### 6.3 document 级事件监听器优化

**问题**: `MessageBubble`（96 行）和 `BubbleContent`（116 行）在 `<script setup>` 顶层调用 `document.addEventListener("keydown", ...)`。N 条消息产生 2N 个 keydown 监听器。

**方案**:
1. 立即修复: 将监听器移到 `onMounted`/`onUnmounted` 中（当前在 setup 顶层）
2. 进阶: 将 keydown 监听提升到 ChatPanel 层统一处理
3. 最优: 使用单例 composable 管理

### 6.4 useTeamClient 拆分建议

**现状**: `useTeamClient.ts`（221 行）是 God composable，编排了连接、消息、任务、自动回复、用户配置、桌面通知、Dock badge 等所有子系统。

**具体拆分**:
- `useTaskNotifications`（~75 行）-- 任务状态到桌面通知的映射逻辑（当前在 useTeamClient 88-164 行）
- 消息处理器的关注点拆分 -- 当前 `client.on("message", ...)` 混合了成员列表更新、频道提及通知、聊天消息分发三个关注点

### 6.5 useTaskActions 数据耦合修复

**问题**: `useTaskActions` 内部重新计算 `clientResults`（第 27 行），与 `useTaskResources` 已导出的 `clientResults` 完全相同。两个 composable 从同一数据源独立派生。

**方案**: `useTaskActions` 应接收 `clientResults` 参数或完整 `useTaskResources` 返回值，而非重新 filter。

---

## 七、MessageBubble 内部优化

### 7.1 BubbleContent 三次实例化

**问题**: MessageBubble 中 `BubbleContent` 实例化 3 次（频道他人、频道自己、私聊），props 几乎完全相同，仅 `showSender` 和 `senderName` 不同。

**方案**: 计算一次 `bubbleContentProps` 对象，通过 `v-bind` 传入。

### 7.2 转发历史对话框提取

**问题**: MessageBubble（219-245 行）包含完整的 Teleport 转发历史对话框和独立的文件下载逻辑。

**方案**: 提取为 `ForwardedHistoryDialog` 独立组件。

### 7.3 Avatar + HoverCard 封装

**问题**: MessageBubble 管理 `useHoverCard` 实例、avatar 渲染、hover 事件处理，在频道他人和自己两处重复。

**方案**: 提取 `AvatarWithHover` 组件，封装头像 + `MemberHoverCard`。

---

## 八、执行优先级

### P0 -- 立即修复（违反已有规范）

| # | 任务 | 影响 |
|---|---|---|
| 1 | CloudResourcesPanel 使用 useConfirm | 消除违规代码 |
| 2 | AutoReply 切换逻辑统一到 useMemberSettings | 消除 3 处重复 |
| 3 | SettingsPanel 退出确认改用 useConfirm | 消除违规代码 |

### P1 -- 高收益重构

| # | 任务 | 预估减少行数 |
|---|---|---|
| 4 | 提取 4 个共享子组件（TaskActionButtons/FileList/ReviewList/TraceBlock） | ~154 行 |
| 5 | 提取 useTaskLiveData | ~60 行 |
| 6 | 提取 useCloudFiles | ~75 行 |
| 7 | SettingsPanel/QuickSettingsPanel 消除影子状态 | ~40 行 |
| 8 | 全屏查看器单例化 | ~20 行 + 性能 |

### P2 -- 中期改善

| # | 任务 | 预估减少行数 |
|---|---|---|
| 9 | 拆分 useAI -> useAIChat + useAITask | 改善可维护性 |
| 10 | ChatMessage 构造 + Peer ID 解析统一 | ~30 行 |
| 11 | MessageBubble BubbleContent 统一 props | ~20 行 |
| 12 | useTaskActions 数据耦合修复 | 消除冗余计算 |

### P3 -- 架构优化

| # | 任务 |
|---|---|
| 13 | provide/inject -> 全局单例统一 |
| 14 | document 事件监听器提升 |
| 15 | useTeamClient 拆分（通知/消息处理器） |
| 16 | 提取 useChatSend |
| 17 | 提取 AvatarWithHover / ForwardedHistoryDialog |
