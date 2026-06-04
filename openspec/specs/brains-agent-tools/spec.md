## ADDED Requirements

### Requirement: List knowledge base files
Agent SHALL 能列出知识库目录中所有文件，排除日志目录（`raw/日志/`）下的文件。

#### Scenario: Knowledge base has mixed content
- **WHEN** 知识库包含 skills/、glossary/、raw/ 等目录下的文件，以及 raw/日志/ 下的日志文件
- **THEN** 工具返回所有文件列表，但不包含 `raw/日志/` 开头的路径

#### Scenario: Empty knowledge base
- **WHEN** 知识库为空或 scan 失败
- **THEN** 工具返回空列表

### Requirement: Read knowledge base file by path
Agent SHALL 能按相对路径读取知识库中的文件内容，返回明文 UTF-8 字符串，但不允许读取日志目录下的文件。

#### Scenario: Read a valid knowledge base file
- **WHEN** Agent 请求路径 `skills/my-skill.md`
- **THEN** 工具返回该文件的明文内容

#### Scenario: Attempt to read a log file
- **WHEN** Agent 请求路径 `raw/日志/执行日志/2026-06-04.md`
- **THEN** 工具拒绝并返回错误提示，告知使用 `read_log` 工具

#### Scenario: Attempt to read non-existent file
- **WHEN** Agent 请求路径 `nonexistent.md`
- **THEN** 工具返回文件不存在的错误信息

### Requirement: List log files
Agent SHALL 能列出知识库中所有日志文件（仅 `raw/日志/` 目录下的文件）。

#### Scenario: Logs exist across multiple dates
- **WHEN** 日志目录包含 `raw/日志/执行日志/2026-06-03.md` 和 `raw/日志/执行日志/2026-06-04.md`
- **THEN** 工具返回这两个文件的路径和元信息

#### Scenario: No logs exist
- **WHEN** 日志目录为空
- **THEN** 工具返回空列表

### Requirement: Read log file by path
Agent SHALL 能按路径读取日志文件内容，返回明文 UTF-8 字符串，仅允许 `raw/日志/` 路径前缀。

#### Scenario: Read a valid log file
- **WHEN** Agent 请求路径 `raw/日志/执行日志/2026-06-04.md`
- **THEN** 工具返回该日志文件的明文内容

#### Scenario: Attempt to read non-log file
- **WHEN** Agent 请求路径 `skills/my-skill.md`
- **THEN** 工具拒绝并返回错误提示，告知使用 `read_brains_file` 工具

### Requirement: All agents receive all four tools
Planner、Executor、Reviewer 三个 Agent SHALL 都注册 `list_brains_files`、`read_brains_file`、`list_logs`、`read_log` 四个工具。

#### Scenario: Planner agent tools
- **WHEN** planner agent 创建时
- **THEN** 其工具列表包含 list_brains_files、read_brains_file、list_logs、read_log

#### Scenario: Executor agent tools
- **WHEN** executor agent 创建时
- **THEN** 其工具列表包含 list_brains_files、read_brains_file、list_logs、read_log

#### Scenario: Reviewer agent tools
- **WHEN** reviewer agent 创建时
- **THEN** 其工具列表包含 list_brains_files、read_brains_file、list_logs、read_log
