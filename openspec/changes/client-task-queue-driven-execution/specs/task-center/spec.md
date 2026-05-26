## MODIFIED Requirements

### Requirement: Task center view
The task center SHALL display all tasks grouped by status (running, pending, completed, failed), with task content, assigned members, and execution status per member. Additionally, the task center SHALL include a "当前任务" (current task) section at the top and a "等待中" (queued) section below it.

#### Scenario: Tasks grouped by status
- **WHEN** there are 2 running, 1 completed, and 3 pending tasks
- **THEN** the task center SHALL show three groups with counts: "执行中 (2)", "等待中 (3)", "已完成 (1)"

#### Scenario: Multi-member task card
- **WHEN** a task was dispatched to members ["alice", "bob"]
- **THEN** the task card SHALL show both members with their individual status (e.g., "alice: 已完成", "bob: 执行中")

#### Scenario: Member sees current task section
- **WHEN** Member role user views task center and `currentClientTask` is not null
- **THEN** the task center SHALL display a "当前任务" section at the top showing the current ClientTask with full action buttons

#### Scenario: Member sees queued tasks section
- **WHEN** Member role user views task center and `clientTaskQueue` has entries
- **THEN** the task center SHALL display a "等待中" section showing queued tasks in read-only mode, without action buttons

#### Scenario: Current task completes and next dequeues
- **WHEN** the current task is resolved and `clientTaskQueue` has the next task
- **THEN** the next task SHALL move to "当前任务" section, "等待中" section SHALL update to exclude it

#### Scenario: No current task
- **WHEN** `currentClientTask` is null and `clientTaskQueue` is empty
- **THEN** the "当前任务" section SHALL show an empty state, "等待中" section SHALL be hidden

### Requirement: TaskCard multi-member display
The TaskCard component SHALL support displaying multiple assigned members with individual execution status derived from task resources. TaskCard SHALL accept a `showActions` prop to control whether action buttons are visible.

#### Scenario: Task with single member result
- **WHEN** a task has one resource with `type: "client-result"` from "alice"
- **THEN** the card SHALL show "alice" with status "已完成"

#### Scenario: Task with multiple member results
- **WHEN** a task has resources from "alice" and "bob"
- **THEN** the card SHALL show both members with their respective statuses

#### Scenario: TaskCard in chat hides actions
- **WHEN** TaskCard is rendered in ChatPanel with `showActions` set to false
- **THEN** TaskCard SHALL NOT render TaskActionButtons, clicking the card SHALL navigate to task center

#### Scenario: TaskCard in current task shows actions
- **WHEN** TaskCard is rendered in task center's current task section with `showActions` set to true
- **THEN** TaskCard SHALL render TaskActionButtons with full operation capabilities
