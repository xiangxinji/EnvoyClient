## MODIFIED Requirements

### Requirement: AI smart dispatch endpoint
The Manager SHALL provide `POST /api/ai/task/dispatch` that accepts a task description and list of online members with their responsibilities, and returns the matched member IDs, optimized task content, and recommended dispatch mode.

#### Scenario: Single best match
- **WHEN** Leader submits "部署前端到生产环境" and members include `{ id: "alice", responsibilities: "前端开发、CI/CD" }` and `{ id: "bob", responsibilities: "后端、数据库" }`
- **THEN** the API SHALL return `{ subscribe: ["alice"], content: "部署前端到生产环境", mode: "serial" }`

#### Scenario: Multiple matches with serial dependency
- **WHEN** Leader submits "先翻译文档，再由校对人员审核" and members include `{ id: "alice", responsibilities: "翻译" }` and `{ id: "bob", responsibilities: "校对" }`
- **THEN** the API SHALL return `{ subscribe: ["alice", "bob"], content: "先翻译文档，再由校对人员审核", mode: "serial" }` where `subscribe` order reflects execution sequence

#### Scenario: Multiple matches with parallel execution
- **WHEN** Leader submits "让所有人分别调研一个方向并汇总" and members include `{ id: "alice", responsibilities: "前端" }` and `{ id: "bob", responsibilities: "后端" }`
- **THEN** the API SHALL return `{ subscribe: ["alice", "bob"], content: "分别调研一个方向并汇总", mode: "parallel" }`

#### Scenario: No online members match
- **WHEN** no online member's responsibilities match the task
- **THEN** the API SHALL return `{ subscribe: [], content: "...", mode: "serial", warning: "无匹配成员" }`

#### Scenario: No online members
- **WHEN** there are no online members in the team
- **THEN** the API SHALL return an error response indicating no members available

### Requirement: Task dispatch UI flow
The TaskDispatchPanel SHALL display the AI-returned dispatch mode and allow the Leader to modify it before confirming.

#### Scenario: Leader reviews AI dispatch result
- **WHEN** the AI dispatch returns `{ subscribe: ["alice", "bob"], content: "...", mode: "parallel" }`
- **THEN** the preview SHALL display the mode as a selectable dropdown defaulting to "parallel", the matched members, and the optimized content

#### Scenario: Leader changes mode before confirming
- **WHEN** the AI dispatch recommends "parallel" but the Leader selects "serial" from the dropdown
- **THEN** the system SHALL submit with `mode: "serial"` instead

#### Scenario: Leader confirms dispatch
- **WHEN** the Leader clicks confirm
- **THEN** the system SHALL call `POST /api/tasks` with `{ content, subscribe, mode }` using the user-selected mode

#### Scenario: Leader cancels dispatch
- **WHEN** the Leader clicks cancel
- **THEN** no task SHALL be submitted and the input SHALL be preserved
