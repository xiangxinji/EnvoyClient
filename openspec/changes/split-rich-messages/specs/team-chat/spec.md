## MODIFIED Requirements

### Requirement: Chat message sending

系统 SHALL 允许用户在输入框中输入文本并发送给当前选中的成员。当消息包含混合内容（文字+图片+云资源）时，SHALL 拆分为多条独立消息逐条顺序发送。

#### Scenario: Send a plain text message
- **WHEN** 用户在输入框输入 "你好" 并点击发送
- **THEN** 系统调用 sendTo 发送一条文字消息，消息立即显示在消息面板中

#### Scenario: Send text with inline image
- **WHEN** 用户输入 "aaa" 并在文字中间粘贴一张图片然后输入 "bbb"
- **THEN** 系统顺序发送三条消息：文字 "aaa"、图片消息、文字 "bbb"

#### Scenario: Send only an image
- **WHEN** 用户在输入框中只粘贴了一张图片（无文字）
- **THEN** 系统发送一条图片消息（text 为空，包含单个 image attachment）
