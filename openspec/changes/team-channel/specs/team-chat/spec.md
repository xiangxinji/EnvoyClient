## MODIFIED Requirements

### Requirement: Member sidebar display
系统 SHALL 在聊天页面左侧显示所有在线成员列表，包含成员 ID 和角色标识（Leader/Member）。侧边栏顶部 SHALL 显示固定的 #general 频道入口。

#### Scenario: Members online
- **WHEN** 系统收到 team:members 广播
- **THEN** 左侧边栏更新成员列表，显示每个成员的 ID 和角色标签

#### Scenario: Member goes offline
- **WHEN** 某成员断开连接导致 team:members 广播更新
- **THEN** 该成员从列表中移除

#### Scenario: 频道入口显示
- **WHEN** 聊天页面加载
- **THEN** 侧边栏顶部（成员列表上方）显示 #general 频道入口，带有频道图标和 "General" 标签

#### Scenario: 频道入口未读角标
- **WHEN** #general 频道有 5 条未读消息
- **THEN** 频道入口右侧显示未读角标 "5"

#### Scenario: 频道入口无未读
- **WHEN** #general 频道没有未读消息
- **THEN** 频道入口不显示未读角标

### Requirement: Selected member chat
系统 SHALL 允许用户点击左侧成员列表中的某个成员，右侧消息面板切换到与该成员的对话视图。点击 #general 频道入口 SHALL 切换到频道对话视图。

#### Scenario: Click on a member
- **WHEN** 用户点击成员列表中的 "Bob"
- **THEN** 右侧消息面板显示与 Bob 的聊天记录，输入框发送的消息目标为 Bob

#### Scenario: Click on #general channel
- **WHEN** 用户点击侧边栏顶部的 #general 频道入口
- **THEN** 右侧消息面板显示 #general 频道的聊天记录，输入框发送的消息目标为频道
