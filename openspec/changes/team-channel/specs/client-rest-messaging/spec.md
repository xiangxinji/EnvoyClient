## MODIFIED Requirements

### Requirement: Manager REST endpoint for sending chat messages
Manager SHALL 提供 `POST /api/messages` 路由。请求 SHALL 通过 `team` header 标识目标团队。请求 body 包含 `from`（发送者 ID）、`to`（接收者 ID，私聊必填）、`text`（消息内容）。当 body 包含 `channel` 字段时，SHALL 执行频道广播逻辑。频道消息 body 可包含 `mentions` 数组。

#### Scenario: Successful private message send
- **WHEN** POST /api/messages，header `team: alpha`，body `{ from: "leader1", to: "member1", text: "hello" }`，且 team alpha 存在且 member1 在线
- **THEN** 返回 `{ ok: true, id, seq }`，member1 通过 WS 收到 chat 消息

#### Scenario: Successful channel message send
- **WHEN** POST /api/messages，header `team: alpha`，body `{ from: "leader1", channel: "general", text: "大家好", mentions: ["bob"] }`，且 team alpha 存在
- **THEN** 返回 `{ ok: true, id, seq }`，消息存入 DB（to_user = "__team__", channel = "general", mentions = '["bob"]'），所有在线成员（排除 leader1）通过 WS 收到 chat 消息

#### Scenario: Channel message validation
- **WHEN** POST /api/messages，body 包含 `channel` 字段但缺少 `to` 字段
- **THEN** 验证通过（频道消息 `to` 非必填，Manager 自动设为 `"__team__"`）

#### Scenario: Team not found
- **WHEN** POST /api/messages，header `team: unknown`
- **THEN** 返回 `{ error: "team not found" }`，status 404

#### Scenario: Missing required fields
- **WHEN** POST /api/messages，body 缺少 `from` 或 `text`
- **THEN** 返回 `{ error: "from, text are required" }`，status 400

### Requirement: Manager message sync supports channel messages
Manager SHALL 在 `GET /api/messages/sync` 中返回频道消息。sync 查询 SHALL 同时包含私聊消息和频道消息。

#### Scenario: Sync includes channel messages
- **WHEN** GET /api/messages/sync?user=alice&after_seq=100&limit=200，且频道有新消息
- **THEN** 返回结果包含频道消息（channel = "general"），以及 Alice 的私聊消息

#### Scenario: Channel messages in sync result
- **WHEN** sync 返回一条频道消息
- **THEN** 该消息的 `to_user` 为 `"__team__"`，`channel` 为 `"general"`，`mentions` 为 JSON 数组或 null

### Requirement: Manager message revoke supports channel broadcast
Manager SHALL 在频道消息撤回时广播 `chat-revoke` 给所有在线团队成员，而非仅发给单个接收者。

#### Scenario: Revoke channel message
- **WHEN** DELETE /api/messages/:id?from=alice，且该消息 channel = "general"
- **THEN** Manager 验证 from_user === alice，删除消息，通过 Team.broadcastChat() 广播 chat-revoke 给所有在线成员

#### Scenario: Revoke private message (unchanged)
- **WHEN** DELETE /api/messages/:id?from=alice，且该消息 channel IS NULL
- **THEN** 保持现有行为：Manager 删除消息，通过 relay 发送 chat-revoke 给 to_user
