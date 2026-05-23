## ADDED Requirements

### Requirement: HoverCard profile entry from sidebar
MemberSidebar 中的 HoverCard SHALL 支持通过点击头像进入成员详情页。

#### Scenario: Click avatar in sidebar HoverCard
- **WHEN** 用户 hover 侧边栏成员，HoverCard 出现后点击头像
- **THEN** MemberSidebar emit `select` 事件，peer ID 为 `__profile__{member.id}__`，ChatView 路由到 MemberProfilePanel

### Requirement: HoverCard profile entry from channel message
群聊消息中的头像 SHALL 支持通过 HoverCard 点击头像进入成员详情页。

#### Scenario: Click avatar in message HoverCard
- **WHEN** 用户 hover 群聊消息中其他成员的头像，HoverCard 出现后点击头像
- **THEN** MessageBubble 通知父组件（ChatPanel → ChatView），selectedPeer 设为 `__profile__{member.id}__`
