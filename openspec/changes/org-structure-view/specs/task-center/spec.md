## ADDED Requirements

### Requirement: Per-member task summary computation
The `useTeamGraph` composable SHALL compute per-member task counts by aggregating all tasks where the member's ID appears in the task's `subscribe` array.

#### Scenario: Computing task counts for a member
- **WHEN** the composable processes the task list
- **THEN** for each member, it SHALL count tasks grouped by status: running, completed, failed, reviewing, pending
- **AND** only include tasks where the member ID is in `subscribe[]`
- **AND** return the counts as part of the member node data

#### Scenario: Leader's own task counts
- **WHEN** computing task summary for the leader
- **THEN** the composable SHALL count all tasks where `from` (task creator) equals the leader's ID, since the leader creates/dispatches tasks
