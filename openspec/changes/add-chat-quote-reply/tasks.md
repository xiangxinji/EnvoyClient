## 1. 类型定义与数据层

- [x] 1.1 在 `src/types.ts` 中新增 `QuoteInfo` 接口（id, from, text, timestamp），并在 `ChatMessage` 中添加可选字段 `quote?: QuoteInfo`
- [x] 1.2 在 `src/composables/useMessages.ts` 的 `sendChat` 函数中，扩展 options 支持 `quote?: QuoteInfo` 参数，发送时将其包含在 POST 请求体中
- [x] 1.3 在 `src/composables/useMessages.ts` 的 `syncMessageToTimeline` 函数中，从 extra JSON 提取 `quote` 字段并赋值到 ChatMessage
- [x] 1.4 在 `src/composables/useMessages.ts` 的 `handleIncomingMessage` 函数中，从 WebSocket payload 提取 `quote` 字段并赋值到 ChatMessage

## 2. 服务端改动

- [x] 2.1 在 `manager/server/routes/messages.ts` 的 `POST /api/messages` 中，从请求体提取 `quote` 字段（若存在），加入 `extra` 对象一并存入 SQLite

## 3. 右键菜单与引用触发

- [x] 3.1 修改 `src/components/ChatPanel.vue` 的 `handleMessageContextmenu` 函数：取消 `if (!message.mine) return` 限制，改为对所有消息显示菜单，"引用回复"始终可见，"撤回"仅 mine 时可见
- [x] 3.2 在上下文菜单模板中添加"引用回复"菜单项（含图标），点击时设置 `quotingMsg` 状态并聚焦 RichEditor
- [x] 3.3 新增 `quotingMsg: Ref<ChatMessage | null>` 状态管理，点击引用时填充，发送后清空，关闭按钮清空

## 4. 引用预览条

- [x] 4.1 在 `src/components/ChatPanel.vue` 输入区（toolbar 与 RichEditor 之间）添加引用预览条模板：显示 `{发送者}: {截断文本}` + 关闭按钮（✕）
- [x] 4.2 添加引用预览条样式：毛玻璃设计系统标准 glass 层级，紧凑行高，文本溢出省略号

## 5. 发送集成

- [x] 5.1 在 `src/components/ChatPanel.vue` 的 `handleRichSend` 中，若 `quotingMsg` 非空，生成 QuoteInfo（含快照文本截断逻辑）并通过 `sendChat` 的 options 传递
- [x] 5.2 实现快照文本生成函数：纯文本截断 100 字符、图片消息 `[图片]`、文件消息 `[文件] filename`、转发消息 `[聊天记录]`

## 6. 引用卡片渲染

- [x] 6.1 在 `src/components/MessageBubble.vue` 中添加 `timeline` prop（`TimelineItem[]`）和 `emit` scroll-to-quote 事件
- [x] 6.2 在 MessageBubble 根元素添加 `data-id` 属性（值为 message.id），用于跳转定位
- [x] 6.3 在 MessageBubble 中渲染引用卡片：左侧竖线 + 发送者 ID + 快照文本，单行溢出省略号，遵循毛玻璃设计系统
- [x] 6.4 实现撤回检测：在 timeline 中查找 quote.id，若为 RevokedNotice 则显示"原消息已撤回"（灰色文字），不在 timeline 中则 fallback 显示快照文本
- [x] 6.5 引用卡片点击时 emit `scroll-to-quote` 事件，携带 quote.id

## 7. 跳转定位

- [x] 7.1 在 `src/components/ChatPanel.vue` 中监听 MessageBubble 的 `scroll-to-quote` 事件，通过 `data-id` 属性查找目标 DOM 节点，调用 `scrollIntoView({ behavior: 'smooth', block: 'center' })`
- [x] 7.2 添加短暂高亮效果：跳转到位后给目标消息添加高亮 class，定时移除

## 8. 国际化

- [x] 8.1 在 i18n locale 文件中添加引用相关的翻译 key：`chat.quote`（引用回复）、`chat.quoteRevoked`（原消息已撤回）、`chat.quotePlaceholder.image`（[图片]）、`chat.quotePlaceholder.file`（[文件]）、`chat.quotePlaceholder.forwarded`（[聊天记录]）
