## Why

当前 Client 的任务队列（`queue` / `running`）是 `private` 状态，UI 层无法感知本地 Client 正在排队、执行或已完成哪些任务。用户只能通过 Manager 服务端的 TaskCenterView 看到任务的全局状态，无法直观了解"当前登录的 Client 有哪些任务在排队、正在执行到第几步"。

## What Changes

- 扩展 `envoy/packages/client/client.ts`，将队列状态从 private 改为可通过 getter 和事件访问
- Client 新增 5 个事件（`task_queued`、`task_started`、`task_completed`、`task_failed`、`task_skipped`）用于通知队列状态变化
- Client 新增 `taskHistory` 数组，保留最近 20 条已完成任务的记录
- 新增 `useClientTaskQueue` composable，订阅 Client 事件并维护 Vue 响应式状态，同时桥接 `useAgent` 的 `currentStep` / `isRunning`
- `useTeamClient` 和 `teamClientContext` 透传 agent 状态和队列 composable
- 新增 `TaskQueuePanel` 组件，以垂直队列布局展示 Running / Queued / Recent 三个区域
- MemberSidebar 新增 `__queue__` 入口，ChatView 路由对应面板

## Capabilities

### New Capabilities

- `client-task-queue-visibility`: 将 Client 内部队列状态（排队、执行中、历史）暴露为可订阅的事件和响应式数据
- `task-queue-panel`: 垂直队列可视化面板，展示当前 Client 的任务队列状态，包括 Agent 执行进度

### Modified Capabilities

- `envoy-client`: Client 类新增队列事件和 getter，不改现有行为（autoSendResult、doing handler、processNext 逻辑不变）

## Impact

- **框架层改动**: `envoy/packages/client/client.ts` 新增约 30 行（事件定义、getter、emit 调用），不影响现有 API
- **新增文件**:
  - `src/composables/useClientTaskQueue.ts` (~60 行) — 队列状态桥接
  - `src/components/TaskQueuePanel/main.vue` (~80 行) — 面板模板
  - `src/components/TaskQueuePanel/styles.css` (~100 行) — 队列样式
  - `src/components/TaskQueuePanel/index.ts` — 导出
- **修改文件**:
  - `src/composables/useTeamClient.ts` — 透传 agent 状态，初始化 useClientTaskQueue
  - `src/composables/teamClientContext.ts` — 注册全局 getter
  - `src/components/MemberSidebar/main.vue` — 新增 `__queue__` 工具入口
  - `src/views/ChatView/main.vue` — 路由 `__queue__` 到 TaskQueuePanel

## Scope

- 仅涉及 Client 侧本地队列可视化，不涉及 Manager 服务端改动
- 不新增 REST API 端点
- 不引入新的第三方可视化库，纯 CSS + SVG 实现
- History 保留最近 20 条，不做持久化（页面刷新后清空）
