## ADDED Requirements

### Requirement: useLeader composable 创建和管理 Leader 实例
`useLeader()` composable SHALL 创建并返回一个 Leader Client 实例及其响应式状态。

#### Scenario: 创建 Leader 并连接
- **WHEN** 调用 `useLeader({ id, servers })` 并调用返回的 `connect()` 方法
- **THEN** 创建 Leader 实例，连接到指定 server，`status` 响应式变为 `"connected"`

#### Scenario: Leader 断开连接
- **WHEN** Leader 连接断开
- **THEN** `status` 响应式变为 `"disconnected"`

#### Scenario: 组件卸载时自动清理
- **WHEN** 使用 composable 的组件卸载
- **THEN** 自动调用 Leader 实例的 `disconnect()` 方法

### Requirement: useMember composable 创建和管理 Member 实例
`useMember()` composable SHALL 创建并返回一个 Member Client 实例及其响应式状态。

#### Scenario: 创建 Member 并连接
- **WHEN** 调用 `useMember({ id, servers })` 并调用返回的 `connect()` 方法
- **THEN** 创建 Member 实例，连接到指定 server，`status` 响应式变为 `"connected"`

#### Scenario: 组件卸载时自动清理
- **WHEN** 使用 composable 的组件卸载
- **THEN** 自动调用 Member 实例的 `disconnect()` 方法

### Requirement: composable 提供响应式任务状态
composable SHALL 提供响应式的 `currentTask` 和 `queueLength` 状态，反映 Client 内部的任务队列。

#### Scenario: 收到 dispatch 时队列更新
- **WHEN** Client 收到 Server dispatch 的任务
- **THEN** `queueLength` 响应式更新，`currentTask` 在任务开始执行时更新

#### Scenario: 任务完成时状态更新
- **WHEN** 当前任务执行完成
- **THEN** `currentTask` 更新为下一个任务或 `null`，`queueLength` 递减

### Requirement: composable 暴露 submit 和 doing 方法
composable SHALL 代理 Client 实例的 `submit()` 和 `doing()` 方法。

#### Scenario: 通过 composable 发起任务
- **WHEN** 调用 composable 返回的 `submit({ content, subscribe, mode })`
- **THEN** 任务通过 Leader/Member Client 提交到远端 Server

#### Scenario: 通过 composable 注册处理器
- **WHEN** 调用 composable 返回的 `doing(handler)`
- **THEN** handler 注册到 Client 实例，后续 dispatch 到达时执行

### Requirement: composable 提供任务事件流
composable SHALL 通过 `onTask` 回调暴露任务状态变更事件。

#### Scenario: 任务状态变更触发回调
- **WHEN** 远端 Server 推送任务状态变更
- **THEN** `onTask` 回调被调用，参数为最新的 Task 对象
