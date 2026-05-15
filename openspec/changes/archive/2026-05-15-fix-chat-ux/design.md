## Context

EnvoyClient 聊天面板当前存在两个交互缺陷：(1) MessageBubble 使用 `{{ message.text }}` 纯文本插值，Markdown 内容以原始文本显示；(2) MemberSidebar 的 badge UI 已就绪但未读计数逻辑完全断裂——`syncUnread` 在收消息时从不被调用，选中成员时也没有清零机制。

当前代码状态：
- `MessageBubble.vue:16` — `{{ message.text }}` 纯文本
- `useTeamClient.ts:42-46` — `syncUnread(peerId, isCurrentPeer)` 只有增量分支，缺少清零分支
- `useTeamClient.ts:81-94` — `on("message")` 回调中未调用 `syncUnread`
- `MemberSidebar.vue:46-48` — badge 组件已就绪，依赖 `unreadCounts` Map

## Goals / Non-Goals

**Goals:**
- 聊天气泡安全渲染 Markdown（代码块、加粗、链接、列表、行内代码等）
- 未读消息在侧边栏显示微信风格红点 + 数字（>99 显示 "99+"）
- 所有新增样式适配 dark/light 双主题

**Non-Goals:**
- 不做 Markdown 编辑器（输入框仍是纯文本）
- 不做消息引用/回复/转发
- 不做桌面系统级通知（系统托盘通知）
- 不改 Rust 后端、Manager 后端、envoy 子模块

## Decisions

### 1. Markdown 渲染库选择：marked + DOMPurify

**选择**: `marked`（解析） + `dompurify`（XSS 防护）

**备选**:
- `markdown-it`: 更灵活但体积更大，插件体系对当前需求过重
- `vue-markdown-render`: Vue wrapper，但底层也是 marked，多一层无意义

**理由**: `marked` 轻量、API 简洁、社区成熟。聊天场景不需要 AST 级别操作，`marked.parse()` 足够。`DOMPurify` 是 XSS 防护标准方案，两者配合是前端 Markdown 渲染的最佳实践。

### 2. Markdown 渲染位置：MessageBubble 组件内 computed

**选择**: 在 MessageBubble.vue 内用 `computed` 将 `message.text` 解析为 HTML，通过 `v-html` 渲染。

**理由**: 渲染逻辑与气泡组件内聚，无需侵入 useTeamClient 或数据层。computed 缓存避免重复解析。

### 3. 未读计数 API 重构：拆分为 incrementUnread / markRead

**选择**: 废弃 `syncUnread`，拆分为两个独立方法：
- `incrementUnread(peerId)`: 计数 +1
- `markRead(peerId)`: 清零

**理由**: 原始 `syncUnread(peerId, isCurrentPeer)` 签名含混——"同步"语义不清晰，`isCurrentPeer` 控制两种截然不同的行为（增加 vs 不做）。拆分后语义明确，调用方不会误用。

### 4. 当前 peer 追踪：通过参数传递而非 composable 内部状态

**选择**: `incrementUnread` 在调用时由外部判断是否是当前 peer，composable 内部不追踪 selectedPeer。

**理由**: selectedPeer 是 UI 状态（ChatView 持有），不是通信层状态。composable 保持无状态，避免与 Vue Router / 组件层级耦合。

## Risks / Trade-offs

- **[XSS 风险]** → 使用 `DOMPurify.sanitize()` 对 `marked` 输出做二次清洗，禁止 `<script>`、`on*` 事件属性等
- **[Markdown 样式泄露]** → 所有 Markdown 样式用 `.bubble .content` 前缀 scoped，避免影响其他组件
- **[性能]** → `marked.parse()` 在 computed 中执行，仅在 message.text 变化时触发，聊天消息量级无性能问题
- **[未读计数持久化]** → 当前不持久化未读计数到磁盘，刷新后清零。这是合理的（桌面应用重启后上下文已变化）
