## MODIFIED Requirements

### Requirement: Increment unread count on incoming message
系统 SHALL 在收到非当前选中 peer 的聊天消息时，递增该 peer 的未读计数。频道消息的未读计数 SHALL 使用 peerId `"__team__"`。

#### Scenario: Receive channel message when viewing other peer
- **WHEN** 用户当前选中 Alice，收到频道消息
- **THEN** `"__team__"` 的 unreadCounts 增加 1

#### Scenario: Receive channel message when viewing channel
- **WHEN** 用户当前选中 #general 频道，收到频道消息
- **THEN** unreadCounts 不变化

#### Scenario: Receive message from non-selected peer
- **WHEN** 用户当前选中 peerA，收到来自 peerB 的聊天消息
- **THEN** peerB 的 unreadCounts 增加 1

#### Scenario: Receive message from current peer
- **WHEN** 用户当前选中 peerA，收到来自 peerA 的聊天消息
- **THEN** unreadCounts 不变化

### Requirement: Clear unread count when selecting peer
系统 SHALL 在用户选中某个成员或频道时，清零该成员或频道的未读计数。

#### Scenario: Click on member with unread messages
- **WHEN** 用户点击侧边栏中显示 badge 的成员
- **THEN** 该成员的 badge 立即消失，unreadCounts 归零

#### Scenario: Click on channel with unread messages
- **WHEN** 用户点击侧边栏中显示 badge 的 #general 频道
- **THEN** 频道的 badge 立即消失，unreadCounts 归零
