## MODIFIED Requirements

### Requirement: Chat message sending
系统 SHALL 允许用户在输入框中输入文本并发送给当前选中的成员，通过 Client.sendTo() 发送。消息 SHALL 支持可选的 `source` 字段（`"human" | "ai-auto"`），默认为 `"human"`。

#### Scenario: Send a chat message
- **WHEN** 用户在输入框输入 "你好" 并点击发送
- **THEN** 系统调用 sendTo(selectedMemberId, "chat", { text: "你好", source: "human" }) 发送消息，消息立即显示在消息面板中

#### Scenario: Send an AI auto-reply message
- **WHEN** 自动回复系统发送 AI 生成的回复
- **THEN** 系统调用 sendTo(peerId, "chat", { text: 回复文本, source: "ai-auto" }) 发送消息

### Requirement: Chat message receiving
系统 SHALL 监听 Client 的 message 事件，将收到的聊天消息显示在对应发送者的对话中。消息 SHALL 携带 `source` 字段以标识来源。

#### Scenario: Receive a message from another member
- **WHEN** 系统收到来自 "Alice" 的 subtype 为 "chat" 的消息
- **THEN** 如果当前正在查看与 Alice 的对话，消息立即显示在面板中（包含 `source` 字段）；否则在该成员的列表项上显示未读标记

#### Scenario: Receive an AI auto-reply message
- **WHEN** 系统收到来自其他成员的 `source: "ai-auto"` 消息
- **THEN** 消息正常显示在对话中，MessageBubble 渲染 AI 自动生成标记 badge
