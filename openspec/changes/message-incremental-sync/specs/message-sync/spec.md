## ADDED Requirements

### Requirement: Sync API endpoint
Manager SHALL 提供 `GET /api/messages/sync` 端点。请求 SHALL 通过 `team` query 参数指定团队，`after_seq` 指定同步起点（默认 0），`limit` 指定单次拉取数量（默认 200，最大 500）。SHALL 返回当前用户作为发送者或接收者、且 seq > after_seq 的所有消息，按 seq ASC 排序。

#### Scenario: Initial sync
- **WHEN** GET /api/messages/sync?team=alpha&after_seq=0&limit=200，用户 A 在团队 alpha 中
- **THEN** 返回 `{ messages: [...], has_more: boolean, last_seq: <number> }`，messages 包含所有 from_user=A 或 to_user=A 的消息

#### Scenario: Incremental sync
- **WHEN** GET /api/messages/sync?team=alpha&after_seq=100
- **THEN** 仅返回 seq > 100 且涉及当前用户的消息

#### Scenario: No new messages
- **WHEN** GET /api/messages/sync?team=alpha&after_seq=500 且无新消息
- **THEN** 返回 `{ messages: [], has_more: false, last_seq: 500 }`

#### Scenario: Pagination with has_more
- **WHEN** 有 300 条新消息但 limit=200
- **THEN** 返回前 200 条，`has_more: true`，客户端需再次请求 `after_seq=<last_seq>`

### Requirement: Client sync on connect
客户端 SHALL 在 WebSocket 连接成功后，调用 `GET /api/messages/sync` 拉取历史消息。首次连接使用 `after_seq=0`，后续重连使用上次收到的 `last_seq` 作为起点。SHALL 将拉取到的消息按 seq 顺序填充到内存中的 conversations Map。

#### Scenario: First connection
- **WHEN** 用户首次连接团队 alpha
- **THEN** 调用 sync API after_seq=0，获取全部历史，填充 conversations

#### Scenario: Reconnection with missed messages
- **WHEN** 用户断线重连，上次 last_seq=100，离线期间产生了 20 条新消息
- **THEN** 调用 sync API after_seq=100，获取 seq 101-120 的消息，追加到 conversations

#### Scenario: Large history pagination
- **WHEN** 首次连接且有 600 条历史消息，limit=200
- **THEN** 客户端循环请求直到 `has_more: false`，全部加载完成

### Requirement: Client uses server-assigned message ID and seq
客户端 sendChat() SHALL 使用 Manager 返回的 `{ id, seq }` 替代本地生成的 `${Date.now()}-local` ID。handleIncomingMessage() SHALL 使用消息中携带的 server id 和 seq。

#### Scenario: Send message with server ID
- **WHEN** 用户发送消息，POST /api/messages 返回 `{ id: "uuid-xxx", seq: 42 }`
- **THEN** 本地 ChatMessage 使用 `id: "uuid-xxx"` 和 `seq: 42`

#### Scenario: Receive message with server ID
- **WHEN** 客户端通过 WS relay 收到消息
- **THEN** 消息携带 server 分配的 id 和 seq，ChatMessage 直接使用
