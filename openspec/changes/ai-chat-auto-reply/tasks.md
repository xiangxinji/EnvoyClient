## 1. 类型与数据模型

- [x] 1.1 `src/types.ts` — ChatMessage 接口新增 `source?: "human" | "ai-auto"` 字段
- [x] 1.2 `shared/types/ai.ts` — SceneType 新增 `"auto-reply"` 场景类型

## 2. 后端：消息 source 字段全链路

- [x] 2.1 SQLite messages 表新增 `source` 列（VARCHAR(10) DEFAULT 'human'）
- [x] 2.2 `manager/server/routes/messages.ts` — POST /api/messages 接受 `source` 字段，写入 DB 并透传到 relay payload
- [x] 2.3 `manager/server/routes/messages.ts` — GET /api/messages/sync 返回结果包含 `source` 字段
- [x] 2.4 `useMessages.ts` — `handleIncomingMessage()` 和 `syncMessageToTimeline()` 解析并保留 `source` 字段
- [x] 2.5 `useMessages.ts` — `sendChat()` 支持传入 `source` 参数，POST 时携带到后端

## 3. 后端：AI 自动回复专用端点

- [x] 3.1 `manager/server/services/ai/prompts/auto-reply.ts` — 新增自动回复系统提示词模板（以用户口吻代替回复，包含 username/role/team 上下文变量）
- [x] 3.2 `manager/server/settings.ts` — 场景列表注册 `auto-reply` scene（默认 temperature: 0.7, maxTokens: 2048）
- [x] 3.3 `manager/server/services/ai/chat.ts` — `buildChatMessages()` 支持基于 scene 选择不同 prompt（auto-reply scene 使用 auto-reply prompt）

## 4. 后端：Manager Web 设置页面

- [x] 4.1 `manager/web/src/views/Settings.vue` — 场景表格新增 `auto-reply` 行（中文描述："自动回复"）

## 5. 前端：设置开关

- [x] 5.1 `src/composables/useMemberSettings.ts` — MemberSettings 接口新增 `ai_auto_reply: boolean`（默认 false）
- [x] 5.2 `src/components/SettingsPanel.vue` — 新增 "AI 自动回复" 开关 UI（GlassCheckbox），切换后立即保存

## 6. 前端：自动回复核心逻辑

- [x] 6.1 新建 `src/composables/useAutoReply.ts` — 导出 `useAutoReply(composableOptions)` composable
- [x] 6.2 实现 per-peer 防抖定时器 Map（peerId → timer），5 秒防抖逻辑
- [x] 6.3 实现定时器到期回调：取最近 N 条历史 + 新消息，调用 `/api/ai/chat/generate`（非流式）
- [x] 6.4 实现 AI 回复成功后调用 `sendChat(peerId, text, { source: "ai-auto" })`
- [x] 6.5 实现 AI 调用失败静默处理（console.warn）
- [x] 6.6 提供 `dispose()` 方法，清除所有定时器（设置关闭时调用）

## 7. 前端：集成触发点

- [x] 7.1 `src/composables/useMessages.ts` — `handleIncomingMessage()` 中调用 autoReply trigger（检查 ai_auto_reply 设置 + 非自身消息）
- [x] 7.2 `src/composables/useTeamClient.ts` — 挂载 useAutoReply，将 sendChat / settings / ai 调用能力注入
- [x] 7.3 设置关闭时触发 `dispose()` 清除定时器

## 8. 前端：UI 渲染

- [x] 8.1 `src/components/MessageBubble.vue` — 消息 `source === "ai-auto"` 时显示 "AI 自动回复" 标记 badge（跟随毛玻璃设计系统，使用 CSS 变量）
