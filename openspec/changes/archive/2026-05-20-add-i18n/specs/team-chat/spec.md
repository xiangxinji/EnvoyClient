## MODIFIED Requirements

### Requirement: Member sidebar display
系统 SHALL 在聊天页面左侧显示所有在线成员列表，包含成员 ID 和角色标识（Leader/Member）。角色标签和所有 UI 文本 SHALL 通过 `t()` 函数获取。

#### Scenario: Members online
- **WHEN** 系统收到 team:members 广播
- **THEN** 左侧边栏更新成员列表，显示每个成员的 ID 和当前语言的角色标签

#### Scenario: Member goes offline
- **WHEN** 某成员断开连接导致 team:members 广播更新
- **THEN** 该成员从列表中移除

### Requirement: Selected member chat
系统 SHALL 允许用户点击左侧成员列表中的某个成员，右侧消息面板切换到与该成员的对话视图。

#### Scenario: Click on a member
- **WHEN** 用户点击成员列表中的 "Bob"
- **THEN** 右侧消息面板显示与 Bob 的聊天记录，输入框发送的消息目标为 Bob

### Requirement: Chat message sending
系统 SHALL 允许用户在输入框中输入文本并发送给当前选中的成员，通过 Client.sendTo() 发送。

#### Scenario: Send a chat message
- **WHEN** 用户在输入框输入 "你好" 并点击发送
- **THEN** 系统调用 sendTo(selectedMemberId, "chat", { text: "你好" }) 发送消息，消息立即显示在消息面板中

### Requirement: Chat message receiving
系统 SHALL 监听 Client 的 message 事件，将收到的聊天消息显示在对应发送者的对话中。

#### Scenario: Receive a message from another member
- **WHEN** 系统收到来自 "Alice" 的 subtype 为 "chat" 的消息
- **THEN** 如果当前正在查看与 Alice 的对话，消息立即显示在面板中；否则在该成员的列表项上显示未读标记

### Requirement: WeChat-style layout
系统 SHALL 采用微信风格布局：左侧固定宽度的成员列表侧边栏，右侧自适应的消息面板和输入区。

#### Scenario: Layout rendering
- **WHEN** 聊天页面加载
- **THEN** 左侧显示约 250px 宽的成员列表，右侧显示消息滚动区域（上方）和固定在底部的输入区（下方）
