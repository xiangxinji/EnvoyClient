## ADDED Requirements

### Requirement: Task center sidebar entry
The MemberSidebar SHALL include a "任务中心" entry that shows all tasks across all conversations, independent of peer selection.

#### Scenario: Leader sees task center
- **WHEN** a Leader user views the sidebar
- **THEN** a "任务中心" entry SHALL be visible with a task count badge showing total tasks

#### Scenario: Member sees task center
- **WHEN** a Member user views the sidebar
- **THEN** a "任务中心" entry SHALL be visible showing tasks assigned to them

### Requirement: Task center view
The task center SHALL display all tasks grouped by status (running, pending, completed, failed), with task content, assigned members, and execution status per member.

#### Scenario: Tasks grouped by status
- **WHEN** there are 2 running, 1 completed, and 3 pending tasks
- **THEN** the task center SHALL show three groups with counts: "执行中 (2)", "等待中 (3)", "已完成 (1)"

#### Scenario: Multi-member task card
- **WHEN** a task was dispatched to members ["alice", "bob"]
- **THEN** the task card SHALL show both members with their individual status (e.g., "alice: 已完成", "bob: 执行中")

### Requirement: TaskCard multi-member display
The TaskCard component SHALL support displaying multiple assigned members with individual execution status derived from task resources.

#### Scenario: Task with single member result
- **WHEN** a task has one resource with `type: "client-result"` from "alice"
- **THEN** the card SHALL show "alice" with status "已完成"

#### Scenario: Task with multiple member results
- **WHEN** a task has resources from "alice" and "bob"
- **THEN** the card SHALL show both members with their respective statuses
