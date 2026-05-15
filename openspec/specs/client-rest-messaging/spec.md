## ADDED Requirements

### Requirement: Server exposes relay method for message forwarding

Envoy Server 类 SHALL 提供公开方法 `relay(fromId, toId, subtype, payload)`，用于向指定在线客户端发送 message 类型消息。方法 SHALL 复用内部 `transport.send()` 和 `createMessage()` 逻辑。

#### Scenario: Relay chat message to online client
- **WHEN** 调用 `server.relay("leader1", "member1", "chat", { text: "hello" })`
- **THEN** Server 构造 type=message 的消息并通过 WS 发送给 client "member1"

#### Scenario: Relay to offline client
- **WHEN** 调用 `server.relay("leader1", "member1", "chat", { text: "hello" })` 且 member1 不在线
- **THEN** 消息被静默忽略（不报错，与当前 WS sendTo 行为一致）

### Requirement: Server exposes submitFrom method for task dispatch

Envoy Server 类 SHALL 提供公开方法 `submitFrom(fromId, options: SubmitOptions)`，用于从外部触发任务提交流程。方法 SHALL 复用内部 `handleSubmit` 的全部逻辑（创建 Task、dispatch 到 subscribe 成员、通知状态变更）。

#### Scenario: Submit task from REST API
- **WHEN** 调用 `server.submitFrom("leader1", { content: "do something", subscribe: ["member1"], mode: "serial" })`
- **THEN** Server 创建 Task 并 dispatch 到 member1，行为与 WS submit 完全一致

### Requirement: Manager REST endpoint for sending chat messages

Manager SHALL 提供 `POST /api/messages` 路由。请求 SHALL 通过 `team` header 标识目标团队。请求 body 包含 `from`（发送者 ID）、`to`（接收者 ID）、`text`（消息内容）。Manager SHALL 通过对应 Team 实例的 Server 调用 `relay()` 转发消息。

#### Scenario: Successful message send
- **WHEN** POST /api/messages，header `team: alpha`，body `{ from: "leader1", to: "member1", text: "hello" }`，且 team alpha 存在且 member1 在线
- **THEN** 返回 `{ ok: true }`，member1 通过 WS 收到 chat 消息

#### Scenario: Team not found
- **WHEN** POST /api/messages，header `team: unknown`
- **THEN** 返回 `{ error: "team not found" }`，status 404

#### Scenario: Missing required fields
- **WHEN** POST /api/messages，body 缺少 `from`、`to` 或 `text`
- **THEN** 返回 `{ error: "from, to, text are required" }`，status 400

### Requirement: Manager REST endpoint for dispatching tasks

Manager SHALL 提供 `POST /api/tasks` 路由。请求 SHALL 通过 `team` header 标识目标团队。请求 body 包含 `from`（发起者 ID）、`content`（任务内容）、`subscribe`（目标成员 ID 数组）、`mode`（serial/parallel）。Manager SHALL 通过对应 Team 实例的 Server 调用 `submitFrom()` 派发任务。

#### Scenario: Successful task dispatch
- **WHEN** POST /api/tasks，header `team: alpha`，body `{ from: "leader1", content: "task", subscribe: ["member1"], mode: "serial" }`，且 team alpha 存在
- **THEN** 返回 `{ ok: true, taskId: "task-xxx" }`，member1 通过 WS 收到 dispatch

#### Scenario: Team not found
- **WHEN** POST /api/tasks，header `team: unknown`
- **THEN** 返回 `{ error: "team not found" }`，status 404

#### Scenario: Missing required fields
- **WHEN** POST /api/tasks，body 缺少 `from`、`content` 或 `subscribe`
- **THEN** 返回 `{ error: "from, content, subscribe are required" }`，status 400

### Requirement: Client uses REST API for sendChat

`useTeamClient.ts` 的 `sendChat` 函数 SHALL 使用 `fetch POST /api/messages` 替代 `client.sendTo()`。请求 SHALL 携带 `team` header 和 `Content-Type: application/json`。本地消息仍通过 `addToConversation` 添加到 UI 和 Tauri IPC 存储。

#### Scenario: Send chat message via REST
- **WHEN** 用户发送聊天消息，调用 `sendChat("member1", "hello")`
- **THEN** 前端通过 POST /api/messages 发送请求，本地 UI 立即显示消息（乐观更新），消息通过 Tauri IPC 保存到本地历史

### Requirement: Client uses REST API for dispatchTask

`useTeamClient.ts` 的 `dispatchTask` 函数 SHALL 使用 `fetch POST /api/tasks` 替代 `client.submit()`。请求 SHALL 携带 `team` header。

#### Scenario: Dispatch task via REST
- **WHEN** Leader 派发任务，调用 `dispatchTask(["member1"], "do something")`
- **THEN** 前端通过 POST /api/tasks 发送请求，Member 通过 WS 收到 dispatch 并进入 doing 处理
