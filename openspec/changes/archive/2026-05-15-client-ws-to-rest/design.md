## Context

当前 EnvoyClient 的 `sendChat`（`client.sendTo()`）和 `dispatchTask`（`client.submit()`）直接通过 WS 发送到 Envoy Server，Server 负责中转。

目标：这两个操作改为调 Manager REST API，Manager 内部通过 Team 实例的 Server 桥接到 WS。WS 连接退化为纯被动监听角色。

当前 Server 类（`envoy/packages/server/server.ts`）的 `transport.send()` 和 `handleSubmit()` 都是 private，无法从外部（Manager 路由）调用。需要暴露公开方法。

## Goals / Non-Goals

**Goals:**
- `sendChat` 改为 `POST /api/messages`，Manager 转发到目标客户端 WS
- `dispatchTask` 改为 `POST /api/tasks`，Manager 通过 Server 的 submit 逻辑 dispatch 到 Member
- REST 请求通过 `team` header 标识目标团队
- WS 连接只保留被动监听（接收消息、任务派发、成员变化、状态事件）

**Non-Goals:**
- Member 的 `doing()` 和 `sendResult` 流程不变
- 消息历史存储不变（继续走 Tauri IPC 本地存储）
- 不改 Envoy 的消息协议格式
- 不做鉴权（当前阶段 REST 和 WS 一样无鉴权）

## Decisions

### 1. 给 Envoy Server 暴露 `relay()` 和 `submitFrom()` 公开方法

**选择**: 在 Server 类上新增两个公开方法：
- `relay(fromId, toId, subtype, payload)` — 向指定客户端发送 message 类型消息
- `submitFrom(fromId, options)` — 触发任务提交（复用内部 handleSubmit 逻辑）

**备选方案**: 直接访问 `server.transport`，但 transport 是 private 且不应暴露。
**理由**: Server 是中转中心，消息转发和任务派发本就是它的职责，暴露方法比暴露内部实现更干净。

### 2. REST 路由使用 `team` header 而非 URL path

**选择**: `POST /api/messages` + `Header: team: alpha`，而非 `POST /api/teams/alpha/messages`
**理由**: 用户明确要求。客户端设一次 header 即可，所有请求自动携带。URL 更扁平。

### 3. 客户端新增 `apiRequest` 工具函数

**选择**: 在 `useTeamClient.ts` 或独立 composable 中封装 `apiRequest(path, body)`，统一处理 base URL 和 team header。
**理由**: Manager 地址和 team 名在连接时已知，封装后 `sendChat`/`dispatchTask` 调用简洁。

### 4. 路由放在新文件 `routes/messages.ts`

**选择**: 新建 `manager/server/routes/messages.ts`，挂载 `POST /api/messages` 和 `POST /api/tasks`。
**备选方案**: 扩展 `routes/teams.ts`。
**理由**: messages 和 tasks 是客户端操作接口，语义上区别于团队管理（CRUD），独立文件更清晰。

## Risks / Trade-offs

- **[Envoy Server 改动]** → 改动量极小（加 2 个方法），不影响现有 WS 流程，向后兼容
- **[离线发送]** → REST 发消息时目标客户端可能不在线。当前 WS `sendTo` 也有同样问题（消息丢失），不引入额外风险
- **[Manager 单点]** → Manager 挂了则 REST 不可用，但 WS 连接也依赖 Manager，风险对等
