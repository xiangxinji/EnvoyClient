## Context

当前聊天消息通过 `ChatMessage` 类型表示，扩展字段（`attachments`、`forwarded`）统一存储在 SQLite `extra` JSON 列中。消息右键菜单已支持"撤回"（仅自己消息）和多选转发（空白区域右键触发 selectMode）。`sendChat` 函数通过 options 参数传递 attachments / forwarded / source。

## Goals / Non-Goals

**Goals:**
- 支持微信式引用回复：右键任意消息 → 输入区显示引用预览 → 发送带引用的消息
- 引用卡片在 MessageBubble 中渲染，点击可跳转到原消息
- 原消息撤回后引用卡片显示"原消息已撤回"

**Non-Goals:**
- 不支持跨对话引用（只在同一 peer 对话内）
- 不支持引用嵌套（引用一条带引用的消息时，只引用最外层文本）
- 不支持文本片段选中引用（整条消息为单位）
- 不修改 SQLite schema

## Decisions

### D1: 数据存储 — 复用 extra JSON

`QuoteInfo` 存入 `extra.quote`，与 `attachments`/`forwarded` 同模式。

```ts
interface QuoteInfo {
  id: string;        // 被引用消息 ID
  from: string;      // 被引用消息发送者
  text: string;      // 快照文本（截断至 100 字符）
  timestamp: number; // 被引用消息时间戳
}
```

**理由**: 无 schema 变更，无 migration，与现有模式一致。
**替代方案**: 新增 `quote_id` 列做外键关联 → 需要 migration 且历史数据不兼容，过度设计。

### D2: 快照文本截断策略

存储时截断至 100 字符。图片消息存 `[图片]`，文件消息存 `[文件] filename.ext`，纯转发消息存 `[聊天记录]`。

**理由**: 引用卡片空间有限，100 字符足以提供上下文。截断在发送端执行，确保存储内容稳定。

### D3: 触发方式 — 扩展现有右键菜单

在 `ChatPanel.vue` 的 `handleMessageContextmenu` 中取消 `if (!message.mine) return` 限制，对所有消息显示菜单。"引用回复"始终可见，"撤回"仅自己消息可见。

**理由**: 复用已有菜单基础设施，减少新代码。右键是桌面端最自然的操作方式。
**替代方案**: 双击消息触发引用 → 与双击选中文字冲突。悬浮按钮 → 需要额外 hover 逻辑且移动端不适用。

### D4: 引用预览条 — 输入区顶部固定条

引用预览条位于 toolbar 与 RichEditor 之间，显示 `{发送者}: {截断文本}` + 关闭按钮。状态由 `quotingMsg: Ref<ChatMessage | null>` 管理。

**理由**: 与文件附件预览条（`pendingFiles`）同层级，视觉一致。放在 RichEditor 上方让用户在输入时始终可见。

### D5: 撤回检测 — 渲染时查 timeline

MessageBubble 渲染引用卡片时，通过 props 传入当前会话的 timeline 数组，查找 `quote.id` 对应的条目。若找到 `RevokedNotice`，显示"原消息已撤回"。

**理由**: 客户端已有完整 timeline 数据，无需额外 API 调用。快照文本作为 fallback（消息太旧未加载时）。
**替代方案**: 每次 render 向服务端查询消息状态 → 不必要的网络开销。

### D6: 跳转定位 — scrollIntoView

点击引用卡片时，通过 `document.getElementById(msgId)` 找到目标消息 DOM 节点，调用 `scrollIntoView({ behavior: 'smooth', block: 'center' })` 并短暂高亮。

**理由**: 浏览器原生 API，简单可靠。消息 DOM 已通过 `:data-id="message.id"` 标记（需新增此属性）。
**替代方案**: 虚拟滚动索引定位 → 当前使用虚拟分页（displayCount），直接 DOM 操作更简单。

### D7: 服务端改动 — 最小化

`POST /api/messages` 从 body 取 `quote` 字段（若存在），加入 `extra` 对象。relay payload 中也包含 `quote`。无其他服务端变更。

**理由**: 与 `forwarded` 处理逻辑完全对称，一行代码的改动量。

## Risks / Trade-offs

- **[引用消息在虚拟分页外]** → 当前仅加载最近 50 条。若被引用消息在更早的历史中，跳转时需先加载更多消息。Mitigation: 跳转前检测目标是否在 DOM 中，不在则先调用 `loadMore`。
- **[引用快照 vs 实时内容不一致]** → 引用存储的是快照文本，原消息编辑后快照不变。Mitigation: 当前不支持消息编辑，无此风险。
- **[MessageBubble 接收 timeline 的 props 传递]** → 需要将整个 timeline 数组传入 MessageBubble，增加组件耦合。Mitigation: 只传入当前 peer 的 timeline，且仅用于撤回检测，scope 可控。
