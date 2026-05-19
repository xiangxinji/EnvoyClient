## Why

当前聊天系统仅支持 1:1 私聊，团队成员之间无法进行群组讨论。实际协作中，Leader 通知全员、团队讨论方案、共享进展等场景都需要一个所有成员共享的对话空间。需要一个固定的团队频道（#general），让所有团队成员可以在同一会话中交流。

## What Changes

- ChatMessage 类型增加 `channel?: string` 和 `mentions?: string[]` 字段
- SQLite messages 表增加 `channel TEXT NULL` 和 `mentions TEXT` 列
- Manager `POST /api/messages` 支持频道消息：检测 `channel` 字段，写入单条记录后通过 Envoy Server 广播给所有在线团队成员
- Manager `GET /api/messages/sync` 增加频道消息查询：`WHERE channel = 'general'`
- Manager 消息撤回 `DELETE /api/messages/:id` 支持频道消息的广播撤回通知
- Envoy Team 类增加 `broadcastChat(fromId, subtype, payload)` 方法，遍历在线成员调用 `relay()`
- 客户端 useMessages 增加 `"__team__"` 作为频道 peerId，频道消息路由到该会话
- MemberSidebar 顶部增加固定的 #general 频道入口，显示未读角标
- ChatPanel 在频道模式下始终显示消息发送者名称
- ChatPanel 输入框支持 @提及：输入 `@` 弹出成员列表选择，支持 `@all` 全体提及
- 频道消息中 @提及 的成员收到额外的桌面通知
- 频道消息不触发 AI 自动回复
- 频道消息撤回仅限撤回自己的消息
- Tauri 本地历史持久化支持频道消息（peerId = `"__team__"`）

## Capabilities

### New Capabilities

- `team-channel`: 团队频道消息能力 — 固定 #general 频道，所有成员自动加入，Manager 端广播，@提及（含 @all），频道消息始终显示发送者，频道不触发 AI 自动回复

### Modified Capabilities

- `team-chat`: 侧边栏增加固定频道入口（#general），ChatPanel 频道模式下显示发送者名称
- `client-rest-messaging`: POST /api/messages 支持 channel 字段，Manager 端广播而非 1:1 relay；sync API 增加频道消息查询
- `unread-badge`: 频道未读计数（peerId = `"__team__"`），@提及 时额外未读提醒
- `message-persistence`: 本地历史支持频道消息存储（peerId = `"__team__"`）

## Impact

- **Envoy 框架** (`envoy/packages/`): Team 类增加 `broadcastChat()` 方法；Server relay 不变（复用现有单播）
- **Manager 后端** (`manager/server/`): DB migration（加列）、messages 路由增加频道逻辑、sync 查询扩展
- **Client 前端** (`src/`): types.ts 类型扩展、useMessages 频道路由、ChatPanel 频道模式 + @提及交互、MemberSidebar 频道入口
- **Tauri 后端** (`src-tauri/`): 无需改动（复用现有 peerId 持久化逻辑）
- **数据兼容性**: 新增列均为 nullable，旧数据不受影响；私聊消息 channel 为 NULL
