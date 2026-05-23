## Why

当前只能通过 HoverCard 浮层看到成员的简要信息（昵称、角色、在线状态），缺少完整的个人详情视图。在任务派发和协作场景中，团队需要了解成员的职责、能力和当前任务负载，以便做出更好的协作决策。

## What Changes

- 新增 MemberProfilePanel 面板组件，展示成员完整信息：头像、昵称、角色、在线状态、任务统计（执行中/待处理/已完成/失败）、职责、能力
- MemberHoverCard 头像区域增加点击事件，作为进入详情页的入口
- ChatView 导航系统增加 `__profile__{username}__` 特殊 peer ID 的解析和路由
- 复用 detailReturnPeer 模式实现返回导航
- 面板内"发消息"按钮支持跳转到该成员的 DM 聊天

## Capabilities

### New Capabilities
- `member-profile-panel`: 成员个人详情面板，包含个人信息展示、实时任务统计、私聊跳转入口

### Modified Capabilities
- `team-chat`: HoverCard 交互扩展——头像可点击进入详情页，需在群聊消息头像和侧边栏成员列表两个位置生效

## Impact

- **前端组件**: MemberHoverCard（添加点击事件）、MemberSidebar（监听 view-profile）、MessageBubble（监听 view-profile）、ChatView（新增路由分支）、新建 MemberProfilePanel 组件
- **数据层**: 复用 `useUserProfile` 和 `MemberInfo`，任务统计数据复用后端已有任务聚合能力
- **导航**: ChatView 的 `selectedPeer` 增加 `__profile__*` 模式匹配
- **后端**: 无新接口需求，任务统计复用现有任务数据
