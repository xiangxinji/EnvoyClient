## Why

团队成员无法一目了然地看到组织内所有客户端的在线状态和任务负载情况。当前只能通过侧栏成员列表的小圆点判断在线/离线，需要逐个点击才能了解任务执行状态。需要一个可视化的组织架构页面，让 Leader 和 Member 都能直观地看到：谁在线、谁在忙、谁空闲可分配。

## What Changes

- 新增侧栏 Tools 区 `__org__` 入口，点击切换到组织架构视图
- 新增 `OrgView` 页面，使用 `@vue-flow/core` + `@dagrejs/dagre` 渲染两层树形图（Leader → Members）
- 新增三种自定义节点组件：LeaderNode、MemberNode（含在线状态 + 任务摘要 + responsibilities）
- 新增 `useTeamGraph` composable，聚合成员在线状态与任务数据为 Vue Flow 图数据
- 离线成员以虚线边框 + 半透明样式展示，排在底部；空闲成员显示"空闲"提示
- 实时更新：订阅现有 WebSocket 事件（`team:members` + `task`），图自动重渲染
- 新增 npm 依赖：`@vue-flow/core`、`@vue-flow/background`、`@vue-flow/minimap`、`@dagrejs/dagre`

## Capabilities

### New Capabilities
- `org-structure-view`: 组织架构可视化页面，展示 Leader-Members 两层树形图，实时反映在线状态与任务负载

### Modified Capabilities
- `task-center`: 新增 `useTeamGraph` composable 从任务数据中提取每个成员的任务摘要统计

## Impact

- **新依赖**: `@vue-flow/core`, `@vue-flow/background`, `@vue-flow/minimap`, `@dagrejs/dagre`
- **侧栏变更**: `MemberSidebar` 的 tools 列表和 `useSidebarSearch` 新增 `__org__` 入口
- **路由变更**: `ChatView` 的内容区新增 `selectedPeer === '__org__'` 分支渲染 `OrgView`
- **数据源**: 复用 `useConnection.members`（在线状态）+ TaskService/tasks 数据（任务统计），无需新增 API
