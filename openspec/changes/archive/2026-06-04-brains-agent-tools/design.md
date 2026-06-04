## Context

Agent 已有 `fileService`（workspace 沙箱内文件读写）、`resourceService`（任务资源 + skill 读取）、`cloudService`（云资源操作）。知识库（`~/.envoy/brains/{user}/`）包含技能、词汇表、偏好、日志等内容，但 Agent 只能通过 `read_skill` 读 `skills/*.md`，无法浏览或读取其他文件。

Tauri 层已有 `scan_brains_files`（递归列出所有文件）和 `read_brains_file`（按路径读取，返回 base64）两个命令，均未暴露给 Agent。

## Goals / Non-Goals

**Goals:**
- Agent 可列出知识库文件（排除日志）并按路径读取
- Agent 可列出日志文件并按路径读取
- 知识库与日志严格隔离，工具间不可交叉访问
- 所有 3 个 Agent（planner、executor、reviewer）均获得这 4 个工具
- 明文返回文件内容（在 service 层解码 base64）

**Non-Goals:**
- 不修改 Rust 层（复用现有 Tauri 命令）
- 不支持写入知识库文件（只读）
- 不支持分页或增量扫描（知识库文件数量有限）

## Decisions

### 1. 新增 brainsService vs 扩展 resourceService

**选择**：新增 `brainsService`

**理由**：brains 操作与任务资源（resourceService）职责不同。brainsService 封装知识库访问（列出+读取），resourceService 封装任务资源上传/查询。职责清晰，不混淆。

### 2. 路径隔离策略

**选择**：在 service 层用路径前缀过滤实现隔离

- `list_brains_files`：过滤掉 `raw/日志/` 开头的路径
- `read_brains_file`：拒绝 `raw/日志/` 开头的路径
- `list_logs`：仅保留 `raw/日志/` 开头的路径
- `read_log`：仅允许 `raw/日志/` 开头的路径

**理由**：`scan_brains_files` 返回所有文件的相对路径，JS 层过滤简单可靠。不需要新增 Tauri 命令。

### 3. Base64 解码

**选择**：在 service 层将 base64 解码为明文字符串再返回给 Agent

**理由**：LLM 无法有效处理 base64 编码内容。使用 `atob()` + `TextDecoder` 解码为 UTF-8 字符串。

### 4. Service 注册方式

**选择**：使用 `defineService` 模式，与 `fileService`、`resourceService` 一致，通过 `toTools()` 转换为 AgentTool

**理由**：与现有架构模式一致，无需额外基础设施。

## Risks / Trade-offs

- [大文件内容占用 Agent context] → 知识库文件通常较小（几 KB），但读取时不做截断。可在工具描述中提示 Agent 谨慎读取大文件。
- [路径遍历攻击] → Tauri 层已有路径沙箱验证（`read_brains_file` 内含 `..` 检查和 canonical path 验证），service 层额外做前缀过滤作为第二道防线。
