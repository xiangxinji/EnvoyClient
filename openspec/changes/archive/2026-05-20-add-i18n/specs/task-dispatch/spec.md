## MODIFIED Requirements

### Requirement: Leader task dispatch button
系统 SHALL 仅在当前角色为 Leader 时显示"分派任务"按钮，按钮文本通过 `t()` 获取。

#### Scenario: Leader sees dispatch button
- **WHEN** 当前角色为 Leader
- **THEN** 显示当前语言的分派任务按钮文本

#### Scenario: Member does not see dispatch button
- **WHEN** 当前角色为 Member
- **THEN** 不显示分派任务按钮

### Requirement: Task dispatch form
系统 SHALL 在 Leader 点击"分派任务"后弹出任务表单，所有表单标签、占位符、按钮文本 SHALL 通过 `t()` 获取。

#### Scenario: Submit a task to selected member
- **WHEN** Leader 输入任务内容后确认
- **THEN** 系统分派任务，表单中文本为当前语言

#### Scenario: 英文界面下表单显示
- **WHEN** 当前语言为英文
- **THEN** 任务表单中所有标签、占位符、按钮显示英文文本

### Requirement: Task card display
系统 SHALL 将任务渲染为任务卡片，显示任务内容、被分派人、当前状态，状态文本通过 `t()` 获取。

#### Scenario: Task appears in message timeline
- **WHEN** Leader 分派任务后
- **THEN** 消息面板中出现任务卡片，状态文本为当前语言

#### Scenario: Task status updates
- **WHEN** 被分派人开始处理任务
- **THEN** 任务卡片状态文本更新为当前语言对应的"执行中"/"Running"等

#### Scenario: Task completed
- **WHEN** 被分派人完成任务
- **THEN** 任务卡片状态文本更新为当前语言对应的"已完成"/"Completed"，并显示结果

### Requirement: Member receives task notification
系统 SHALL 在 Member 收到 dispatch 消息时显示任务卡片，所有文本通过 `t()` 获取。

#### Scenario: Member sees assigned task
- **WHEN** Member 收到来自 Leader 的任务分派
- **THEN** 消息面板中出现任务卡片，所有文本为当前语言
