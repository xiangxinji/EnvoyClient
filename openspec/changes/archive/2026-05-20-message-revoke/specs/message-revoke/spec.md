## ADDED Requirements

### Requirement: Revoked notice type in TimelineItem

系统 SHALL 在 `TimelineItem` 联合类型中新增 `RevokedNotice` 类型，用于表示被撤回的消息占位。

```typescript
interface RevokedNotice {
  type: "revoked";
  id: string;       // 原消息 id
  seq: number;
  from: string;
  timestamp: number;
}
```

#### Scenario: Revoke notice in timeline
- **WHEN** 接收到撤回通知
- **THEN** 原消息被替换为 `RevokedNotice` 对象，type 为 "revoked"，保留原消息的 id、seq、from、timestamp

### Requirement: Right-click context menu on own chat messages

ChatPanel SHALL 在用户右键自己发送的聊天消息时显示上下文菜单，提供"撤回"选项。任务消息不显示此菜单。

#### Scenario: Right-click own chat message
- **WHEN** 用户右键一条 `mine === true` 且 `type === "chat"` 的消息
- **THEN** 在鼠标位置显示上下文菜单，包含"撤回"选项

#### Scenario: Right-click others message
- **WHEN** 用户右键一条 `mine === false` 的消息
- **THEN** 不显示上下文菜单

#### Scenario: Right-click task message
- **WHEN** 用户右键一条 `type === "task"` 的消息
- **THEN** 不显示上下文菜单

### Requirement: Revoke message action

系统 SHALL 在用户点击"撤回"后调用 `DELETE /api/messages/:id`，并从本地 conversation 中移除该消息。

#### Scenario: Successful revoke
- **WHEN** 用户点击"撤回"，API 返回成功
- **THEN** 该消息从发送方本地 conversation 数组中移除

#### Scenario: Revoke API failure
- **WHEN** 用户点击"撤回"，API 返回错误
- **THEN** 显示错误提示，消息不被移除

### Requirement: Revoked notice display for receiver

接收方 SHALL 在收到 `chat-revoke` 通知后，将本地 conversation 中对应消息替换为灰色居中的"XX 撤回了一条消息"占位提示，XX 为发送者 ID。

#### Scenario: Receiver sees revoke notice
- **WHEN** 接收方收到 `subtype === "chat-revoke"` 的消息，payload 包含 `{ msgId: "xxx" }`
- **THEN** conversation 数组中对应 msgId 的消息被替换为 `RevokedNotice` 类型，UI 渲染为灰色居中的"发送者ID 撤回了一条消息"

#### Scenario: Receiver has no matching local message
- **WHEN** 接收方收到撤回通知但本地 conversation 中找不到对应 msgId
- **THEN** 撤回通知被静默忽略

### Requirement: Revoke message exposed from useTeamClient

`useTeamClient` SHALL 暴露 `revokeMessage(peerId: string, msgId: string)` 方法，封装撤回 API 调用和本地状态更新。

#### Scenario: Call revokeMessage
- **WHEN** 调用 `revokeMessage("member1", "msg-123")`
- **THEN** 发送 `DELETE /api/messages/msg-123`，成功后从 peerId 对应的 conversation 中移除该消息
