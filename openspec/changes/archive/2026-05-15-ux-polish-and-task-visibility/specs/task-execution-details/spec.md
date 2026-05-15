## ADDED Requirements

### Requirement: Task execution detail fields
The Manager backend SHALL provide task execution details including: assigned member ID (`assignedTo`), execution start time (`startedAt`), completion time (`completedAt`), execution duration (`duration` in seconds), and result summary (`result`).

#### Scenario: Completed task with result
- **WHEN** a task has been completed by a member
- **THEN** the task data SHALL include `assignedTo`, `startedAt`, `completedAt`, `duration`, and `result` fields

#### Scenario: Pending task
- **WHEN** a task is still pending (not yet assigned)
- **THEN** the task data SHALL include `assignedTo: null`, `startedAt: null`, `completedAt: null`, `duration: null`, `result: null`

### Requirement: Dashboard displays recent task executions
The Manager dashboard SHALL display a list of recent task executions showing: task content, assigned member, duration, status, and result summary. The list SHALL show the most recent tasks first.

#### Scenario: Dashboard loads with tasks
- **WHEN** the Manager dashboard loads
- **THEN** it SHALL display a recent tasks table showing task content, assigned member, duration, status, and result for each task

#### Scenario: No tasks exist
- **WHEN** no tasks have been created yet
- **THEN** the dashboard SHALL display an empty state message in the task details section

### Requirement: Team detail page shows task execution details
The team detail page SHALL display execution details for each task in the task table, including the assigned member, execution duration, and result.

#### Scenario: Team detail with executed tasks
- **WHEN** viewing a team detail page that has tasks
- **THEN** each task row SHALL show the assigned member, duration, and result in additional columns
