## Why

当前聊天消息一旦发送即不可撤销。用户误发或发错消息后无法补救，需要撤回功能来修正错误。

## What Changes

- 新增消息撤回 API（`DELETE /api/messages/:id`），硬删除数据库记录并实时通知对方
- 新增 `chat-revoke` 消息 subtype，通过 Envoy relay 通道通知接收方
- 新增 `RevokedNotice` 类型到 `TimelineItem` 联合类型，用于渲染撤回占位
- 在 ChatPanel 层级实现右键上下文菜单，仅对自己发送的聊天消息显示"撤回"选项
- 任务消息（type=task）不支持撤回

## Capabilities

### New Capabilities
- `message-revoke`: 聊天消息撤回能力，涵盖右键菜单交互、删除 API、实时通知同步、占位渲染

### Modified Capabilities
- `client-rest-messaging`: 新增 DELETE /api/messages/:id 端点用于消息撤回

## Impact

- **后端**: `manager/server/db.ts`（新增 deleteMessage）、`manager/server/routes/messages.ts`（新增 DELETE 路由 + relay 通知）
- **前端类型**: `src/types.ts`（新增 RevokedNotice 类型）
- **消息处理**: `src/composables/useMessages.ts`（处理 chat-revoke 事件，删除/替换本地消息）
- **组合函数**: `src/composables/useTeamClient.ts`（暴露 revokeMessage 方法）
- **UI**: `src/components/ChatPanel.vue`（右键菜单）、`src/components/MessageBubble.vue`（冒泡 contextmenu 事件）
