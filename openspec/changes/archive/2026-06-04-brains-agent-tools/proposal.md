## Why

Agent 目前只能通过 `read_skill` 读取 `skills/*.md`，无法浏览知识库全貌，也无法访问执行日志。随着知识库内容丰富（词汇表、偏好、基础信息）和日志积累，Agent 缺乏自主查阅历史经验和知识的能力，限制了任务执行质量。

## What Changes

- 新增 `brainsService`（`src/agent/services/brainsService.ts`），提供 4 个操作：
  - `list_brains_files`：列出知识库中所有文件（排除 `raw/日志/` 目录）
  - `read_brains_file`：按路径读取知识库文件内容（排除 `raw/日志/` 路径）
  - `list_logs`：列出所有日志文件（仅 `raw/日志/` 目录下的文件）
  - `read_log`：按路径读取日志文件内容（仅允许 `raw/日志/` 路径）
- 将 4 个工具注册到所有 Agent（planner、executor、reviewer）

## Capabilities

### New Capabilities
- `brains-agent-tools`: Agent 通过 4 个工具访问知识库文件和执行日志，知识库与日志严格隔离

### Modified Capabilities

## Impact

- **新增文件**: `src/agent/services/brainsService.ts`
- **修改文件**: `src/agent/agents/planner.ts`、`executor.ts`、`reviewer.ts`（注册新工具）
- **Rust 层**: 无变更，复用现有 `scan_brains_files` 和 `read_brains_file` Tauri 命令
