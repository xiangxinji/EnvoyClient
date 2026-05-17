## MODIFIED Requirements

### Requirement: Task center sidebar entry
MemberSidebar SHALL 包含"任务中心"入口，显示所有任务，文本通过 `t()` 获取。

#### Scenario: Leader sees task center
- **WHEN** a Leader user views the sidebar
- **THEN** a task center entry SHALL be visible with a task count badge, 标签文本为当前语言

#### Scenario: Member sees task center
- **WHEN** a Member user views the sidebar
- **THEN** a task center entry SHALL be visible, 标签文本为当前语言

### Requirement: Task center view
Task center SHALL 按状态分组显示所有任务，分组标题和状态标签 SHALL 通过 `t()` 函数获取。任务状态标签 SHALL 使用统一的翻译 key（`task.status.waiting`, `task.status.running`, `task.status.reviewing`, `task.status.completed`, `task.status.failed`），消除跨文件重复定义。

#### Scenario: Tasks grouped by status
- **WHEN** there are 2 running, 1 completed, and 3 pending tasks, 当前语言为英文
- **THEN** the task center SHALL show three groups: "Running (2)", "Waiting (3)", "Completed (1)"

#### Scenario: 中文状态标签
- **WHEN** 当前语言为简体中文
- **THEN** 任务状态显示为"执行中"、"等待中"、"已完成"等中文文本

#### Scenario: Multi-member task card
- **WHEN** a task was dispatched to members ["alice", "bob"]
- **THEN** the task card SHALL show both members with their individual status, 状态文本为当前语言

### Requirement: TaskCard multi-member display
TaskCard 组件 SHALL 显示多个被分派成员及其执行状态，状态文本 SHALL 通过 `t()` 获取。

#### Scenario: Task with single member result
- **WHEN** a task has one resource with `type: "client-result"` from "alice"
- **THEN** the card SHALL show "alice" with localized status text

#### Scenario: Task with multiple member results
- **WHEN** a task has resources from "alice" and "bob"
- **THEN** the card SHALL show both members with localized status text
