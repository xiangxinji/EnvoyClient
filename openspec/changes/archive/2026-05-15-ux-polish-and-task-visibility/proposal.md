## Why

多窗口调试时无法区分不同 Member 身份（标题栏无用户名），消息列表全量加载导致性能问题，Manager 仪表盘缺少任务执行详情。这三个 UX 问题影响日常使用效率，需要一起解决。

## What Changes

- **标题栏显示用户名**: Tauri 窗口标题栏增加当前登录用户名，方便多窗口调试时区分身份
- **消息滚动加载**: 聊天面板默认只展示最近 50 条消息，向上滚动到顶部时触发加载更多历史记录，提升大量消息场景下的渲染性能
- **仪表盘任务执行详情**: Manager 仪表盘和团队详情页展示任务的执行人、执行时长、执行结果，让管理者能看到任务的完整生命周期

## Capabilities

### New Capabilities

- `titlebar-username`: 标题栏组件接收并显示当前登录用户名
- `chat-lazy-load`: 聊天面板消息滚动加载，默认 50 条，向上滚动触发历史加载
- `task-execution-details`: Manager 仪表盘/团队详情页展示任务执行详情（执行人、耗时、结果）

### Modified Capabilities

## Impact

- **前端组件**: `TitleBar.vue`、`ChatPanel.vue` 需要改动
- **Manager 前端**: `Dashboard.vue`、`TeamDetail.vue` 需要新增任务详情展示
- **Manager 后端**: `Dashboard` 和 `teams` 路由可能需要返回更多任务字段
- **数据流**: `teamClientContext` 需要传递用户名到标题栏
