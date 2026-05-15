## ADDED Requirements

### Requirement: Model Preset CRUD

Manager SHALL 提供模型预设的创建、读取、更新、删除功能。每个预设 SHALL 包含以下字段：
- `id`: string（自动生成的唯一标识）
- `name`: string（用户自定义名称，唯一）
- `provider`: ProviderType（openai | anthropic | google | deepseek | openai-compatible）
- `model`: string（自由输入，不限制下拉列表）
- `baseURL`: string | undefined（可选，openai-compatible 时必填）
- `apiKey`: string
- `isDefault`: boolean（全局唯一，标记默认预设）

#### Scenario: 创建预设
- **WHEN** 管理员 POST `/api/ai/presets` 并提供 `{ name, provider, model, apiKey, baseURL? }`
- **THEN** 系统 SHALL 生成唯一 `id`，如果这是第一个预设则自动设 `isDefault: true`，否则 `isDefault: false`，返回完整的预设对象

#### Scenario: 创建重名预设
- **WHEN** 管理员 POST 创建预设时 `name` 与已有预设重复
- **THEN** 系统 SHALL 返回 400 错误 `{ error: "Preset name already exists" }`

#### Scenario: 获取预设列表
- **WHEN** 管理员 GET `/api/ai/presets`
- **THEN** 系统 SHALL 返回所有预设列表，apiKey 字段 SHALL 被掩码处理（只保留前 4 位和后 4 位）

#### Scenario: 更新预设
- **WHEN** 管理员 PUT `/api/ai/presets/:id` 并提供部分字段更新
- **THEN** 系统 SHALL 合并更新指定字段，若 apiKey 字段为空字符串则保留原有值

#### Scenario: 删除未被绑定的预设
- **WHEN** 管理员 DELETE `/api/ai/presets/:id` 且该预设未被任何场景配置引用
- **THEN** 系统 SHALL 删除该预设，返回 200

#### Scenario: 删除被绑定的预设
- **WHEN** 管理员 DELETE `/api/ai/presets/:id` 且该预设正被场景配置引用
- **THEN** 系统 SHALL 返回 400 错误 `{ error: "Preset is used by scenes: ...", scenes: [...] }`

### Requirement: Default Preset

系统 SHALL 支持标记一个预设为默认预设（`isDefault: true`）。全局 MUST 只有一个默认预设。

#### Scenario: 设为默认
- **WHEN** 管理员 PUT `/api/ai/presets/:id/default`
- **THEN** 系统 SHALL 将该预设的 `isDefault` 设为 `true`，同时将其他所有预设的 `isDefault` 设为 `false`

#### Scenario: 删除默认预设
- **WHEN** 管理员删除默认预设（且无场景绑定阻止删除）
- **THEN** 系统 SHALL 删除该预设并将剩余预设中第一个的 `isDefault` 设为 `true`（如果还有剩余预设）

### Requirement: OpenAI-Compatible Provider

系统 SHALL 支持 `openai-compatible` provider 类型，用于接入兼容 OpenAI API 的自部署服务（如 Ollama、vLLM）。

#### Scenario: 创建 openai-compatible 预设
- **WHEN** 管理员创建预设时 provider 为 `openai-compatible` 且提供了 `baseURL`
- **THEN** 系统 SHALL 使用 `createOpenAI({ apiKey, baseURL })` 创建模型实例

#### Scenario: openai-compatible 缺少 baseURL
- **WHEN** 管理员创建预设时 provider 为 `openai-compatible` 但未提供 `baseURL`
- **THEN** 系统 SHALL 返回 400 错误 `{ error: "baseURL is required for openai-compatible provider" }`

### Requirement: Legacy Config Migration

系统 SHALL 在首次加载时自动检测并迁移旧格式 AI 配置。

#### Scenario: 旧格式自动迁移
- **WHEN** `~/.envoy/manager.json` 中 `ai` 字段包含 `provider` 但不包含 `presets`
- **THEN** 系统 SHALL 将旧配置转换为一个默认预设（name 取 provider 名），清空旧字段，保留旧配置备份到 `ai_legacy` 字段，并写入磁盘

#### Scenario: 新格式正常加载
- **WHEN** `ai` 字段已包含 `presets` 数组
- **THEN** 系统 SHALL 直接使用新格式，不做迁移

### Requirement: Models Frontend Page

Manager 前端 SHALL 提供独立的 Models 页面（路由 `/models`）用于管理模型预设。

#### Scenario: 预设列表展示
- **WHEN** 管理员访问 `/models` 页面
- **THEN** 页面 SHALL 显示所有预设卡片，每张卡片显示名称、provider、model、掩码 apiKey、默认标记（★）

#### Scenario: 新增预设
- **WHEN** 管理员点击 [+ Add] 按钮
- **THEN** 页面 SHALL 在列表下方内联展开表单（name/provider/model/baseURL/apiKey），保存后刷新列表

#### Scenario: 编辑预设
- **WHEN** 管理员点击预设卡片的 [Edit] 按钮
- **THEN** 页面 SHALL 将该卡片展开为编辑表单，预填现有值，apiKey 显示占位符

#### Scenario: 侧边栏导航
- **WHEN** Manager 侧边栏渲染
- **THEN** SHALL 在 Users 和 Settings 之间显示 Models 导航项，图标使用合适的模型/AI 图标
