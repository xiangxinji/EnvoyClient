## MODIFIED Requirements

### Requirement: Task dispatch form
系统 SHALL 在 Leader 点击"分派任务"后弹出任务表单，包含任务内容输入框，任务将分派给当前选中的成员。`TaskService.dispatch()` SHALL 接受可选的 `mode` 参数，默认为 `"serial"`。

#### Scenario: Submit a task to selected member with default mode
- **WHEN** Leader 选中成员 "Bob"，点击"分派任务"，输入任务内容 "翻译文档" 后确认
- **THEN** 系统调用 `submit({ content: "翻译文档", subscribe: ["Bob"], mode: "serial" })`，mode 默认为 serial

#### Scenario: Submit a task with explicit mode
- **WHEN** AI 智能派发返回 mode 为 "parallel"，Leader 确认派发
- **THEN** 系统调用 `submit({ content, subscribe, mode: "parallel" })`

## ADDED Requirements

### Requirement: Task mode display
TaskDetailPanel SHALL 从 task 数据中读取 mode 字段并正确显示。

#### Scenario: Serial task displays serial badge
- **WHEN** task.mode 为 "serial"
- **THEN** TaskDetailPanel 显示 "串行" 标签

#### Scenario: Parallel task displays parallel badge
- **WHEN** task.mode 为 "parallel"
- **THEN** TaskDetailPanel 显示 "并行" 标签
