## ADDED Requirements

### Requirement: AI smart dispatch endpoint
The Manager SHALL provide `POST /api/ai/task/dispatch` that accepts a task description and list of online members with their responsibilities, and returns the matched member IDs and task content.

#### Scenario: Single best match
- **WHEN** Leader submits "部署前端到生产环境" and members include `{ id: "alice", responsibilities: "前端开发、CI/CD" }` and `{ id: "bob", responsibilities: "后端、数据库" }`
- **THEN** the API SHALL return `{ subscribe: ["alice"], content: "部署前端到生产环境" }`

#### Scenario: Multiple matches
- **WHEN** the task requires skills that match multiple members
- **THEN** the API SHALL return all matching member IDs in `subscribe`

#### Scenario: No online members match
- **WHEN** no online member's responsibilities match the task
- **THEN** the API SHALL return `{ subscribe: [], content: "...", warning: "无匹配成员" }`

#### Scenario: No online members
- **WHEN** there are no online members in the team
- **THEN** the API SHALL return an error response indicating no members available

### Requirement: Task dispatch UI flow
The ChatPanel task input SHALL NOT require a selected peer. The Leader inputs a description, the system calls the AI dispatch endpoint, displays a preview of matched members, and submits after confirmation.

#### Scenario: Leader dispatches a task
- **WHEN** Leader clicks "分派任务" and enters a description and clicks submit
- **THEN** the system SHALL call `/api/ai/task/dispatch`, show the matched members in a preview, and wait for confirmation before submitting

#### Scenario: Leader confirms dispatch
- **WHEN** the AI preview shows matched members and Leader clicks confirm
- **THEN** the system SHALL call `Leader.submit({ content, subscribe, mode: "serial" })` with the AI-returned values

#### Scenario: Leader cancels dispatch
- **WHEN** the AI preview is shown and Leader clicks cancel
- **THEN** no task SHALL be submitted and the input SHALL be preserved
