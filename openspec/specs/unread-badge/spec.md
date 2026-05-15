## ADDED Requirements

### Requirement: Increment unread count on incoming message
系统 SHALL 在收到非当前选中 peer 的聊天消息时，递增该 peer 的未读计数。

#### Scenario: Receive message from non-selected peer
- **WHEN** 用户当前选中 peerA，收到来自 peerB 的聊天消息
- **THEN** peerB 的 unreadCounts 增加 1

#### Scenario: Receive message from current peer
- **WHEN** 用户当前选中 peerA，收到来自 peerA 的聊天消息
- **THEN** unreadCounts 不变化

#### Scenario: Receive task notification from non-selected peer
- **WHEN** 用户当前选中 peerA，收到来自 peerB 的任务更新
- **THEN** peerB 的 unreadCounts 增加 1

### Requirement: Clear unread count when selecting peer
系统 SHALL 在用户选中某个成员时，清零该成员的未读计数。

#### Scenario: Click on member with unread messages
- **WHEN** 用户点击侧边栏中显示 badge 的成员
- **THEN** 该成员的 badge 立即消失，unreadCounts 归零

### Requirement: WeChat-style badge display
侧边栏 badge SHALL 使用微信风格显示：1-99 显示具体数字，超过 99 显示 "99+"。

#### Scenario: Fewer than 100 unread messages
- **WHEN** 某成员有 5 条未读消息
- **THEN** badge 显示 "5"

#### Scenario: 99 unread messages
- **WHEN** 某成员有 99 条未读消息
- **THEN** badge 显示 "99"

#### Scenario: More than 99 unread messages
- **WHEN** 某成员有 100 条未读消息
- **THEN** badge 显示 "99+"

#### Scenario: Zero unread messages
- **WHEN** 某成员有 0 条未读消息
- **THEN** 不显示 badge

### Requirement: Unread count API separation
useTeamClient composable SHALL 提供 `incrementUnread(peerId)` 和 `markRead(peerId)` 两个独立方法替代原有 `syncUnread`。

#### Scenario: incrementUnread call
- **WHEN** 调用 `incrementUnread("peerA")`
- **THEN** peerA 的 unreadCounts 值增加 1

#### Scenario: markRead call
- **WHEN** 调用 `markRead("peerA")`
- **THEN** peerA 的 unreadCounts 值设为 0
