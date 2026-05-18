## MODIFIED Requirements

### Requirement: Model Preset CRUD

Manager SHALL 提供模型预设的创建、读取、更新、删除功能。每个预设 SHALL 包含以下字段：
- `id`: string（自动生成的唯一标识）
- `name`: string（用户自定义名称，唯一）
- `provider`: ProviderType（openai | anthropic | google | deepseek | openai-compatible）
- `model`: string（自由输入，不限制下拉列表）
- `baseURL`: string | undefined（可选，openai-compatible 时必填）
- `apiKey`: string
- `isDefault`: boolean（全局唯一，标记默认预设）

所有预设数据 SHALL 存储在 `~/.envoy/manager/db/manager.db` 的 `ai_presets` 表中，不再使用 `manager.json` 文件。

#### Scenario: 创建预设
- **WHEN** 管理员 POST `/api/ai/presets` 并提供 `{ name, provider, model, apiKey, baseURL? }`
- **THEN** 系统 SHALL 生成唯一 `id`，如果这是第一个预设则自动设 `isDefault: true`，否则 `isDefault: false`，INSERT 到 ai_presets 表，返回完整的预设对象

#### Scenario: 创建重名预设
- **WHEN** 管理员 POST 创建预设时 `name` 与已有预设重复
- **THEN** 系统 SHALL 返回 400 错误 `{ error: "Preset name already exists" }`

#### Scenario: 获取预设列表
- **WHEN** 管理员 GET `/api/ai/presets`
- **THEN** 系统 SHALL 从 ai_presets 表查询所有记录，apiKey 字段 SHALL 被掩码处理（只保留前 4 位和后 4 位）

#### Scenario: 更新预设
- **WHEN** 管理员 PUT `/api/ai/presets/:id` 并提供部分字段更新
- **THEN** 系统 SHALL UPDATE ai_presets 表指定字段，若 apiKey 字段为空字符串则保留原有值

#### Scenario: 删除未被绑定的预设
- **WHEN** 管理员 DELETE `/api/ai/presets/:id` 且 ai_scenes 表中无引用该 preset_id 的记录
- **THEN** 系统 SHALL DELETE 该预设，返回 200

#### Scenario: 删除被绑定的预设
- **WHEN** 管理员 DELETE `/api/ai/presets/:id` 且 ai_scenes 表中存在引用该 preset_id 的记录
- **THEN** 系统 SHALL 返回 400 错误 `{ error: "Preset is used by scenes: ...", scenes: [...] }`

### Requirement: Default Preset

系统 SHALL 支持标记一个预设为默认预设（`isDefault: true`）。全局 MUST 只有一个默认预设。默认预设状态 SHALL 通过 ai_presets 表的 `is_default` 列管理。

#### Scenario: 设为默认
- **WHEN** 管理员 PUT `/api/ai/presets/:id/default`
- **THEN** 系统 SHALL 在单个事务中：UPDATE 所有 ai_presets 的 is_default 为 0，再将指定预设 is_default UPDATE 为 1

#### Scenario: 删除默认预设
- **WHEN** 管理员删除默认预设（且无场景绑定阻止删除）
- **THEN** 系统 SHALL DELETE 该预设，并将剩余预设中第一个的 is_default UPDATE 为 1（如果还有剩余预设）

### Requirement: Legacy Config Migration

~~系统 SHALL 在首次加载时自动检测并迁移旧格式 AI 配置。~~ 此需求已移除，因为存储已切换到 SQLite 数据库，不再读取 `manager.json` 文件。

## REMOVED Requirements

### Requirement: Legacy Config Migration
**Reason**: 存储后端从 JSON 文件切换到 SQLite，不再存在旧格式 JSON 需要迁移的场景。
**Migration**: 用户需在 Manager UI 中重新配置 AI 预设。
