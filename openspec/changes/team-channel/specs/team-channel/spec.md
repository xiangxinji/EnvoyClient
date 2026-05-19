## ADDED Requirements

### Requirement: 固定团队频道
系统 SHALL 提供一个固定的 #general 团队频道，所有团队成员自动加入，无需手动创建或管理。频道通过 peerId `"__team__"` 标识。

#### Scenario: 用户连接后自动拥有频道
- **WHEN** 用户连接到团队
- **THEN** 侧边栏顶部显示 #general 频道入口，无需额外操作

#### Scenario: 频道 peerId 为 __team__
- **WHEN** 系统路由频道消息到本地会话
- **THEN** 消息存入 `Map<peerId, TimelineItem[]>` 中 key 为 `"__team__"` 的会话

### Requirement: 频道消息发送
用户 SHALL 能够在 #general 频道中发送文本消息。消息通过 Manager 端广播给所有在线团队成员（排除发送者自己）。

#### Scenario: 发送频道消息
- **WHEN** 用户在 #general 频道输入文本并发送
- **THEN** 消息 POST 到 Manager（body 包含 `channel: "general"`），Manager 写入 1 条 DB 记录并广播给所有在线团队成员

#### Scenario: 发送者自己也看到消息
- **WHEN** 用户发送频道消息成功
- **THEN** 消息立即添加到本地 `"__team__"` 会话中（乐观更新），无需等待广播回传

### Requirement: 频道消息接收
系统 SHALL 在收到频道消息时，将其路由到 `"__team__"` 会话中，而非发送者的私聊会话。

#### Scenario: 收到其他成员的频道消息
- **WHEN** 用户收到来自 Alice 的频道消息（payload 包含 `channel: "general"`）
- **THEN** 消息路由到 peerId = `"__team__"` 的会话中，而非 Alice 的私聊会话

#### Scenario: 频道消息包含发送者信息
- **WHEN** 用户在 #general 频道中查看消息
- **THEN** 每条消息保留 `from` 字段为实际发送者，与私聊消息格式一致

### Requirement: 频道消息始终显示发送者名称
ChatPanel 在频道模式（peerId = `"__team__"`）下 SHALL 在每条消息气泡上方显示发送者名称。

#### Scenario: 频道消息显示发送者
- **WHEN** 用户查看 #general 频道，Alice 发送了一条消息
- **THEN** 消息气泡上方显示 "Alice" 作为发送者名称

#### Scenario: 自己的消息也显示名称
- **WHEN** 用户查看 #general 频道，自己发送了一条消息
- **THEN** 自己的消息气泡上方也显示自己的用户名

#### Scenario: 私聊不显示发送者名称
- **WHEN** 用户查看与 Alice 的私聊
- **THEN** 消息气泡不显示发送者名称（保持现有行为）

### Requirement: @提及交互
用户 SHALL 能在频道输入框中输入 `@` 触发成员选择弹窗，选择成员后插入 `@username` 文本。

#### Scenario: 输入 @ 弹出成员列表
- **WHEN** 用户在频道输入框中输入 `@`
- **THEN** 弹出成员选择列表，显示所有团队成员 + `@all` 选项

#### Scenario: 选择成员插入文本
- **WHEN** 用户从弹窗中选择 Bob
- **THEN** 输入框中插入 `@Bob ` 文本

#### Scenario: 选择 @all 插入文本
- **WHEN** 用户从弹窗中选择 @all
- **THEN** 输入框中插入 `@all ` 文本

#### Scenario: 发送消息携带 mentions 数组
- **WHEN** 用户发送包含 @Bob 和 @all 的频道消息
- **THEN** 请求 body 中 `mentions` 字段为 `["bob", "all"]`

### Requirement: @提及高亮渲染
ChatPanel SHALL 在频道消息中高亮渲染 @提及 文本。只高亮匹配到实际成员名或 `@all` 的提及。

#### Scenario: 匹配成员名的提及高亮
- **WHEN** 频道消息文本为 "大家好 @Bob 看看这个"
- **THEN** `@Bob` 用高亮样式渲染（如加粗 + 主色）

#### Scenario: 不匹配的 @ 不高亮
- **WHEN** 频道消息文本为 "我的邮箱是 test@example.com"
- **THEN** `example` 不被高亮

### Requirement: @提及桌面通知
被 @提及 的成员 SHALL 收到额外的桌面通知，通知内容包含提及者和消息摘要。

#### Scenario: 被 @提及 收到桌面通知
- **WHEN** Alice 在频道中发送 "@Bob 看看这个方案"
- **THEN** Bob 收到桌面通知，内容类似 "Alice 在 #general 中提及了你"

#### Scenario: @all 全体收到通知
- **WHEN** Alice 在频道中发送 "@all 紧急通知"
- **THEN** 所有团队成员（排除 Alice）收到桌面通知，内容类似 "Alice 在 #general 中提及了所有人"

#### Scenario: 未被提及不收到额外通知
- **WHEN** Alice 在频道中发送 "大家好 @Bob 看看"（Carol 未被提及）
- **THEN** Carol 只收到频道消息的未读计数，不收到额外的桌面通知

### Requirement: 频道消息不触发 AI 自动回复
频道消息 SHALL 不触发 `useAutoReply` 的自动回复逻辑。

#### Scenario: 频道消息不触发 AI 自动回复
- **WHEN** 用户收到频道消息且已开启 AI 自动回复
- **THEN** 系统不启动 5s 防抖计时器，不生成 AI 自动回复

#### Scenario: 私聊消息仍触发 AI 自动回复
- **WHEN** 用户收到私聊消息且已开启 AI 自动回复
- **THEN** 系统正常启动 5s 防抖计时器（保持现有行为）

### Requirement: 频道消息撤回
用户 SHALL 只能撤回自己在频道中发送的消息。

#### Scenario: 撤回自己的频道消息
- **WHEN** 用户点击自己在 #general 中发送的消息的撤回按钮
- **THEN** Manager 验证 `from_user === 操作者`，删除消息，广播 `chat-revoke` 给所有在线成员

#### Scenario: 无法撤回他人的频道消息
- **WHEN** 用户尝试撤回 Alice 在 #general 中发送的消息
- **THEN** 撤回按钮不显示（与私聊行为一致），或 API 返回 403

### Requirement: 频道消息持久化
频道消息 SHALL 通过 Tauri `save_message` 持久化到 `~/.envoy/history/${myId}/__team__.json`。

#### Scenario: 频道消息保存到本地文件
- **WHEN** 用户发送或收到频道消息
- **THEN** 消息通过 Tauri IPC 保存到 `~/.envoy/history/${myId}/__team__.json`

#### Scenario: 加载频道历史
- **WHEN** 客户端连接成功并加载历史
- **THEN** 系统加载 `__team__.json` 文件中的历史消息到 `"__team__"` 会话

### Requirement: ChatMessage 类型扩展
`ChatMessage` 接口 SHALL 增加 `channel?: string` 和 `mentions?: string[]` 可选字段。

#### Scenario: 私聊消息无 channel 字段
- **WHEN** 构造一条私聊 ChatMessage
- **THEN** `channel` 和 `mentions` 字段为 undefined

#### Scenario: 频道消息携带 channel 和 mentions
- **WHEN** 构造一条频道 ChatMessage
- **THEN** `channel` 值为 `"general"`，`mentions` 值为被提及成员的 ID 数组（如 `["bob", "all"]`）
