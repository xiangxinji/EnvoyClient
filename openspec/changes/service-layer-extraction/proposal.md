## Why

当前客户端的操作逻辑（消息发送、任务操作、云资源管理、用户资料）散落在 composable、api.ts、甚至 .vue 组件中，没有统一的抽象层。这导致：(1) 相同操作在不同地方重复实现（如 `managerPost` 直接在 7+ 个文件中出现）；(2) 无法为 AI Agent 提供标准化的 tool 调用接口；(3) 业务逻辑无法独立于 Vue 响应式进行单元测试。

## What Changes

- 新增纯 TypeScript Service 层（class），作为 UI 操作的唯一中间层
- Service 只负责 command（发送操作），不负责 query/接收（事件监听留在 composable）
- 所有 Service 方法保证参数不可变性（readonly）和操作原子性（一个方法 = 一个完整业务操作）
- `api.ts` 中的 cloud 函数全部迁移到 `CloudResourceService`
- `api.ts` 中的 profile 函数全部迁移到 `UserProfileService`
- Composable 层改为调用 Service，不再直接使用 `managerPost` / `managerFetch`
- `.vue` 组件禁止直接 import `api.ts` 的业务函数

## Capabilities

### New Capabilities

- `message-service`: 消息发送操作的服务封装（send / revoke / uploadAttachment）
- `cloud-resource-service`: 云资源文件操作的服务封装（list / upload / download / search / delete / createDirectory / validatePaths / getStats）
- `task-service`: 任务生命周期操作的服务封装（dispatch / start / complete / submitResult / uploadResource / fetchDetail / downloadResourceUrl）
- `user-profile-service`: 用户资料操作的服务封装（fetchProfiles / updateProfile / uploadAvatar）

### Modified Capabilities

_(无现有 spec 的需求变更，本次是新增抽象层，不改 API 行为)_

## Impact

- **新增文件**: `src/services/MessageService.ts`、`CloudResourceService.ts`、`TaskService.ts`、`UserProfileService.ts`、`types.ts`
- **修改文件**:
  - `src/api.ts` — 移除 cloud 和 profile 函数，只保留 HTTP 基础设施
  - `src/composables/useMessages.ts` — 内部调用 MessageService
  - `src/composables/useFileUpload.ts` — 内部调用 MessageService.uploadAttachment
  - `src/composables/useTaskActions.ts` — 内部调用 TaskService
  - `src/composables/useTaskExecution.ts` — 内部调用 TaskService
  - `src/composables/useTaskLiveData.ts` — 内部调用 TaskService
  - `src/composables/useTeamClient.ts` — 内部调用 TaskService.dispatch
  - `src/composables/useUserProfile.ts` — 内部调用 UserProfileService
  - `src/components/CloudResourcesPanel/main.vue` — 改为通过 composable 或 service 调用
- **不涉及**: 后端 API 端点、WebSocket 协议、Tauri IPC
