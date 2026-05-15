## 1. 标题栏用户名

- [x] 1.1 TitleBar.vue 添加 `username` prop，有值时显示 "Envoy · {username}"
- [x] 1.2 ChatView.vue 将 `myId` 传递给 TitleBar 组件

## 2. 消息滚动加载

- [x] 2.1 ChatPanel.vue 添加 `displayCount` 响应式状态（默认 50），用 `slice(-displayCount)` 截取渲染消息
- [x] 2.2 ChatPanel.vue 添加滚动监听，检测到顶部时 `displayCount += 50`，并显示加载指示器
- [x] 2.3 ChatPanel.vue 优化自动滚动逻辑：仅在用户处于底部时自动滚动，滚上去时不强制跳转

## 3. 任务执行详情 - 后端

- [x] 3.1 Manager dashboard 路由扩展返回数据：增加 `recentTasks` 列表，包含执行人、状态、资源数据
- [x] 3.2 Manager teams 路由：`GET /api/teams/:name/tasks` 返回的任务中包含 resources 详情
- [x] 3.3 新增 `GET /api/teams/:name/tasks/:id` 单任务详情接口，返回完整资源与执行结果

## 4. 任务执行详情 - 前端

- [x] 4.1 Manager `api.ts` 更新类型定义，新增 `TaskDetailData` 接口和 `getTaskDetail` 方法
- [x] 4.2 Dashboard.vue 添加最近任务表格，行可点击跳转详情
- [x] 4.3 TaskTable.vue 任务行可点击跳转到 `/teams/:name/tasks/:id`
- [x] 4.4 新增 TaskDetail.vue 独立页面，展示任务基本信息、内容、执行结果、资源记录
- [x] 4.5 Manager router 添加 `/teams/:name/tasks/:id` 路由
