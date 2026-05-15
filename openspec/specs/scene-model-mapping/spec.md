## ADDED Requirements

### Requirement: Scene Configuration Storage

系统 SHALL 支持 6 个 AI 场景与模型预设的映射配置。每个场景配置包含：
- `presetId`: string | null（引用预设 ID，null 表示使用默认预设）
- `temperature`: number
- `maxTokens`: number

场景类型 SHALL 包括：`chat`、`task`、`analyze`、`agent`、`dispatch`、`review`。

#### Scenario: 读取场景配置
- **WHEN** 管理员 GET `/api/ai/scenes`
- **THEN** 系统 SHALL 返回所有已配置的场景列表，每项包含场景类型、预设名称（非 ID）、temperature、maxTokens

#### Scenario: 更新场景配置
- **WHEN** 管理员 PUT `/api/ai/scenes` 并提供 `{ scenes: { [sceneType]: { presetId?, temperature, maxTokens } } }`
- **THEN** 系统 SHALL 合并更新指定场景的配置，未提供的场景保持不变

#### Scenario: 场景配置引用不存在的预设
- **WHEN** 管理员提交场景配置时 `presetId` 引用的预设不存在
- **THEN** 系统 SHALL 返回 400 错误 `{ error: "Preset not found: <id>" }`

### Requirement: Scene Runtime Resolution

运行时各 AI handler SHALL 按场景类型解析模型配置。

#### Scenario: 场景有明确绑定
- **WHEN** AI handler 处理 `chat` 场景且 `scenes.chat.presetId` 有值
- **THEN** 系统 SHALL 使用该 presetId 对应的预设连接信息 + 该场景的 temperature/maxTokens 组装模型调用

#### Scenario: 场景未配置
- **WHEN** AI handler 处理某个场景但 `scenes` 中无该场景的配置
- **THEN** 系统 SHALL 回退到默认预设（`isDefault: true`）+ 默认参数（temperature: 0.7, maxTokens: 4096）

#### Scenario: 场景绑定 presetId 为 null
- **WHEN** 场景配置存在但 `presetId` 为 null
- **THEN** 系统 SHALL 等同于未配置，回退到默认预设

#### Scenario: 无任何预设
- **WHEN** 系统中无任何模型预设
- **THEN** 所有 AI 端点 SHALL 返回 503 `{ error: "AI not configured" }`

#### Scenario: 引用的预设被删除（引用断裂）
- **WHEN** 场景绑定的 presetId 在预设列表中不存在
- **THEN** 系统 SHALL 回退到默认预设，不抛出错误

### Requirement: Settings Scene Configuration UI

Settings 页面 SHALL 包含 AI Scene Configuration 区域，展示 6 个场景的映射表格。

#### Scenario: 场景表格展示
- **WHEN** 管理员访问 Settings 页面的 AI 配置区
- **THEN** 页面 SHALL 显示 6 行场景配置，每行包含：场景名称（中文描述）、预设下拉选择、temperature 输入、maxTokens 输入

#### Scenario: 预设下拉选项
- **WHEN** 场景配置的预设下拉展开
- **THEN** 第一项 SHALL 为 "Default (使用默认预设)"，后续为所有预设的 name 列表

#### Scenario: 无预设时的引导
- **WHEN** 系统中无任何模型预设
- **THEN** Settings 页面 AI 配置区 SHALL 显示提示文案 "请先在 Models 页面添加模型预设" 并提供跳转链接

#### Scenario: 默认预设提示
- **WHEN** 存在默认预设
- **THEN** 场景表格上方 SHALL 显示当前默认预设名称："未配置的场景将使用默认模型预设 (★ {name})"

#### Scenario: 保存场景配置
- **WHEN** 管理员修改场景配置后点击 Save
- **THEN** 页面 SHALL 调用 PUT `/api/ai/scenes` 提交变更，显示保存成功提示
