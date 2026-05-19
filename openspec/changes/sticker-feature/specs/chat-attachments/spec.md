## MODIFIED Requirements

### Requirement: Message relay extension
`POST /api/messages` 支持 `attachments` 字段在 body 中。Relay 通过 WebSocket 转发时连同 attachments 一起发送。系统 SHALL 同时支持 `sticker` 字段的透传。当消息 body 包含 `sticker` 对象时，relay SHALL 将其原样转发到目标客户端。

#### Scenario: 发送带 sticker 字段的消息
- **WHEN** POST `/api/messages` body 包含 `sticker: { url, name }`
- **THEN** Manager 将 sticker 字段存入 SQLite `extra` JSON 列，并通过 WebSocket relay 原样转发给目标客户端

#### Scenario: 接收带 sticker 字段的消息
- **WHEN** 客户端收到 WebSocket 消息 payload 包含 `sticker` 字段
- **THEN** 客户端将 `sticker` 字段解析为 `StickerInfo` 对象，纳入 ChatMessage

### Requirement: Receive messages with attachments
`useMessages` 的 `handleIncomingMessage` 从 payload 解析 `attachments` 构建 `ChatMessage`。系统 SHALL 同时检测并解析 `sticker` 字段。当 payload 包含 `sticker` 时，将其解析为 `StickerInfo` 并设置到 ChatMessage 的 `sticker` 字段。

#### Scenario: 接收包含 sticker 的消息
- **WHEN** `handleIncomingMessage` 处理的 payload 包含 `sticker: { url, name }`
- **THEN** 构建的 ChatMessage 的 `sticker` 字段设置为 `{ url, name }`

#### Scenario: 接收不含 sticker 的消息
- **WHEN** `handleIncomingMessage` 处理的 payload 不包含 `sticker` 字段
- **THEN** ChatMessage 的 `sticker` 字段为 `undefined`，行为不变
