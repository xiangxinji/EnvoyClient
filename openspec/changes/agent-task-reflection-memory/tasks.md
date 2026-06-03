## 1. Brains Template And Settings

- [x] 1.1 Add `src-tauri/brains/raw/日志/执行日志/.gitkeep` so new brains directories include an execution log folder.
- [x] 1.2 Add a per-member `task_reflection_memory_enabled` setting with a safe default.
- [x] 1.3 Expose the reflection memory setting through `useMemberSettings`.
- [x] 1.4 Add settings UI and i18n text for enabling/disabling automatic task reflection memory.

## 2. Reflection Generation

- [x] 2.1 Define a reflection input type containing task id, task content, success state, pipeline outputs, attempts, and trace data.
- [x] 2.2 Implement a reflection formatter or reflection agent that produces the required markdown sections.
- [x] 2.3 Add sanitization for obvious secrets and large trace/tool outputs before writing reflection content.
- [x] 2.4 Ensure failed tasks are clearly marked and separate mistakes or risks from reusable lessons.

## 3. Reflection Persistence

- [x] 3.1 Implement a helper that builds deterministic daily execution log filenames.
- [x] 3.2 Write reflection entries to `~/.envoy/brains/{username}/raw/日志/执行日志/YYYY-MM-DD.md`.
- [x] 3.3 Ensure same-day entries are appended without dropping existing log content.
- [x] 3.4 Surface reflection write failures without changing the task success/failure result.

## 4. Task Execution Integration

- [x] 4.1 Invoke reflection generation after the planner/executor/reviewer pipeline completes in AI task execution.
- [x] 4.2 Skip reflection when `task_reflection_memory_enabled` is disabled.
- [x] 4.3 Keep task resolution and ClientTask queue progress working if reflection generation or writing fails.
- [x] 4.4 Verify the existing brains sync-after-task flow detects new reflection files.

## 5. Tests And Verification

- [x] 5.1 Add unit coverage for reflection markdown generation, failed-task marking, and sanitization.
- [x] 5.2 Add coverage for reflection filename generation and append-only write behavior.
- [x] 5.3 Add integration or composable-level coverage for enabled and disabled reflection settings.
- [x] 5.4 Run the relevant frontend, Tauri, or unit test commands and fix regressions.

## 6. Daily Execution Log Refinement

- [x] 6.1 Update OpenSpec to use one daily execution log file instead of one reflection file per task.
- [x] 6.2 Change reflection output to the fixed `# 执行日志` / `## 任务标题` structure.
- [x] 6.3 Generate concise task titles from task content and pipeline summaries.
- [x] 6.4 Append same-day task entries to the existing daily log file.
- [x] 6.5 Update tests and run validation/build.

## 7. Log Evaluator Agent

- [x] 7.1 Update OpenSpec to require a dedicated log evaluator agent.
- [ ] 7.2 Implement the log evaluator agent and structured draft parser.
- [ ] 7.3 Use evaluator output when building daily execution log entries.
- [ ] 7.4 Harden fallback cleanup so markdown headings and raw JSON do not leak into log fields.
- [ ] 7.5 Update tests and run validation/build.
