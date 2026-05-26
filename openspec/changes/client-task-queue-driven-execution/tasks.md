## 1. useTaskExecution 桥接层改造

- [x] 1.1 重写 `useTaskExecution.registerHandler`：doing handler 不再直接执行 pipeline，改为设置 `currentClientTask` ref 并返回 pending Promise
- [x] 1.2 新增 `currentClientTask: Ref<ClientTask | null>` 响应式状态，doing handler 收到任务时更新
- [x] 1.3 新增 `clientTaskQueue: Ref<ClientTask[]>` 响应式状态，监听 client 的 `task_queued`/`task_started`/`task_completed`/`task_failed` 事件同步
- [x] 1.4 新增 `resolveCurrentTask(result)` 方法，调用 pending Promise 的 resolve，触发 Envoy processNext 自动 dequeue 下一个
- [x] 1.5 Leader reviewing 路径保留在 doing handler 内直接执行，不走 await 桥接
- [x] 1.6 添加 30 分钟超时保护，超时后自动 resolve `{ error: "execution_timeout" }`
- [x] 1.7 在 `useTeamClient` 中传递 `currentClientTask`、`clientTaskQueue`、`resolveCurrentTask` 到上下文

## 2. 任务中心执行 composable

- [x] 2.1 创建 `useTaskCenterExecution` composable，接收 `currentClientTask`、`resolveCurrentTask` 和用户设置
- [x] 2.2 Auto 模式：watch `currentClientTask` 变化时自动调用 `taskService.start()` + pipeline 执行 + `resolveCurrentTask`
- [x] 2.3 Manual 模式：暴露 `executeCurrentTask()` 方法，等用户点击后执行 pipeline + `resolveCurrentTask`
- [x] 2.4 将 `handleMemberExecution` 的 pipeline 执行逻辑（outbox、submitResult、trace 收集）迁移到该 composable

## 3. TaskCenter 界面改造

- [x] 3.1 新增"当前任务"区域（置顶）：读取 `currentClientTask`，渲染完整 TaskCard + 操作按钮
- [x] 3.2 新增"等待中"区域：读取 `clientTaskQueue`，渲染只读 TaskCard 列表，无操作按钮
- [x] 3.3 原有分组（running/pending/completed/failed）中排除 ClientTask 队列中的任务，避免重复显示
- [x] 3.4 当前任务区域 Auto 模式显示执行进度（isRunning、currentStep），Manual 模式显示"执行"按钮

## 4. 聊天 TaskCard 只读化

- [x] 4.1 TaskCard 新增 `showActions` prop，默认 `false`
- [x] 4.2 ChatPanel 中渲染 TaskCard 时传 `showActions={false}`，移除 TaskActionButtons
- [x] 4.3 TaskCard 无操作按钮时点击卡片 emit `selectTask` 并导航到任务中心
- [x] 4.4 TaskCenter 的"当前任务"区域渲染 TaskCard 时传 `showActions={true}`

## 5. 清理与测试

- [x] 5.1 移除 `useTaskExecution` 中旧的 `handleMemberExecution` 方法（已迁移到 useTaskCenterExecution）
- [x] 5.2 移除 `SKIP_RESULT` 在 Member 路径中的使用（Leader reviewing 路径可选保留）
- [x] 5.3 验证连续 dispatch 多个任务时队列串行执行循环正常
- [x] 5.4 验证 Auto/Manual 模式切换后行为正确
- [x] 5.5 验证 Leader 审核不受队列约束
