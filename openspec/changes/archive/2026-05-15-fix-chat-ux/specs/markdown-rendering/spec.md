## ADDED Requirements

### Requirement: Markdown rendering in chat bubbles
MessageBubble 组件 SHALL 将 `message.text` 中的 Markdown 语法解析为 HTML 并安全渲染。支持的语法包括：加粗、斜体、行内代码、代码块、链接、无序列表、有序列表、引用。

#### Scenario: Render bold text
- **WHEN** 消息文本包含 `**bold**`
- **THEN** 气泡中显示加粗的 "bold"

#### Scenario: Render inline code
- **WHEN** 消息文本包含 `` `code` ``
- **THEN** 气泡中显示带背景色的行内代码样式

#### Scenario: Render code block
- **WHEN** 消息文本包含 triple-backtick 围栏代码块
- **THEN** 气泡中显示等宽字体的代码块，带背景色和内边距

#### Scenario: Render link
- **WHEN** 消息文本包含 `[text](url)` 格式
- **THEN** 气泡中显示可点击的超链接，新窗口打开

### Requirement: XSS protection for rendered Markdown
所有通过 Markdown 渲染的 HTML SHALL 经过 DOMPurify 清洗，禁止 `<script>` 标签、`on*` 事件属性、`javascript:` 协议链接等危险内容。

#### Scenario: Sanitize script tag
- **WHEN** 消息文本包含 `<script>alert('xss')</script>`
- **THEN** 渲染后的 HTML 中不包含任何 `<script>` 元素

#### Scenario: Sanitize event handler
- **WHEN** 消息文本包含 `<img onerror="alert(1)" src=x>`
- **THEN** 渲染后的 HTML 中不包含 `onerror` 属性

### Requirement: Dark/light theme support for Markdown styles
Markdown 渲染产生的所有元素样式（代码块背景、链接颜色、引用边框等）SHALL 使用 CSS 变量，确保 dark 和 light 模式下均可读。

#### Scenario: Code block in dark mode
- **WHEN** 主题为 dark 模式
- **THEN** 代码块使用深色背景变量和浅色文字变量

#### Scenario: Code block in light mode
- **WHEN** 主题为 light 模式
- **THEN** 代码块使用浅色背景变量和深色文字变量

### Requirement: Scoped Markdown styles
所有 Markdown 渲染样式 SHALL 限定在 `.bubble .content` 选择器下，不影响其他组件。

#### Scenario: No style leakage
- **WHEN** 聊天气泡渲染 Markdown
- **THEN** 页面其他区域的相同 HTML 元素不受 Markdown 样式影响
