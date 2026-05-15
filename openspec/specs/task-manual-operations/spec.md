## ADDED Requirements

### Requirement: 任务开始执行按钮

TaskCard 在任务状态为 pending 且当前用户 ID 在 task.subscribe 列表中时，SHALL 显示"开始执行"按钮。点击后 SHALL 调用 `POST /api/tasks/:id/start`，成功后任务状态变为 running。

#### Scenario: 开始执行 pending 任务
- **WHEN** 当前用户 ID 在任务的 subscribe 列表中，且任务状态为 pending
- **THEN** TaskCard 显示"开始执行"按钮，点击后发送 POST 请求，任务状态更新为 running

#### Scenario: 非分配成员不可见
- **WHEN** 当前用户 ID 不在任务的 subscribe 列表中
- **THEN** TaskCard 不显示任何操作按钮

#### Scenario: 非 pending 状态不显示
- **WHEN** 任务状态为 running、completed 或 failed
- **THEN** TaskCard 不显示"开始执行"按钮

### Requirement: 任务上传文件按钮

TaskCard 在任务状态为 running 且当前用户 ID 在 task.subscribe 列表中时，SHALL 显示"上传文件"按钮。点击后 SHALL 弹出文件选择对话框，选择文件后调用 `POST /api/tasks/:id/resources` 上传。

#### Scenario: 上传文件到运行中任务
- **WHEN** 当前用户 ID 在任务的 subscribe 列表中，任务状态为 running
- **THEN** TaskCard 显示"上传文件"按钮，点击后弹出文件选择器，选择文件后上传到 Manager

#### Scenario: 上传成功反馈
- **WHEN** 文件上传成功
- **THEN** TaskCard 的资源列表中新增该文件条目

#### Scenario: 上传失败反馈
- **WHEN** 文件上传失败
- **THEN** 显示错误提示"文件上传失败"

### Requirement: 任务标记完成按钮

TaskCard 在任务状态为 running 且当前用户 ID 在 task.subscribe 列表中时，SHALL 显示"标记完成"按钮。点击前 SHALL 弹出确认对话框，确认后调用 `POST /api/tasks/:id/complete`。

#### Scenario: 标记任务完成
- **WHEN** 当前用户 ID 在任务的 subscribe 列表中，任务状态为 running，用户点击"标记完成"并确认
- **THEN** 发送 POST 请求，任务状态更新为 completed

#### Scenario: 取消标记完成
- **WHEN** 用户点击"标记完成"后在确认对话框中取消
- **THEN** 不发送请求，任务状态不变

### Requirement: 任务状态变更 API

Manager SHALL 新增两个 HTTP API 端点：
- `POST /api/tasks/:id/start`：将任务状态从 pending 改为 running，广播通知
- `POST /api/tasks/:id/complete`：将任务状态改为 completed，提交结果，广播通知

两个端点都需要 `team` header 和 `from` body 字段。

#### Scenario: 调用 start API
- **WHEN** 客户端发送 `POST /api/tasks/abc123/start`，header 包含 team，body 包含 `{ from: "bob" }`
- **THEN** Manager 将任务 abc123 状态改为 running，通过 Envoy 广播通知所有订阅者

#### Scenario: 调用 complete API
- **WHEN** 客户端发送 `POST /api/tasks/abc123/complete`，header 包含 team，body 包含 `{ from: "bob" }`
- **THEN** Manager 将任务 abc123 状态改为 completed，广播通知，持久化结果

#### Scenario: 任务不存在
- **WHEN** 客户端发送 `POST /api/tasks/nonexistent/start`
- **THEN** 返回 404 错误

#### Scenario: 状态不合法
- **WHEN** 客户端对已 completed 的任务发送 start 请求
- **THEN** 返回 400 错误，提示状态不合法
