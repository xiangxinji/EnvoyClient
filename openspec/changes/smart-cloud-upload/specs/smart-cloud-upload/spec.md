## ADDED Requirements

### Requirement: Smart upload endpoint
系统 SHALL 提供 `POST /api/cloud/smart-upload` 端点，接收 FormData 格式请求，包含 `file`（文件内容）、`filename`（文件名）、`description`（文件内容描述）、`uploadedBy`（上传者 ID）和可选的 `taskContext`（任务上下文）。端点 SHALL 通过 AI 推理确定文件的目标目录路径，自动创建不存在的目录，然后将文件保存到目标目录。

#### Scenario: Upload to existing directory
- **WHEN** 云盘已有目录结构 `调研/市场分析/`，AI 收到 description="Q1市场趋势分析报告"
- **THEN** 系统 SHALL 将文件保存到 `调研/市场分析/` 目录下，返回 `{ ok: true, path: "调研/市场分析/{filename}", itemId }`，不创建新目录

#### Scenario: Upload with new directory creation
- **WHEN** 云盘根目录下有 `项目文档/` 但没有子目录，AI 收到 description="项目设计稿"
- **THEN** 系统 SHALL 在 `项目文档/` 下创建新子目录（如 `设计/`），将文件保存到新目录，返回 `{ ok: true, path: "项目文档/设计/{filename}", itemId, createdDirs: ["设计"] }`

#### Scenario: Upload to root when no suitable directory
- **WHEN** 云盘目录为空或 AI 判断文件不适合放入任何现有目录
- **THEN** 系统 SHALL 在根目录创建合适的顶层目录，将文件保存其中

#### Scenario: Missing required fields
- **WHEN** 请求缺少 `file`、`filename` 或 `description` 字段
- **THEN** 系统 SHALL 返回 400 错误并说明缺失字段

#### Scenario: AI not configured
- **WHEN** `cloud_organize` 场景未配置模型且没有默认 preset
- **THEN** 系统 SHALL 返回 503 错误 `{ error: "AI not configured" }`

### Requirement: Cloud organize AI scene
系统 SHALL 新增 `cloud_organize` 场景类型。该场景使用 `generateObject` + Zod schema，接收目录树结构、文件名、文件描述和可选的任务上下文作为输入，输出 `{ reasoning: string, directoryPath: string[] }` 结构化结果。

#### Scenario: AI receives directory tree
- **WHEN** 调用 `cloud_organize` 场景进行推理
- **THEN** AI SHALL 只接收目录结构（type=directory 的记录，不含文件），格式为缩进的树形文本

#### Scenario: AI reuses existing directory
- **WHEN** 现有目录中存在匹配文件描述的目录
- **THEN** AI SHALL 优先复用现有目录路径，`directoryPath` SHALL 指向现有目录

#### Scenario: AI proposes new subdirectory
- **WHEN** 现有目录没有完全匹配的分类
- **THEN** AI SHALL 在现有目录下创建子目录，`directoryPath` 包含从根到目标的完整路径

#### Scenario: Directory depth limit
- **WHEN** AI 推理目录路径
- **THEN** `directoryPath` SHALL 不超过 3 层深度

### Requirement: Directory tree query function
系统 SHALL 在 `db.ts` 中新增 `getCloudDirectoryTree(teamName)` 函数，递归查询所有 `type='directory'` 的记录，返回树形结构供 AI 推理使用。

#### Scenario: Empty cloud
- **WHEN** 云盘中没有任何目录
- **THEN** 函数 SHALL 返回空树

#### Scenario: Nested directories
- **WHEN** 云盘存在多层嵌套目录
- **THEN** 函数 SHALL 返回包含完整层级关系的树形结构，只包含目录不包含文件

### Requirement: Smart upload agent tool
系统 SHALL 在 `cloudService` 中新增 `smart_upload` operation，Agent 调用时发送 `POST /api/cloud/smart-upload` 请求，参数为 `{ filename, content, description }`。

#### Scenario: Agent uses smart upload
- **WHEN** Agent 执行任务过程中需要上传文件到云资源
- **THEN** Agent SHALL 优先使用 `smart_upload` 工具，提供 filename、content 和 description

#### Scenario: Smart upload fallback
- **WHEN** `smart_upload` 返回 503 错误（AI 未配置）
- **THEN** Agent SHALL fallback 使用 `cloud_upload` 上传到根目录

### Requirement: Executor instructions update
系统 SHALL 更新 Executor Agent 的 instructions，引导 Agent 在上传文件到云资源时优先使用 `smart_upload` 工具，并为每个文件提供简短的内容描述。

#### Scenario: Executor prompt includes smart upload guidance
- **WHEN** Executor Agent 初始化
- **THEN** instructions 中 SHALL 包含关于 `smart_upload` 的使用引导，说明上传文件时应提供 description
