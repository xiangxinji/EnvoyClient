## ADDED Requirements

### Requirement: Member profile panel display
系统 SHALL 提供成员详情面板（MemberProfilePanel），当用户通过 HoverCard 头像点击进入时，替换右侧内容区域显示该成员的完整信息。

#### Scenario: Open profile from sidebar HoverCard
- **WHEN** 用户 hover 侧边栏某成员，HoverCard 出现后点击头像
- **THEN** 右侧面板切换为该成员的 MemberProfilePanel，selectedPeer 设为 `__profile__{username}__`

#### Scenario: Open profile from channel message HoverCard
- **WHEN** 用户 hover 群聊消息中某成员的头像，HoverCard 出现后点击头像
- **THEN** 右侧面板切换为该成员的 MemberProfilePanel

#### Scenario: View own profile
- **WHEN** 用户通过 HoverCard 点击自己的头像
- **THEN** 显示自己的只读详情面板（与 SettingsProfile 编辑面板独立）

### Requirement: Profile panel content
MemberProfilePanel SHALL 展示以下信息区块：

1. **头部区**: 大头像（72px）、昵称（无昵称时显示 ID）、角色标签（leader/member）、在线状态指示
2. **任务统计区**: 按任务状态聚合的计数（执行中、待处理、已完成、失败），面板打开时从后端 API 获取
3. **个人信息区**: 职责（responsibilities）、能力（capabilities），有值时显示，无值时不显示该行

#### Scenario: Display member with full info
- **WHEN** 打开一个有完整资料和活跃任务的成员详情
- **THEN** 面板显示大头像、昵称、角色、在线状态、四项任务计数、职责文本、能力文本

#### Scenario: Display member with minimal info
- **WHEN** 打开一个未设置职责和能力的成员详情
- **THEN** 面板显示大头像、昵称、角色、在线状态、任务统计，不显示职责和能力区块

### Requirement: Profile panel navigation
MemberProfilePanel SHALL 提供返回导航和私聊跳转。

#### Scenario: Back navigation
- **WHEN** 用户点击面板左上角返回按钮
- **THEN** 面板关闭，恢复到进入详情页之前的面板（复用 detailReturnPeer 模式）

#### Scenario: Jump to DM chat
- **WHEN** 用户点击"发消息"按钮
- **THEN** selectedPeer 切换为该成员的 ID，打开与该成员的 DM 聊天面板

#### Scenario: Panel transition animation
- **WHEN** 进入或退出 MemberProfilePanel
- **THEN** 使用 slideLeft/slideRight 方向感过渡动画，与现有面板切换规范一致

### Requirement: HoverCard avatar click
MemberHoverCard 的头像区域 SHALL 响应点击事件，emit `view-profile` 事件并传递成员 ID。

#### Scenario: Click avatar on HoverCard
- **WHEN** 用户点击 HoverCard 中的头像区域
- **THEN** HoverCard 立即隐藏，emit `view-profile` 事件并携带 member.id

#### Scenario: HoverCard non-avatar area
- **WHEN** 用户点击 HoverCard 中非头像区域（如文字信息）
- **THEN** 不触发任何导航，HoverCard 保持显示
