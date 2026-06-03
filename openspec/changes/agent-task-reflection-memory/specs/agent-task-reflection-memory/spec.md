## ADDED Requirements

### Requirement: Post-task reflection generation
The system SHALL generate a structured reflection after an AI Agent task execution completes when task reflection memory is enabled for the current member.

#### Scenario: Successful task reflection
- **WHEN** an AI Agent task completes successfully and reflection memory is enabled
- **THEN** the system SHALL generate a reflection using the task content, pipeline plan, execution summary, review summary, attempt count, success state, and execution trace summary

#### Scenario: Failed task reflection
- **WHEN** an AI Agent task fails and reflection memory is enabled
- **THEN** the system SHALL generate a reflection marked as failed and SHALL separate mistakes or risks from reusable lessons

#### Scenario: Reflection disabled
- **WHEN** an AI Agent task completes and reflection memory is disabled
- **THEN** the system SHALL NOT generate or write a task reflection file

### Requirement: Daily execution log persistence
The system SHALL persist generated task reflection entries in a daily markdown execution log in the current user's brains under `raw/日志/执行日志/`.

#### Scenario: Daily log file written
- **WHEN** a reflection is generated for task `task-123`
- **THEN** the system SHALL write or update `~/.envoy/brains/{username}/raw/日志/执行日志/YYYY-MM-DD.md`

#### Scenario: Same-day entries merged
- **WHEN** multiple reflections are generated on the same local day
- **THEN** the system SHALL append each task entry to the same daily execution log file

#### Scenario: Reflection write failure
- **WHEN** reflection file writing fails
- **THEN** the system SHALL keep the task resolution behavior unchanged and surface the reflection failure separately from the task result

### Requirement: Concise fixed execution log structure
Each daily execution log file SHALL start with `# 执行日志`. Each task entry SHALL use a fixed concise structure containing a generated task title, task description, execution process, task result, and execution reflection.

#### Scenario: Required sections present
- **WHEN** a task entry is written
- **THEN** the entry SHALL contain `## 任务标题：`, `### 任务描述`, `### 执行过程`, `### 任务结果`, and `### 执行复盘`

#### Scenario: Failed outcome marked
- **WHEN** the original task result is unsuccessful
- **THEN** the task result or execution reflection section SHALL clearly mark the task as failed

#### Scenario: Full trace omitted
- **WHEN** a task entry is written
- **THEN** the entry SHALL summarize execution and SHALL NOT include the full raw execution trace or full tool output

### Requirement: Generated task title
The system SHALL generate a concise task title for each execution log entry from task content, execution summary, and review output.

#### Scenario: Title generated
- **WHEN** a task entry is written
- **THEN** the entry heading SHALL be `## 任务标题：<generated title>`

#### Scenario: Title sanitized
- **WHEN** source content contains obvious secrets or long paths
- **THEN** the generated title SHALL omit or redact those details

### Requirement: Log evaluator agent
The system SHALL use a dedicated log evaluator agent when available to transform noisy task execution outputs into a concise execution log entry draft.

#### Scenario: Evaluator produces clean draft
- **WHEN** planner, executor, or reviewer output contains markdown headings, JSON payloads, or verbose trace details
- **THEN** the evaluator SHALL produce clean title, description, process, result, and review fields without embedding raw markdown headings or raw JSON

#### Scenario: Evaluator unavailable
- **WHEN** the log evaluator fails, times out, or returns malformed output
- **THEN** the system SHALL fall back to deterministic cleanup and still attempt to write a concise daily log entry

### Requirement: Skill mutation guardrail
The system SHALL NOT automatically modify files under `~/.envoy/brains/{username}/skills/` as part of post-task reflection.

#### Scenario: Reflection identifies a skill candidate
- **WHEN** a reflection includes a reusable lesson that may deserve promotion to a skill
- **THEN** the system SHALL record the candidate in the reflection file and SHALL NOT write to `skills/`

### Requirement: Reflection memory setting
The system SHALL provide a per-member setting that controls whether automatic task reflection memory is enabled.

#### Scenario: Setting disabled
- **WHEN** the member setting for reflection memory is disabled
- **THEN** automatic task reflection SHALL be skipped for that member

#### Scenario: Setting enabled
- **WHEN** the member setting for reflection memory is enabled
- **THEN** completed AI Agent tasks for that member SHALL trigger reflection generation

### Requirement: Reflection sanitization
The system SHALL sanitize and limit reflection content before writing it to brains.

#### Scenario: Sensitive fields omitted
- **WHEN** trace or output content contains obvious secrets such as tokens, passwords, private keys, or API keys
- **THEN** the reflection SHALL omit or redact those values before writing the file

#### Scenario: Large outputs summarized
- **WHEN** trace or tool output is too large for a concise reflection
- **THEN** the reflection SHALL summarize the output instead of writing the full raw content

### Requirement: Brains sync compatibility
Task reflection memory SHALL use the existing local brains directory so existing brains sync can upload reflection files when sync-after-task is enabled.

#### Scenario: Sync after reflected task
- **WHEN** a reflection file is written and the user's brains sync-after-task setting is enabled
- **THEN** the existing brains sync flow SHALL be able to detect and sync the new reflection file
