## MODIFIED Requirements

### Requirement: Manager REST endpoint for sending chat messages
Manager SHALL 提供 `POST /api/messages` 路由。请求 SHALL 通过 `team` header 标识目标团队。请求 body 包含 `from`（发送者 ID）、`to`（接收者 ID）、`text`（消息内容）。Manager SHALL 先将消息 INSERT 到 SQLite messages 表（分配 UUID id 和自增 seq），再通过对应 Team 实例的 Server 调用 `relay()` 转发消息。返回值 SHALL 包含 `{ ok: true, id: "<uuid>", seq: <number> }`。

#### Scenario: Successful message send
- **WHEN** POST /api/messages，header `team: alpha`，body `{ from: "leader1", to: "member1", text: "hello" }`，且 team alpha 存在
- **THEN** 消息写入 SQLite，relay 给 member1，返回 `{ ok: true, id: "uuid-xxx", seq: 42 }`

#### Scenario: Team not found
- **WHEN** POST /api/messages，header `team: unknown`
- **THEN** 返回 `{ error: "team not found" }`，status 404

#### Scenario: Missing required fields
- **WHEN** POST /api/messages，body 缺少 `from`、`to` 或 `text`
- **THEN** 返回 `{ error: "from, to, text are required" }`，status 400

#### Scenario: Send to offline user
- **WHEN** POST /api/messages，目标用户不在线
- **THEN** 消息写入 SQLite，relay 静默跳过，仍返回 `{ ok: true, id: "uuid-xxx", seq: 43 }`

### Requirement: Client uses REST API for sendChat
`useMessages.ts` 的 `sendChat` 函数 SHALL 使用 `managerPost POST /api/messages` 发送消息。请求 SHALL 携带 `team` header。消息 SHALL 使用 Manager 返回的 `{ id, seq }` 作为本地 ChatMessage 的 id 和 seq 字段，替代原有的 `${Date.now()}-local` 临时 ID。

#### Scenario: Send chat message via REST with server ID
- **WHEN** 用户发送聊天消息，调用 `sendChat("member1", "hello")`
- **THEN** 前端通过 POST /api/messages 发送请求，收到 `{ id: "uuid-xxx", seq: 42 }` 后使用该 id 和 seq 创建本地 ChatMessage，消息立即显示在 UI

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

## ADDED Requirements

### Requirement: Manager sync endpoint for message retrieval
Manager SHALL 提供 `GET /api/messages/sync` 路由。详见 message-sync spec。

### Requirement: Manager conversations endpoint
Manager SHALL 提供 `GET /api/messages/conversations` 路由。详见 message-conversations spec。

### Requirement: WS relay message includes server ID and seq
Manager 的 relay 机制 SHALL 在转发消息时携带 Manager 分配的 `id` 和 `seq` 字段。接收客户端 SHALL 使用这些字段而非自行生成 ID。

#### Scenario: Relayed message format
- **WHEN** Manager relay 一条 chat 消息给接收方
- **THEN** 消息 payload 包含 `id`（UUID）和 `seq`（自增整数）字段
