## 1. 类型与数据层

- [x] 1.1 在 `src/types.ts` 中新增 `RevokedNotice` 接口，扩展 `TimelineItem` 联合类型
- [x] 1.2 在 `manager/server/db.ts` 中新增 `deleteMessage(teamName, msgId)` 函数，返回 boolean

## 2. 后端 API

- [x] 2.1 在 `manager/server/routes/messages.ts` 中新增 `DELETE /api/messages/:id` 路由，验证发送者权限后调用 deleteMessage + relay 通知

## 3. 消息处理

- [x] 3.1 在 `src/composables/useMessages.ts` 的 `handleIncomingMessage` 中处理 `chat-revoke` subtype，将匹配消息替换为 RevokedNotice
- [x] 3.2 在 `src/composables/useMessages.ts` 中新增 `revokeMessage(peerId, msgId)` 方法（调用 DELETE API + 本地删除）
- [x] 3.3 在 `src/composables/useTeamClient.ts` 中将 `revokeMessage` 从 useMessages 透传到公共接口

## 4. UI — MessageBubble

- [x] 4.1 MessageBubble emit `contextmenu` 事件，携带 message 和鼠标坐标

## 5. UI — ChatPanel 右键菜单

- [x] 5.1 ChatPanel 接收 contextmenu 事件，仅对 `mine && type === "chat"` 的消息显示右键菜单
- [x] 5.2 右键菜单 Teleport 到 body，定位在鼠标坐标，包含"撤回"选项
- [x] 5.3 点击"撤回"调用 revokeMessage，成功后 Toast 提示，失败显示错误
- [x] 5.4 点击其他区域关闭菜单

## 6. UI — 撤回占位渲染

- [x] 6.1 在 ChatPanel 的消息列表中处理 `type === "revoked"` 的 TimelineItem，渲染灰色居中的"XX 撤回了一条消息"占位
