## ADDED Requirements

### Requirement: doing handler 桥接模式
`useTaskExecution` 的 `doing` handler SHALL 不再直接执行 pipeline 或返回 `SKIP_RESULT`。收到 ClientTask 后 SHALL 将其设为响应式 `currentClientTask` 的值，然后返回一个 pending Promise 等待 UI 层通过 `resolveCurrentTask` 触发 resolve。

#### Scenario: Member 收到任务时入队通知
- **WHEN** Member 的 `doing` handler 收到一个新的 ClientTask
- **THEN** `currentClientTask` ref SHALL 更新为该 ClientTask，handler 返回的 Promise 保持 pending

#### Scenario: UI 层完成任务触发下一个
- **WHEN** UI 层调用 `resolveCurrentTask(result)` 传入执行结果
- **THEN** pending Promise SHALL resolve，Envoy Client 的 `processNext` 自动 dequeue 队列中的下一个任务

#### Scenario: Leader reviewing 直接执行不走队列
- **WHEN** Leader 的 `doing` handler 收到 status 为 "reviewing" 的 ClientTask
- **THEN** handler SHALL 直接调用 `handleLeaderReview` 并返回结果，不经过 await 桥接

### Requirement: 暴露 ClientTask 队列响应式状态
`useTaskExecution` SHALL 通过 `useConnection` 的 client 实例暴露以下响应式状态：
- `currentClientTask: Ref<ClientTask | null>` — 当前正在处理的 ClientTask
- `clientTaskQueue: Ref<ClientTask[]>` — 队列中等待的 ClientTask 列表
- `resolveCurrentTask(result)` — 完成当前任务的方法，调用后 Promise resolve

#### Scenario: 队列状态实时反映
- **WHEN** Server dispatch 一个任务给 Member，且当前无执行中的任务
- **THEN** `currentClientTask` SHALL 更新为该任务，`clientTaskQueue` SHALL 为空数组

#### Scenario: 队列中有多个任务
- **WHEN** Server 连续 dispatch 3 个任务给 Member
- **THEN** `currentClientTask` SHALL 为第 1 个任务，`clientTaskQueue` SHALL 包含第 2 和第 3 个任务

### Requirement: 超时保护机制
`doing` handler 的 pending Promise SHALL 在 30 分钟后自动 resolve 一个错误结果，防止队列卡死。

#### Scenario: 任务执行超时
- **WHEN** `currentClientTask` 设置后 30 分钟内未调用 `resolveCurrentTask`
- **THEN** Promise SHALL 自动 resolve `{ error: "execution_timeout" }`，`processNext` 继续处理下一个任务
