## Why

当前聊天中用户回复某条特定消息时，无法直观表达"这条回复是针对哪条消息的"。在快速对话中，消息上下文容易丢失，导致沟通效率下降。微信式引用回复是即时通讯中最自然的上下文关联方式。

## What Changes

- 新增 `QuoteInfo` 类型，`ChatMessage` 新增可选 `quote` 字段，通过 SQLite `extra` JSON 存储（与 `attachments`/`forwarded` 同模式）
- 消息右键菜单新增"引用回复"选项（对所有消息可用，不限是否为自己发送的）
- ChatPanel 输入区新增引用预览条（显示被引用消息的发送者 + 截断文本 + 取消按钮）
- MessageBubble 渲染引用卡片（左侧竖线 + 发送者 + 截断文本），点击跳转 scroll 到原消息
- 引用卡片支持撤回检测：若原消息已被撤回，显示"原消息已撤回"替代快照文本
- 图片/附件消息被引用时，快照文本存储占位符（`[图片]` / `[文件] xxx.pdf`）
- 服务端 `POST /api/messages` 从请求体提取 `quote` 存入 `extra` JSON

## Capabilities

### New Capabilities
- `chat-quote-reply`: 聊天消息引用回复功能，包括数据模型（QuoteInfo + extra 存储）、右键菜单触发、输入区引用预览、MessageBubble 引用卡片渲染（含撤回检测和跳转定位）

### Modified Capabilities
（无需修改现有 spec——引用是纯新增字段，不影响现有 attachments/forwarded/revoke 等行为的已有需求）

## Impact

- **前端类型**: `src/types.ts` — 新增 `QuoteInfo` 接口，`ChatMessage` 加 `quote?` 字段
- **前端消息层**: `src/composables/useMessages.ts` — `sendChat` 接受 `quote` 参数，`syncMessageToTimeline` 和 `handleIncomingMessage` 提取 `quote`
- **前端 UI**: `src/components/ChatPanel.vue` — 右键菜单扩展 + 引用预览条 + 发送逻辑
- **前端 UI**: `src/components/MessageBubble.vue` — 引用卡片渲染 + 撤回检测 + scroll 跳转
- **服务端**: `manager/server/routes/messages.ts` — `POST /api/messages` 提取并存储 `quote` 到 extra
- **数据库**: 无 schema 变更（复用 `extra` JSON 字段）
- **i18n**: 新增引用相关的翻译 key
