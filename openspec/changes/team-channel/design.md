## Context

当前消息系统是严格的 1:1 单播模型：`ChatMessage` 有 `from` 和 `to`（单字符串），SQLite `messages` 表有 `from_user`/`to_user` 列，Envoy `Server.relay()` 只转发给单个客户端。整个链路中没有频道、广播或组播概念。

团队成员之间的群组交流只能通过任务系统间接实现，缺乏自由的实时讨论空间。需要一个固定 #general 频道，所有团队成员自动加入，消息通过 Manager 广播。

关键约束：
- Envoy 框架的 `Message` 接口 `to` 字段是单字符串，不适合直接改
- SQLite schema 用 `PRAGMA table_info` 做增量迁移（见 `db.ts:149`）
- 客户端用 `Map<peerId, TimelineItem[]>` 管理会话，peerId 是普通字符串
- `useAutoReply` 的防抖逻辑通过 `useTeamClient` 触发，需要排除频道消息

## Goals / Non-Goals

**Goals:**
- 固定 #general 频道，所有团队成员自动加入，无需创建/管理
- 频道消息通过 Manager 端广播：写 1 条 DB 记录，fan-out 给所有在线成员
- 支持 @提及（选择成员 + @all 全体提及），被提及者收到额外桌面通知
- 频道消息始终显示发送者名称（区分私聊模式）
- 频道消息不触发 AI 自动回复
- 频道消息只能撤回自己的

**Non-Goals:**
- 不做多频道/自定义频道（Level 3）
- 不做频道权限控制（所有成员都能发消息）
- 不做频道消息的 AI 建议（useAI.suggestReply 不作用于频道）
- 不做消息已读回执
- 不修改 Envoy 框架的 `Message` 接口本身

## Decisions

### D1: 频道身份用固定 peerId `"__team__"` 而非修改消息寻址模型

**选择**: 客户端用 `"__team__"` 作为频道的 peerId，频道消息路由到这个虚拟会话。

**理由**: 避免修改 Envoy 框架的 `Message` 接口（`to` 仍为单字符串）。复用现有的 `Map<peerId, TimelineItem[]>` 数据结构，前端改动最小。Manager 广播时仍然逐个调用 `relay()`，每条 WS 消息的 `to` 是真实 clientId。

**替代方案**: 修改 Envoy `Message` 增加 `channel` 字段 → 改动面过大，且 Envoy 框架可能被其他项目使用。

### D2: DB Schema 用 `channel` 列区分，`to_user` 保持 NOT NULL

**选择**: `messages` 表增加 `channel TEXT NULL` 和 `mentions TEXT` 列。频道消息 `to_user` 存为 `"__team__"`（保持 NOT NULL 约束），`channel` 存为 `"general"`。私聊消息 `channel` 为 NULL。

**理由**: 不需要改 `to_user` 列约束。`channel` 列提供语义清晰的区分：
- 私聊查询: `WHERE (from_user=? OR to_user=?) AND channel IS NULL`
- 频道查询: `WHERE channel = 'general'`

DB migration 沿用现有 `PRAGMA table_info` 模式（见 `db.ts:149-152`）。

### D3: 广播在 Team 层实现，复用现有 `relay()`

**选择**: 在 `Team` 类增加 `broadcastChat(fromId, subtype, payload)` 方法。该方法遍历 `this.roles`，对每个在线成员调用 `this.server.relay(fromId, clientId, subtype, payload)`。排除发送者自己。

**理由**: 不需要修改 `Server.relay()` 的 1:1 逻辑。`Team` 已有 `broadcastMembers()` 做同样模式的遍历，新增方法一致。Manager `POST /api/messages` 检测 `channel` 字段后调用 `team.broadcastChat()` 替代 `team.innerServer.relay()`。

### D4: @提及 解析在 Manager 端，前端负责交互

**选择**:
- 前端：输入 `@` 弹出成员列表，选中后插入 `@username` 文本。发送时在 body 中附带 `mentions: string[]` 数组。
- Manager：接收 `mentions` 数组，存入 DB `mentions` 列（JSON）。对被提及成员额外发送 `notify` 消息（subtype: `channel-mention`），触发桌面通知。
- 渲染：`ChatPanel` 解析 `@username` 文本并用高亮样式渲染。`@all` 是特殊的 mention 值，Manager 端展开为所有成员。

**理由**: Manager 端存储 mentions 便于未来扩展（如搜索提及自己的消息）。前端交互复用现有成员列表数据。

### D5: 频道消息路由 — `handleIncomingMessage` 增加 channel 分支

**选择**: `useMessages.handleIncomingMessage()` 检测消息 payload 中的 `channel` 字段：
- 若 `channel` 存在 → peerId = `"__team__"`，消息路由到频道会话
- 若不存在 → 保持原有逻辑（`msg.from === myId ? msg.to : msg.from`）

`loadHistory()` 的 `syncMessageToTimeline()` 同理：检测 `SyncMessage` 的 `channel` 字段。

### D6: 频道消息不触发 AI 自动回复

**选择**: `useTeamClient` 中触发 `useAutoReply` 的逻辑检查 `msg.subtype === "chat"` 之后，额外检查 peerId 不为 `"__team__"`。

### D7: 撤回广播 — Manager 遍历在线成员

**选择**: 频道消息撤回时，Manager 调用 `team.broadcastChat(fromId, "chat-revoke", { msgId })` 替代 `team.innerServer.relay()`，确保所有在线成员收到撤回通知。

## Risks / Trade-offs

**[广播性能]** 每条频道消息需要 N 次 `relay()` 调用 → 成员数通常 <20，WS 发送是异步的，性能可接受。若未来成员数增长，可考虑批量发送。

**[离线消息]** 成员离线时收不到实时广播 → 上线后通过 `sync` API 拉取频道消息（`WHERE channel = 'general'`），不会丢失。

**[to_user = "__team__" 的隐含约束]** 频道消息在 DB 中 `to_user` 为虚拟值，未来查询会话列表（`queryConversations`）需要排除 `to_user = "__team__"` 或特殊处理 → 在 `queryConversations` 中增加 `AND channel IS NULL` 过滤。

**[@提及的文本解析]** 用正则匹配 `@(\w+)` 可能有误匹配（如邮箱地址）→ 只高亮匹配到实际成员名的提及，其他忽略。

## Migration Plan

1. **DB Migration** — 在 `initTeamDatabase()` 中增加 `channel` 和 `mentions` 列检测（与现有 `source` 列迁移一致）
2. **无破坏性变更** — 新列均为 nullable，旧数据 `channel = NULL`、`mentions = NULL`
3. **前后端可独立部署** — 后端先部署，前端再部署。旧客户端不发送 `channel` 字段，后端兼容处理
4. **回滚** — 删除前端频道入口即可，后端频道逻辑对私聊消息无影响
