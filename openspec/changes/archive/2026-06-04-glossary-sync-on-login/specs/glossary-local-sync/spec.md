## ADDED Requirements

### Requirement: System glossary sync on team join
系统 SHALL 在用户成功加入团队时，调用 `GET /api/glossary?team={teamName}` 获取合并后的词汇数据（全局+团队级），转换为 Markdown 格式，并写入本地文件 `~/.envoy/brains/{username}/glossary/system.md`。

#### Scenario: First team join with glossary entries
- **WHEN** 用户首次加入一个团队，且服务端存在词汇条目
- **THEN** 系统调用 API 获取词汇数据，转换为 Markdown（每个条目为 `## 术语\n定义`），通过 Tauri `file_write` 写入 `~/glossary/system.md`，自动创建 `glossary/` 目录

#### Scenario: Team join with empty glossary
- **WHEN** 用户加入一个团队，但服务端词汇表为空
- **THEN** 系统仍写入 `~/glossary/system.md`，内容仅包含 YAML frontmatter，无词条段落

#### Scenario: API call failure
- **WHEN** 词汇表 API 调用失败（网络错误、服务器异常）
- **THEN** 系统静默跳过同步，不阻塞团队连接流程，不弹出错误提示

### Requirement: Switch team re-sync
系统 SHALL 在用户切换到不同团队时，重新同步 system.md，覆盖旧内容。

#### Scenario: Switch to different team
- **WHEN** 用户从团队 A 切换到团队 B
- **THEN** 系统重新调用 API（team=B），将新数据写入 `~/glossary/system.md`，覆盖团队 A 的内容

### Requirement: Personal glossary file initialization
系统 SHALL 在同步词汇表时，检查 `~/.envoy/brains/{username}/glossary/personal.md` 是否存在。若不存在，创建包含 YAML frontmatter 的空文件。

#### Scenario: First time glossary sync
- **WHEN** 用户首次同步词汇表，`personal.md` 不存在
- **THEN** 系统创建 `~/glossary/personal.md`，内容为 frontmatter（name: 个人词汇表, description: 个人自定义术语定义）

#### Scenario: Subsequent syncs
- **WHEN** 用户再次同步词汇表，`personal.md` 已存在
- **THEN** 系统不修改 `personal.md`，保持原内容不变

### Requirement: Remove query_glossary agent tool
系统 SHALL 移除 `query_glossary` Agent 工具及其在所有 Agent 中的引用。

#### Scenario: Planner agent
- **WHEN** planner agent 创建时
- **THEN** 其工具列表中不包含 `query_glossary`，不再 import `createGlossaryTool`

#### Scenario: Executor agent
- **WHEN** executor agent 创建时
- **THEN** 其工具列表中不包含 `query_glossary`，不再 import `createGlossaryTool`

#### Scenario: Reviewer agent
- **WHEN** reviewer agent 创建时
- **THEN** 其工具列表中不包含 `query_glossary`，不再 import `createGlossaryTool`

#### Scenario: Tools module
- **WHEN** `src/agent/tools.ts` 模块加载时
- **THEN** `createGlossaryTool` 函数及相关的 `GlossaryItem` 接口不存在于该模块中

### Requirement: Markdown file format
词汇表 Markdown 文件 SHALL 使用 YAML frontmatter + Markdown 标题格式的结构化内容。

#### Scenario: system.md format
- **WHEN** 系统写入 `system.md`
- **THEN** 文件格式为：YAML frontmatter（name: 系统词汇表, description: 团队统一术语定义（全局+团队级合并））+ 空行 + 每个条目为 `## {term}\n{definition}\n`

#### Scenario: personal.md format
- **WHEN** 系统创建 `personal.md`
- **THEN** 文件格式为：YAML frontmatter（name: 个人词汇表, description: 个人自定义术语定义）+ 空行（无词条内容）
