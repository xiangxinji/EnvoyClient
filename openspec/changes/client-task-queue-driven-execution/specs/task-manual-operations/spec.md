## MODIFIED Requirements

### Requirement: 任务开始执行按钮
任务中心"当前任务"区域在任务状态为 pending 且当前用户 ID 在 task.subscribe 列表中时，SHALL 显示"开始执行"按钮。点击后 SHALL 调用 `POST /api/tasks/:id/start`，成功后任务状态变为 running。聊天界面的 TaskCard SHALL NOT 显示此按钮。

#### Scenario: 任务中心当前任务开始执行 pending 任务
- **WHEN** 当前用户 ID 在任务的 subscribe 列表中，且任务状态为 pending，任务位于任务中心"当前任务"区域
- **THEN** 显示"开始执行"按钮，点击后发送 POST 请求，任务状态更新为 running

#### Scenario: 聊天界面不显示操作按钮
- **WHEN** TaskCard 渲染在 ChatPanel 中
- **THEN** 不显示"开始执行"按钮及其他任何操作按钮

#### Scenario: 非分配成员不可见
- **WHEN** 当前用户 ID 不在任务的 subscribe 列表中
- **THEN** 任务中心当前任务区域不显示操作按钮

#### Scenario: 非 pending 状态不显示
- **WHEN** 任务状态为 running、completed 或 failed
- **THEN** 不显示"开始执行"按钮

### Requirement: 任务上传文件按钮
任务中心"当前任务"区域在任务状态为 running 且当前用户 ID 在 task.subscribe 列表中时，SHALL 显示"上传文件"按钮。聊天界面的 TaskCard SHALL NOT 显示此按钮。

#### Scenario: 任务中心当前任务上传文件到运行中任务
- **WHEN** 当前用户 ID 在任务的 subscribe 列表中，任务状态为 running，任务位于"当前任务"区域
- **THEN** 显示"上传文件"按钮，点击后弹出文件选择器，选择文件后上传到 Manager

#### Scenario: 上传成功反馈
- **WHEN** 文件上传成功
- **THEN** 任务资源列表中新增该文件条目

#### Scenario: 上传失败反馈
- **WHEN** 文件上传失败
- **THEN** 显示错误提示"文件上传失败"

### Requirement: 任务标记完成按钮
任务中心"当前任务"区域在任务状态为 running 且当前用户 ID 在 task.subscribe 列表中时，SHALL 显示"标记完成"按钮。聊天界面的 TaskCard SHALL NOT 显示此按钮。

#### Scenario: 任务中心标记任务完成
- **WHEN** 当前用户 ID 在任务的 subscribe 列表中，任务状态为 running，任务位于"当前任务"区域，用户点击"标记完成"并确认
- **THEN** 发送 POST 请求，任务状态更新为 completed

#### Scenario: 取消标记完成
- **WHEN** 用户点击"标记完成"后在确认对话框中取消
- **THEN** 不发送请求，任务状态不变
