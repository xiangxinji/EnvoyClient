## 1. Envoy 框架 — Team 广播方法

- [x] 1.1 在 `envoy/packages/teams/team.ts` 中增加 `broadcastChat(fromId: string, subtype: string, payload: unknown)` 方法，遍历 `this.roles` 排除发送者，调用 `this.server.relay(fromId, clientId, subtype, payload)`
- [x] 1.2 在 `envoy/packages/teams/team.ts` 中增加 `getOnlineMemberIds(): string[]` 方法，返回所有在线成员 clientId 列表
- [x] 1.3 构建 envoy 框架：`cd envoy && npm run build`

## 2. Manager 后端 — DB Migration

- [x] 2.1 在 `manager/server/db.ts` 的 `initTeamDatabase()` 中增加 `channel` 列迁移：检测 `PRAGMA table_info(messages)` 中是否存在 `channel` 列，不存在则 `ALTER TABLE messages ADD COLUMN channel TEXT`
- [x] 2.2 在 `manager/server/db.ts` 的 `initTeamDatabase()` 中增加 `mentions` 列迁移：同上模式，`ALTER TABLE messages ADD COLUMN mentions TEXT`
- [x] 2.3 更新 `InsertMessageInput` 接口增加 `channel?: string` 和 `mentions?: string` 字段
- [x] 2.4 更新 `StoredMessage` 接口增加 `channel: string | null` 和 `mentions: string | null` 字段
- [x] 2.5 更新 `insertMessage()` 函数：INSERT 语句增加 `channel` 和 `mentions` 列
- [x] 2.6 更新 `queryMessages()` 函数：查询条件从 `WHERE (from_user=? OR to_user=?) AND seq > ?` 改为同时包含频道消息 `WHERE ((from_user=? OR to_user=?) OR channel = 'general') AND seq > ?`
- [x] 2.7 更新 `queryConversations()` 函数：增加 `AND channel IS NULL` 过滤条件，排除频道消息污染会话列表

## 3. Manager 后端 — 消息路由

- [x] 3.1 修改 `POST /api/messages` 路由：body 解析增加 `channel?` 和 `mentions?` 字段
- [x] 3.2 修改 `POST /api/messages` 验证逻辑：有 `channel` 时 `to` 非必填（自动设为 `"__team__"`），无 `channel` 时 `to` 必填
- [x] 3.3 修改 `POST /api/messages` 广播逻辑：有 `channel` 时调用 `team.broadcastChat()` 替代 `team.innerServer.relay()`，payload 增加 `channel` 字段
- [x] 3.4 修改 `POST /api/messages` mentions 处理：展开 `mentions` 中的 `"all"` 为所有成员 ID，存入 DB
- [x] 3.5 修改 `DELETE /api/messages/:id` 路由：查询消息后检测 `channel` 字段，频道消息调用 `team.broadcastChat()` 广播 `chat-revoke`
- [x] 3.6 增加 @提及 notify 逻辑：频道消息发送后，对被提及成员额外发送 `notify` 消息（subtype: `channel-mention`）触发桌面通知

## 4. Client 前端 — 类型扩展

- [x] 4.1 在 `src/types.ts` 的 `ChatMessage` 接口中增加 `channel?: string` 和 `mentions?: string[]` 可选字段
- [x] 4.2 在 `src/composables/useMessages.ts` 的 `SyncMessage` 接口中增加 `channel: string | null` 和 `mentions: string | null` 字段

## 5. Client 前端 — 消息路由

- [x] 5.1 修改 `useMessages.ts` 的 `syncMessageToTimeline()`：检测 `msg.channel` 字段，有值时设置到 ChatMessage 上
- [x] 5.2 修改 `useMessages.ts` 的 `loadHistory()`：频道消息路由到 peerId `"__team__"` 而非 `msg.from_user`
- [x] 5.3 修改 `useMessages.ts` 的 `handleIncomingMessage()` chat 分支：检测 payload 中的 `channel` 字段，频道消息路由到 peerId `"__team__"`
- [x] 5.4 修改 `useMessages.ts` 的 `sendChat()`：支持频道消息发送，body 增加 `channel: "general"` 和 `mentions` 字段，频道消息 peerId 为 `"__team__"`

## 6. Client 前端 — 频道 UI

- [x] 6.1 修改 `MemberSidebar.vue`：在成员列表上方增加固定的 #general 频道入口（图标 + "General" 标签），点击 emit `select` peerId 为 `"__team__"`
- [x] 6.2 修改 `MemberSidebar.vue`：频道入口显示未读角标，数据来自 `unreadCounts.get("__team__")`
- [x] 6.3 修改 `ChatPanel.vue`：检测 `peerId === "__team__"` 时显示频道头部（"# General" + 成员数量）
- [x] 6.4 修改 `ChatPanel.vue`：频道模式下每条消息气泡上方显示发送者名称
- [x] 6.5 修改 `ChatPanel.vue`：频道模式下输入框支持发送频道消息（调用 `sendChat("__team__", text, { channel: "general", mentions })` 替代 `sendChat(peerId, text)`）

## 7. Client 前端 — @提及交互

- [x] 7.1 创建 `src/components/MentionPopup.vue`：输入 `@` 时弹出的成员选择列表组件，显示团队成员 + @all 选项
- [x] 7.2 修改 `ChatPanel.vue` 输入逻辑：监听输入内容，检测 `@` 字符触发 MentionPopup 弹窗
- [x] 7.3 实现 @提及选择后插入逻辑：选中成员后在输入框插入 `@username `，记录 mentions 数组
- [x] 7.4 修改 `MessageBubble.vue`：频道消息中解析并高亮 `@username` 和 `@all` 文本（正则匹配实际成员名）

## 8. Client 前端 — @提及通知

- [x] 8.1 修改 `useTeamClient.ts`：监听 `notify` 事件中 subtype 为 `channel-mention` 的消息，触发桌面通知
- [x] 8.2 修改 `useTeamClient.ts`：AI 自动回复触发逻辑排除 peerId `"__team__"` 的消息

## 9. 集成验证

- [ ] 9.1 启动 Manager 后端，验证 DB migration 正确执行（channel/mentions 列存在）
- [ ] 9.2 启动两个客户端连接同一团队，验证频道消息广播正常
- [ ] 9.3 验证频道消息 @提及弹窗交互和高亮渲染
- [ ] 9.4 验证频道消息撤回广播
- [ ] 9.5 验证频道消息不触发 AI 自动回复
- [ ] 9.6 验证离线成员上线后 sync 拉取频道消息
- [ ] 9.7 验证私聊消息不受影响（回归测试）
