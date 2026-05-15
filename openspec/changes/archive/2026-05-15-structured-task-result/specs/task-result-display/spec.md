## ADDED Requirements

### Requirement: AI Summary Markdown 渲染

系统 SHALL 将 `task.resources[]` 中 `type` 为 `client-result` 的资源的 `data.result` 字段作为 Markdown 渲染展示，而非 JSON 字符串。渲染 SHALL 使用 `marked` + `DOMPurify` 进行安全解析。

#### Scenario: Agent 返回 Markdown 格式结果
- **WHEN** Member 完成任务，提交 `{ result: "## 任务完成\n\n已生成文档..." }`
- **THEN** TaskCard 的 Summary 区 SHALL 渲染为格式化的 Markdown 内容（标题、列表、加粗等）

#### Scenario: Agent 返回纯文本结果
- **WHEN** Member 提交 `{ result: "磁盘使用率 45%，无需清理" }`
- **THEN** TaskCard SHALL 将纯文本作为单段 Markdown 渲染

### Requirement: 文件资源列表展示

系统 SHALL 在 TaskCard 中展示 `task.resources[]` 中 `type` 为 `file-resource` 的资源列表。每个文件资源 SHALL 显示：文件名、文件大小、上传者（by 字段）、上传时间。

#### Scenario: 多个文件上传
- **WHEN** Member 在执行过程中上传了 3 个文件
- **THEN** TaskCard 的 Resources 区 SHALL 列出 3 条文件记录，每条包含文件名、大小、上传者和上传时间

#### Scenario: 无文件上传
- **WHEN** Member 完成任务但未上传任何文件
- **THEN** TaskCard 的 Resources 区 SHALL 显示"无上传文件"提示

### Requirement: 文件资源下载链接

系统 SHALL 为每个文件资源构造下载 URL，格式为 `{managerUrl}/api/tasks/{taskId}/resources/{filename}`，请求时 SHALL 携带 `team` header。

#### Scenario: 点击文件下载
- **WHEN** Leader 点击 TaskCard 中的文件资源条目
- **THEN** 系统 SHALL 通过构造的 URL 下载对应文件

#### Scenario: 文件已不存在
- **WHEN** 文件在服务器磁盘上已被删除，Leader 点击下载
- **THEN** 系统 SHALL 显示错误提示"文件不存在或已被删除"

### Requirement: 执行过程时间线展示

系统 SHALL 在 TaskCard 中展示 `task.resources[]` 中 `type` 为 `execution-trace` 的资源。展示 SHALL 为时间线形式，每步显示：步骤序号、AI 推理文本、工具调用名称和参数、工具执行结果。每步 SHALL 可折叠/展开查看详情。

#### Scenario: 多步执行过程
- **WHEN** Agent 执行了 5 步 ReAct 循环
- **THEN** 时间线 SHALL 显示 5 个步骤节点，每个包含 AI 推理摘要、工具调用信息和执行结果

#### Scenario: 单步快速完成
- **WHEN** Agent 仅执行 1 步即调用 `done`
- **THEN** 时间线 SHALL 显示 1 个步骤节点

#### Scenario: 步骤默认折叠
- **WHEN** TaskCard 首次渲染包含 execution-trace
- **THEN** 时间线 SHALL 默认折叠，仅显示步骤摘要（步骤序号 + 工具名称），用户点击后展开详情

### Requirement: TaskCard 三分区布局

TaskCard SHALL 按 resource type 分为三个独立展示区：Summary（client-result）、Resources（file-resource）、Execution Trace（execution-trace）。每个区 SHALL 有独立的标题和内容区域。

#### Scenario: 完整结果展示
- **WHEN** 任务完成，task.resources 包含 client-result、file-resource 和 execution-trace 三种类型
- **THEN** TaskCard SHALL 按顺序显示三个区：Summary → Resources → Execution Trace

#### Scenario: 仅有 Summary
- **WHEN** 旧任务只有 client-result 资源，无 file-resource 和 execution-trace
- **THEN** TaskCard SHALL 仅显示 Summary 区，其余区不显示（向后兼容）
