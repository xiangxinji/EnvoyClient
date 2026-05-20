## ADDED Requirements

### Requirement: Task detail slide-over panel
系统 SHALL 提供一个 slide-over 面板组件 (TaskDetailPanel)，从右侧滑入，展示任务的完整详情信息。

#### Scenario: 从 TaskCard 打开详情
- **WHEN** 用户在任务中心点击某个 TaskCard
- **THEN** 右侧 SHALL 滑入 TaskDetailPanel，展示该任务的完整信息

#### Scenario: 从聊天面板打开任务详情
- **WHEN** 用户在 ChatPanel 中的聊天消息里点击任务相关内容
- **THEN** 右侧 SHALL 滑入 TaskDetailPanel

#### Scenario: 关闭详情面板
- **WHEN** 用户点击详情面板的关闭按钮
- **THEN** 面板 SHALL 滑出隐藏，恢复之前的内容面板状态

### Requirement: Task detail basic info display
TaskDetailPanel SHALL 展示任务的基本信息，包括：任务内容、状态徽章、执行模式（serial/parallel）、创建者、创建时间、尝试次数。

#### Scenario: 显示完整基本信息
- **WHEN** 打开任意任务的详情面板
- **THEN** SHALL 显示：任务内容文本、状态徽章（pending/running/reviewing/completed/failed）、执行模式、创建者 ID、创建时间（格式化显示）、当前尝试次数

### Requirement: Task detail event timeline
TaskDetailPanel SHALL 展示基于 Resource timestamp 的事件时间线，列出任务生命周期中的关键事件。

#### Scenario: 有完整时间线数据
- **WHEN** 任务的所有 Resource 都有 timestamp
- **THEN** 时间线 SHALL 按时间排序显示：创建时间（Task.createdAt）、各成员执行完成时间（client-result.timestamp）、Leader 审核时间（leader-review.timestamp）

#### Scenario: 部分 Resource 缺少 timestamp
- **WHEN** 部分旧 Resource 没有 timestamp
- **THEN** 时间线 SHALL 显示有 timestamp 的事件，缺少 timestamp 的事件 SHALL 显示在时间线末尾且不带时间标记

#### Scenario: 任务刚创建无事件
- **WHEN** 任务状态为 pending 且无 Resource
- **THEN** 时间线 SHALL 仅显示"创建任务"事件

### Requirement: Task detail results and traces
TaskDetailPanel SHALL 按成员分组展示执行结果、执行轨迹和上传的资源文件。

#### Scenario: 显示成员执行结果
- **WHEN** 任务有 client-result 类型的 Resource
- **THEN** SHALL 按成员分组，展示每个成员的执行结果文本（Markdown 渲染）

#### Scenario: 显示执行轨迹
- **WHEN** 任务有 execution-trace 类型的 Resource
- **THEN** SHALL 在对应成员下展示可展开的 Agent 执行轨迹（步骤序号、推理、工具调用、工具结果）

#### Scenario: 显示资源文件
- **WHEN** 任务有 file-resource 类型的 Resource
- **THEN** SHALL 展示文件名、文件大小、上传时间，并提供下载链接

#### Scenario: 显示 Leader 审核记录
- **WHEN** 任务有 leader-review 类型的 Resource
- **THEN** SHALL 展示审核结果（通过/驳回）和审核时间

### Requirement: Task detail actions
TaskDetailPanel SHALL 提供与 TaskCard 一致的操作按钮，根据用户角色和任务状态动态显示。

#### Scenario: Member 执行操作
- **WHEN** 任务分配给当前用户且状态为 pending
- **THEN** SHALL 显示"开始执行"按钮

#### Scenario: Member 完成操作
- **WHEN** 任务分配给当前用户且状态为 running
- **THEN** SHALL 显示"上传文件"和"标记完成"按钮

#### Scenario: Leader 审核操作
- **WHEN** 任务由当前用户创建且状态为 reviewing
- **THEN** SHALL 显示"通过"和"驳回"按钮

#### Scenario: 操作后刷新
- **WHEN** 用户在详情面板执行操作（开始/完成/上传/审核）
- **THEN** 面板 SHALL 自动刷新任务数据并更新显示

### Requirement: Task card click to emit event
TaskCard 点击 SHALL 触发 `select-task` 事件，传递任务 ID，由父组件处理导航到详情面板。

#### Scenario: 点击 TaskCard 卡片区域
- **WHEN** 用户点击 TaskCard 的卡片主体区域（非操作按钮）
- **THEN** SHALL emit `select-task` 事件，payload 为 `task.taskId`

### Requirement: Task detail panel follows glass design system
TaskDetailPanel SHALL 遵循项目的毛玻璃设计系统，使用 Standard glass 层级（`--glass-bg` + `backdrop-filter: blur`）。

#### Scenario: 亮色主题下显示
- **WHEN** 系统处于亮色模式
- **THEN** 面板 SHALL 使用 CSS 变量渲染，背景、文字、边框均使用 `var(--*)` 变量

#### Scenario: 暗色主题下显示
- **WHEN** 系统处于暗色模式
- **THEN** 面板 SHALL 通过 `html.dark` 的变量定义自动适配
