## MODIFIED Requirements

### Requirement: Scene Configuration Storage

系统 SHALL 支持 7 个 AI 场景与模型预设的映射配置。每个场景配置包含：
- `presetId`: string | null（引用预设 ID，null 表示使用默认预设）
- `temperature`: number
- `maxTokens`: number

场景类型 SHALL 包括：`chat`、`task`、`analyze`、`agent`、`dispatch`、`review`、`auto-reply`。

#### Scenario: 读取场景配置
- **WHEN** 管理员 GET `/api/ai/scenes`
- **THEN** 系统 SHALL 返回所有已配置的场景列表（包含 7 个场景），每项包含场景类型、预设名称（非 ID）、temperature、maxTokens

#### Scenario: 更新场景配置
- **WHEN** 管理员 PUT `/api/ai/scenes` 并提供 `{ scenes: { [sceneType]: { presetId?, temperature, maxTokens } } }`
- **THEN** 系统 SHALL 合并更新指定场景的配置，未提供的场景保持不变

#### Scenario: 场景配置引用不存在的预设
- **WHEN** 管理员提交场景配置时 `presetId` 引用的预设不存在
- **THEN** 系统 SHALL 返回 400 错误 `{ error: "Preset not found: <id>" }`

### Requirement: Settings Scene Configuration UI

Settings 页面 SHALL 包含 AI Scene Configuration 区域，展示 7 个场景的映射表格。

#### Scenario: 场景表格展示
- **WHEN** 管理员访问 Settings 页面的 AI 配置区
- **THEN** 页面 SHALL 显示 7 行场景配置，每行包含：场景名称（中文描述）、预设下拉选择、temperature 输入、maxTokens 输入。新增 `auto-reply` 场景行，中文描述为"自动回复"
