## Tasks

### Phase 1: 框架层 — Client 类扩展

- [ ] 1.1 在 `ClientEvents` 中新增 5 个队列事件类型（`task_queued` / `task_started` / `task_completed` / `task_failed` / `task_skipped`）
- [ ] 1.2 Client 类新增 `history` 数组（cap 20）、`taskQueue` getter、`taskHistory` getter、`pushHistory` 方法
- [ ] 1.3 在 `handleDispatch` 中 emit `task_queued`
- [ ] 1.4 在 `processNext` 各分支中 emit 对应事件并调用 `pushHistory`

### Phase 2: 桥接层 — Composable

- [ ] 2.1 新建 `src/composables/useClientTaskQueue.ts`，定义 `ClientQueueTask` 接口和 `toQueueTask` 转换函数
- [ ] 2.2 订阅 Client 的 5 个事件，维护 `queue` / `running` / `history` 三个 ref
- [ ] 2.3 暴露 `agentStep` 和 `agentRunning` computed（从 useAgent 透传）
- [ ] 2.4 `useTeamClient.ts` 中初始化 `useClientTaskQueue`，从 `taskExec.agent` 传入 agent 状态
- [ ] 2.5 `teamClientContext.ts` 新增 `setClientTaskQueue` / `getClientTaskQueue`

### Phase 3: UI 层 — TaskQueuePanel

- [ ] 3.1 新建 `src/components/TaskQueuePanel/` 目录结构（main.vue / styles.css / index.ts）
- [ ] 3.2 实现 Running 卡片：content + 进度条 + step 计数 + elapsed 计时器
- [ ] 3.3 实现 Queued 列表：紧凑 pending 卡片
- [ ] 3.4 实现 Recent 列表：completed / failed / skipped 卡片
- [ ] 3.5 实现空状态
- [ ] 3.6 实现 styles.css（进度条、卡片样式、分区标签）

### Phase 4: 集成

- [ ] 4.1 `MemberSidebar/main.vue` 工具区新增 `__queue__` 入口，显示排队任务数 badge
- [ ] 4.2 `ChatView/main.vue` 路由 `__queue__` 到 TaskQueuePanel
