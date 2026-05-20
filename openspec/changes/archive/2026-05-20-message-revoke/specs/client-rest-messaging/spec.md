## ADDED Requirements

### Requirement: Manager REST endpoint for revoking messages

Manager SHALL 提供 `DELETE /api/messages/:id` 路由。请求 SHALL 通过 `team` header 标识目标团队。请求 body 包含 `from`（调用者 ID）。Manager SHALL 验证调用者是消息的发送者后删除数据库记录，并通过 relay 通知接收方。

#### Scenario: Successful message revoke
- **WHEN** `DELETE /api/messages/msg-123`，header `team: alpha`，body `{ from: "leader1" }`，且消息存在且 from_user 为 leader1
- **THEN** 从 SQLite 删除该消息，通过 `team.innerServer.relay()` 发送 `subtype: "chat-revoke"` 的消息给接收方，payload 为 `{ msgId: "msg-123" }`，返回 `{ ok: true }`

#### Scenario: Message not found
- **WHEN** `DELETE /api/messages/nonexistent`，header `team: alpha`
- **THEN** 返回 `{ error: "message not found" }`，status 404

#### Scenario: Not the message sender
- **WHEN** `DELETE /api/messages/msg-123`，body `{ from: "member1" }`，但消息的 from_user 为 "leader1"
- **THEN** 返回 `{ error: "not authorized" }`，status 403

#### Scenario: Team not found
- **WHEN** `DELETE /api/messages/msg-123`，header `team: unknown`
- **THEN** 返回 `{ error: "team not found" }`，status 404

### Requirement: Database delete message function

`db.ts` SHALL 提供 `deleteMessage(teamName: string, msgId: string)` 函数，执行 `DELETE FROM messages WHERE id = ?`，并返回删除是否成功（是否影响了行）。

#### Scenario: Delete existing message
- **WHEN** 调用 `deleteMessage("alpha", "msg-123")` 且消息存在
- **THEN** 执行 DELETE 语句，返回 `true`

#### Scenario: Delete non-existent message
- **WHEN** 调用 `deleteMessage("alpha", "nonexistent")` 且消息不存在
- **THEN** 返回 `false`

### Requirement: Message handler recognizes chat-revoke subtype

`useMessages` 的 `handleIncomingMessage` SHALL 识别 `subtype === "chat-revoke"` 的消息，将本地 conversation 中对应 `msgId` 的消息替换为 `RevokedNotice`。

#### Scenario: Handle incoming revoke notification
- **WHEN** 收到 `type === "message"` 且 `subtype === "chat-revoke"` 的消息，payload 为 `{ msgId: "msg-123" }`
- **THEN** 在所有 conversation 中查找 id 为 "msg-123" 的 ChatMessage，将其替换为 `RevokedNotice` 对象，返回 `true`

#### Scenario: Handle revoke for unknown message
- **WHEN** 收到撤回通知但本地无匹配消息
- **THEN** 静默忽略，返回 `false`
