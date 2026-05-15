## 1. 用户职责字段

- [x] 1.1 `user-registry.ts` UserRecord 加 `responsibilities: string` 字段，loadUsers 兼容旧数据
- [x] 1.2 `routes/users.ts` POST /api/users 接收 responsibilities 参数
- [x] 1.3 Manager 后台 `api.ts` createUser 方法传 responsibilities
- [x] 1.4 Manager 后台 `Users.vue` 创建用户表单加 responsibilities textarea

## 2. 职责传递

- [x] 2.1 `routes/teams.ts` GET /api/teams/:name/members 返回时从 users.json 查 responsibilities 并附加
- [x] 2.2 EnvoyClient `types.ts` MemberInfo 加 responsibilities 字段

## 3. AI 智能分派接口

- [x] 3.1 新建 `manager/server/services/ai/dispatch.ts`，实现 handleTaskDispatch handler
- [x] 3.2 新建 `manager/server/services/ai/prompts/dispatch.ts`，定义 dispatch system prompt
- [x] 3.3 `routes/ai.ts` 注册 `POST /api/ai/task/dispatch` 公开路由
- [x] 3.4 EnvoyClient `useAI.ts` 新增 `dispatchTask()` 方法调用新接口

## 4. 任务输入 UI 改造

- [x] 4.1 ChatPanel.vue 任务输入区域去掉 peerId 依赖，改为全局入口
- [x] 4.2 ChatPanel.vue 添加 AI 分派预览面板（展示匹配的成员 + 确认/取消按钮）
- [x] 4.3 ChatPanel.vue 确认后调用 `dispatchTask(subscribe, content)` 提交

## 5. TaskCard 多成员展示

- [x] 5.1 TaskCard.vue 解析 resources 展示每个成员的执行状态

## 6. 任务中心

- [x] 6.1 新建 `src/views/TaskCenterView.vue`，聚合所有对话中的 TaskMessage，按状态分组展示
- [x] 6.2 MemberSidebar.vue 添加"任务中心"入口（带任务计数 badge）
- [x] 6.3 router.ts 添加 `/tasks` 路由
