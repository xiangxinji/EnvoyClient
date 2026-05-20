## Why

TaskCard 当前承载了过多信息（结果、轨迹、资源、审核、操作按钮），没有独立的详情视图，导致卡片臃肿且无法展示完整信息。同时任务完成/失败/待审核时用户无感知——状态变更通过 WebSocket 静默推送到 UI，但没有任何桌面级通知，用户必须主动查看任务中心才能知道任务进展。

## What Changes

- 新增 TaskDetailPanel 组件：slide-over 面板，从右侧滑入，展示任务完整信息、事件时间线、执行结果/轨迹、资源文件和操作按钮
- Envoy core Resource 接口加 `timestamp` 字段：server.ts 中 `addResource()` 自动填充 `Date.now()`，为时间线提供数据基础
- Client TaskResource 类型同步加 `timestamp` 字段
- 集成 Tauri notification 插件：在任务 dispatched/completed/failed/reviewing 状态变更时发送系统桌面通知给相关用户
- 浏览器环境不支持桌面通知，使用 safeInvoke 模式静默跳过

## Capabilities

### New Capabilities
- `task-detail-panel`: 任务详情 slide-over 面板，包含基本信息、事件时间线、成员执行结果、资源文件、操作按钮
- `task-desktop-notification`: 基于 Tauri notification 插件的桌面推送通知，在任务状态变更时通知相关用户

### Modified Capabilities
- `resource-timestamp`: Envoy core Resource 接口新增 `timestamp` 字段，Manager addResource 自动填充

## Impact

- **Envoy framework** (`envoy/packages/core/task.ts`, `envoy/packages/server/server.ts`): Resource 接口加 timestamp，addResource() 填充
- **Client frontend** (`src/types.ts`, `src/views/ChatView.vue`, `src/components/TaskCard.vue`, `src/views/TaskCenterView.vue`, `src/composables/useTeamClient.ts`): 类型更新、新增 TaskDetailPanel 组件、ChatView 布局改造、通知触发逻辑
- **Tauri backend** (`src-tauri/Cargo.toml`, `src-tauri/src/lib.rs`, `src-tauri/capabilities/default.json`): notification 插件接入
- **npm dependencies**: 新增 `@tauri-apps/plugin-notification`
- **Cargo dependencies**: 新增 `tauri-plugin-notification = "2"`
