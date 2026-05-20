## MODIFIED Requirements

### Requirement: Manager REST endpoint for sending chat messages

Manager SHALL 提供 `POST /api/messages` 路由。请求 SHALL 通过 `team` header 标识目标团队。请求 body 包含 `from`（发送者 ID）、`to`（接收者 ID）、`text`（消息内容）。body SHALL 可选包含 `cloudRefs`（`CloudRef[]`，云资源引用数组）。Manager SHALL 通过对应 Team 实例的 Server 调用 `relay()` 转发消息，payload 中 SHALL 包含 `cloudRefs`（如有）。

#### Scenario: Successful message send
- **WHEN** POST /api/messages，header `team: alpha`，body `{ from: "leader1", to: "member1", text: "hello" }`，且 team alpha 存在且 member1 在线
- **THEN** 返回 `{ ok: true }`，member1 通过 WS 收到 chat 消息

#### Scenario: Team not found
- **WHEN** POST /api/messages，header `team: unknown`
- **THEN** 返回 `{ error: "team not found" }`，status 404

#### Scenario: Missing required fields
- **WHEN** POST /api/messages，body 缺少 `from`、`to` 或 `text`
- **THEN** 返回 `{ error: "from, to, text are required" }`，status 400

#### Scenario: Send message with cloud references
- **WHEN** POST /api/messages，body 包含 `{ from: "alice", to: "bob", text: "看下{cloud:0}", cloudRefs: [{ name: "report.pdf", path: "docs/report.pdf", type: "file", size: 1024000 }] }`
- **THEN** 返回 `{ ok: true }`，bob 通过 WS 收到包含 `cloudRefs` 的 chat 消息

#### Scenario: Cloud refs relay to recipient
- **WHEN** Manager relay 一条包含 `cloudRefs` 的消息给接收方
- **THEN** 接收方通过 WS 收到的 payload 中包含完整的 `cloudRefs` 数组

### Requirement: Client uses REST API for sendChat

`useTeamClient.ts` 的 `sendChat` 函数 SHALL 使用 `fetch POST /api/messages` 替代 `client.sendTo()`。请求 SHALL 携带 `team` header 和 `Content-Type: application/json`。`sendChat` SHALL 可选接受 `cloudRefs` 参数，如有则包含在请求 body 中。本地消息仍通过 `addToConversation` 添加到 UI 和 Tauri IPC 存储。

#### Scenario: Send chat message via REST
- **WHEN** 用户发送聊天消息，调用 `sendChat("member1", "hello")`
- **THEN** 前端通过 POST /api/messages 发送请求，本地 UI 立即显示消息（乐观更新），消息通过 Tauri IPC 保存到本地历史

#### Scenario: Send chat message with cloud references
- **WHEN** 调用 `sendChat("member1", "看下{cloud:0}", { cloudRefs: [{ name: "report.pdf", path: "docs/report.pdf", type: "file", size: 1024000 }] })`
- **THEN** POST /api/messages body 包含 `cloudRefs` 字段，本地消息的 ChatMessage 对象也包含 `cloudRefs`
