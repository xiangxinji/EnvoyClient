## ADDED Requirements

### Requirement: AI 自动回复设置开关

系统 SHALL 在 SettingsPanel 中提供"AI 自动回复"开关控件。开关状态 SHALL 保存到 `settings.yml` 的 `users.{username}.ai_auto_reply` 字段（布尔值，默认 `false`）。

#### Scenario: 开启自动回复
- **WHEN** 用户将 AI 自动回复开关切换为开启
- **THEN** `settings.yml` 中 `users.{username}.ai_auto_reply` 保存为 `true`，后续收到的聊天消息将触发 AI 自动回复

#### Scenario: 关闭自动回复
- **WHEN** 用户将 AI 自动回复开关切换为关闭
- **THEN** `settings.yml` 中 `users.{username}.ai_auto_reply` 保存为 `false`，后续收到的聊天消息不再触发 AI 自动回复

#### Scenario: 首次打开设置页面
- **WHEN** 用户首次打开设置页面，`settings.yml` 中无 `ai_auto_reply` 字段
- **THEN** 开关显示为关闭（默认值 `false`）

### Requirement: 收到消息触发自动回复

系统 SHALL 在 `handleIncomingMessage()` 中检查 `ai_auto_reply` 设置。当设置开启且收到非自身发送的聊天消息时，SHALL 启动 per-peer 防抖定时器。

#### Scenario: 收到消息且自动回复已开启
- **WHEN** 用户收到来自 peer "Alice" 的聊天消息，且 `ai_auto_reply` 为 `true`
- **THEN** 系统启动（或重置）针对 peer "Alice" 的 5 秒防抖定时器

#### Scenario: 收到消息但自动回复未开启
- **WHEN** 用户收到聊天消息，且 `ai_auto_reply` 为 `false`
- **THEN** 消息正常显示，不触发自动回复流程

### Requirement: Per-peer 防抖合并

系统 SHALL 为每个 peer 维护独立的 5 秒防抖定时器。定时器到期后，SHALL 取最近 N 条对话历史（N 由 `ai_suggestion_history_count` 设置决定），调用 AI 生成回复。

#### Scenario: 单条消息触发回复
- **WHEN** 用户收到来自 "Alice" 的一条消息，5 秒内无后续消息
- **THEN** 系统取最近 N 条历史 + 该消息，调用 `/api/ai/chat/generate` 生成回复

#### Scenario: 多条消息防抖合并
- **WHEN** 用户在 3 秒内连续收到来自 "Alice" 的 3 条消息
- **THEN** 系统仅在第 3 条消息后等待 5 秒（无新消息时），取最近 N 条历史 + 全部 3 条新消息，生成一条 AI 回复

#### Scenario: 多 peer 并发消息
- **WHEN** 用户同时收到来自 "Alice" 和 "Bob" 的消息
- **THEN** 系统为 Alice 和 Bob 分别维护独立的防抖定时器，各自到期后独立生成回复

### Requirement: 自动回复消息发送

AI 生成回复后，系统 SHALL 调用 `sendChat(peerId, text, { source: "ai-auto" })` 发送消息。消息 SHALL 同时显示在用户自己的聊天面板和对方的聊天面板中。

#### Scenario: AI 回复成功发送
- **WHEN** AI 生成回复文本为 "收到，我看一下"
- **THEN** 系统以 `source: "ai-auto"` 发送该消息，消息同时出现在用户的聊天面板和对方的聊天面板

#### Scenario: AI 调用失败
- **WHEN** AI 生成请求返回错误或超时
- **THEN** 系统 SHALL 静默失败（console.warn），不发送消息，不弹出通知

### Requirement: AI 自动回复专用系统提示词

系统 SHALL 使用独立的 `auto-reply` 提示词模板，指示 AI 以用户口吻自然回复，不暴露 AI 身份。

#### Scenario: 提示词构建
- **WHEN** 系统调用自动回复 AI 接口
- **THEN** 系统提示词 SHALL 包含用户的用户名、角色、团队名等上下文，指示 AI 以该用户口吻回复

### Requirement: AI 生成消息标记

MessageBubble 组件 SHALL 根据 `source === "ai-auto"` 在消息气泡上显示 AI 自动生成标记 badge。

#### Scenario: 接收方看到 AI 标记
- **WHEN** 用户收到一条 `source: "ai-auto"` 的消息
- **THEN** 消息气泡上方或下方 SHALL 显示 "AI 自动回复" 标记 badge

#### Scenario: 发送方看到 AI 标记
- **WHEN** 用户自己通过 AI 自动回复发出的消息显示在聊天面板中
- **THEN** 该消息气泡 SHALL 同样显示 "AI 自动回复" 标记 badge

#### Scenario: 普通消息无标记
- **WHEN** 消息的 `source` 为 `"human"` 或未设置
- **THEN** 消息气泡 SHALL 不显示 AI 标记
