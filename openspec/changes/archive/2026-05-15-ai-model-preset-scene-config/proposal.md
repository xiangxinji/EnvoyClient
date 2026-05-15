## Why

当前 Manager 的 AI 配置只有一个全局模型（provider + apiKey + model + temperature + maxTokens），6 个 AI 功能（chat、task、analyze、agent、dispatch、review）全部共享同一份配置。这导致无法为不同场景选择不同模型（例如 Agent 推理用强模型、Dispatch/Review 用便宜模型），也无法接入自部署模型服务（Ollama、vLLM、企业代理）。随着 AI 功能增多，单一配置已成为明显的瓶颈。

## What Changes

- **BREAKING**: 将 `AISettings` 从单一全局配置重构为 `presets[]` + `scenes{}` 两层结构
- 新增「模型预设」概念：每个预设包含 provider、model、baseURL（可选）、apiKey、isDefault 标记
- 新增「场景配置」概念：6 个 AI 场景各自引用一个预设 ID，并独立配置 temperature、maxTokens
- 新增 `openai-compatible` provider 类型，支持自定义 base URL（Ollama、vLLM 等兼容端点）
- 新增 Manager 前端 **Models 页面**，支持预设的增删改查，标记默认预设（★）
- 重构 Manager 前端 **Settings 页面** AI 配置区，改为场景-预设映射表格
- 后端运行时按场景解析预设，未配置场景回退默认预设，无预设则返回 503
- 删除预设时检查场景绑定，有绑定则拒绝删除并提示
- 自动迁移旧格式配置（首次加载时检测并转换）

## Capabilities

### New Capabilities
- `model-preset-management`: 模型预设的 CRUD 管理，包括 provider 类型、自定义 base URL、默认预设标记、删除保护
- `scene-model-mapping`: 6 个 AI 场景（chat/task/analyze/agent/dispatch/review）与模型预设的映射配置，含独立参数（temperature、maxTokens）和默认回退逻辑

### Modified Capabilities
- `manager-agent-endpoint`: Agent 推理端点的模型解析逻辑从单一全局配置改为按场景查找预设

## Impact

- **共享类型**: `shared/types/ai.ts` — AIConfig、ProviderType 类型重构
- **后端存储**: `manager/server/settings.ts` — AISettings 结构变更 + 旧格式迁移
- **后端 Provider**: `manager/server/services/ai/provider.ts` — resolveModel 改为从 preset 解析，支持 baseURL
- **后端路由**: `manager/server/routes/ai.ts` — 新增 preset CRUD 路由，更新 config 路由
- **后端服务**: 所有 AI handler（chat/task/analyze/agent/dispatch/review）的模型解析逻辑
- **后端常量**: `manager/server/services/ai/constants.ts` — 新增 openai-compatible provider
- **前端新页面**: `manager/web/src/views/Models.vue` — 模型预设管理页面
- **前端重构**: `manager/web/src/views/Settings.vue` — AI 配置区改为场景映射
- **前端路由**: `manager/web/src/router.ts` — 新增 /models 路由
- **前端组件**: Manager 侧边栏新增 Models 导航项
