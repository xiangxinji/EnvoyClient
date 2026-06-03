## Why

Agent tasks already produce execution plans, summaries, review output, and trace data, but those signals are only attached to the task result. Useful lessons from successful or failed executions are not preserved in the user's brains, so the Agent cannot build durable project-specific memory from its own work.

This change adds a controlled post-task reflection step that records reusable execution knowledge into the user's local brains without automatically mutating high-impact skill files.

## What Changes

- Add a post-task reflection stage after Agent task execution and review complete.
- Generate a structured task reflection from task content, pipeline outputs, review output, and execution trace.
- Persist reflections as append-only markdown files under the current user's brains log area.
- Add safeguards so reflections are memory candidates, not automatically promoted into `skills/`.
- Add a user setting to enable or disable automatic task reflection memory.
- Include failed task reflections with explicit failure markers so failed reasoning is not mistaken for successful guidance.
- Reuse the existing brains sync flow so reflected memories can be synced after task completion when the user has enabled sync.

## Capabilities

### New Capabilities
- `agent-task-reflection-memory`: Captures structured post-task reflections into user brains and controls how task execution lessons become durable memory.

### Modified Capabilities

None.

## Impact

- Affected frontend code:
  - `src/composables/useTaskCenterExecution.ts`
  - `src/agent/pipelines/taskPipeline.ts`
  - `src/agent/agents/*` or a new reflection agent module
  - `src/composables/useMemberSettings.ts`
  - settings UI and i18n entries for the reflection-memory toggle
- Affected Tauri/file behavior:
  - Reuses existing `file_write` support for `~/.envoy/brains/{username}/...`
  - May add template directories under `src-tauri/brains/raw/`
- Affected data:
  - New markdown reflection files under `~/.envoy/brains/{username}/raw/日志/任务复盘/`
- No new backend API is required for the initial implementation.
