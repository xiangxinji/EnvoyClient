## ADDED Requirements

### Requirement: Leader task dispatch button
系统 SHALL 仅在当前角色为 Leader 时，在输入区域旁显示"分派任务"按钮。

#### Scenario: Leader sees dispatch button
- **WHEN** 当前角色为 Leader
- **THEN** 输入区域旁显示"分派任务"按钮

#### Scenario: Member does not see dispatch button
- **WHEN** 当前角色为 Member
- **THEN** 输入区域旁不显示"分派任务"按钮

### Requirement: Task dispatch form
系统 SHALL 在 Leader 点击"分派任务"后弹出任务表单，包含任务内容输入框，任务将分派给当前选中的成员。

#### Scenario: Submit a task to selected member
- **WHEN** Leader 选中成员 "Bob"，点击"分派任务"，输入任务内容 "翻译文档" 后确认
- **THEN** 系统调用 submit({ content: "翻译文档", subscribe: ["Bob"], mode: "serial" })，任务卡片出现在聊天消息流中

### Requirement: Task card display
系统 SHALL 将任务（submit/dispatch 相关消息）渲染为任务卡片，显示任务内容、被分派人、当前状态（pending/running/completed/failed）。

#### Scenario: Task appears in message timeline
- **WHEN** Leader 分派任务后
- **THEN** 消息面板中出现任务卡片，显示任务内容和 "pending" 状态

#### Scenario: Task status updates
- **WHEN** 被分派人开始处理任务
- **THEN** 任务卡片状态更新为 "running"

#### Scenario: Task completed
- **WHEN** 被分派人完成任务
- **THEN** 任务卡片状态更新为 "completed"，并显示结果

### Requirement: Member receives task notification
系统 SHALL 在 Member 收到 dispatch 消息时，在消息面板中显示任务卡片。

#### Scenario: Member sees assigned task
- **WHEN** Member 收到来自 Leader 的任务分派
- **THEN** 消息面板中出现任务卡片，显示任务内容、分派人（Leader）、状态为 "pending"
