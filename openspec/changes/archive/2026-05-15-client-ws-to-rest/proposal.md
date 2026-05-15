## Why

当前 EnvoyClient 的所有主动操作（发送聊天、派发任务）都通过 WS 协议直接发送。随着系统演进，需要支持更多非实时操作（如后续的文件共享、审批流等），统一走 REST API 便于扩展、鉴权和日志审计。WS 连接应专注于实时推送（接收消息、任务派发通知），职责更清晰。

## What Changes

- 新增 Manager REST 路由 `POST /api/messages`，接收聊天消息并转发到目标客户端的 WS 连接
- 新增 Manager REST 路由 `POST /api/tasks`，接收任务派发请求并通过 Team 实例的 WS 连接 dispatch 到 Member
- 所有 REST 请求通过 `team` header 标识目标团队
- `useTeamClient.ts` 中 `sendChat` 从 `client.sendTo()` 改为 `fetch POST /api/messages`
- `useTeamClient.ts` 中 `dispatchTask` 从 `client.submit()` 改为 `fetch POST /api/tasks`
- Manager `index.ts` 挂载新路由

## Capabilities

### New Capabilities
- `client-rest-messaging`: 客户端通过 Manager REST API 发送聊天消息和派发任务，Manager 内部桥接到 WS 连接进行实时转发

### Modified Capabilities
<!-- 无现有 spec 需要修改 -->

## Impact

- **Manager 后端**: 新增 `routes/messages.ts`（或扩展 `routes/teams.ts`），需要在路由层访问 Team 实例池以获取 WS 连接
- **客户端 composable**: `useTeamClient.ts` 的 `sendChat` 和 `dispatchTask` 实现从 WS 调用改为 REST fetch
- **API 客户端**: 需要一个基础的 REST 请求封装，统一处理 team header 和 Manager 地址
- **向后兼容**: WS 连接仍保留用于接收，Member 的 `doing()` 和 `sendResult` 流程不变
