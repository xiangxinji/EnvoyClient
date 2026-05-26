## MODIFIED Requirements

### Requirement: composable 提供响应式任务状态
composable SHALL 提供响应式的 `currentTask` 和 `queueLength` 状态，反映 Client 内部的任务队列。这些状态 SHALL 在 TaskCenter 的"当前任务"和"等待中"区域被消费。

#### Scenario: 收到 dispatch 时队列更新
- **WHEN** Client 收到 Server dispatch 的任务
- **THEN** `queueLength` 响应式更新，`currentTask` 在任务开始执行时更新

#### Scenario: 任务完成时状态更新
- **WHEN** 当前任务执行完成
- **THEN** `currentTask` 更新为下一个任务或 `null`，`queueLength` 递减

#### Scenario: TaskCenter 消费 currentTask
- **WHEN** TaskCenter 组件挂载
- **THEN** TaskCenter SHALL 读取 `currentTask` 和 `taskQueue` 渲染"当前任务"和"等待中"区域

#### Scenario: TaskCenter 消费 queueLength
- **WHEN** `queueLength` 从 0 变为 2
- **THEN** TaskCenter 的"等待中"区域 SHALL 显示 2 个任务卡片
