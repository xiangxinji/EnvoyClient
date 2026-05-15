## 1. Shared Types

- [x] 1.1 在 `shared/types/ai.ts` 中新增 `ModelPreset` 接口（id, name, provider, model, baseURL?, apiKey, isDefault）
- [x] 1.2 在 `shared/types/ai.ts` 中新增 `SceneType` 联合类型（chat/task/analyze/agent/dispatch/review）
- [x] 1.3 在 `shared/types/ai.ts` 中新增 `SceneConfig` 接口（presetId: string | null, temperature, maxTokens）
- [x] 1.4 在 `shared/types/ai.ts` 中扩展 `ProviderType` 添加 `"openai-compatible"`
- [x] 1.5 在 `shared/types/ai.ts` 中更新 `AIConfig` 为新结构（presets + scenes），保留 `AIConfigPublic` 适配

## 2. Backend Storage & Migration

- [x] 2.1 重构 `manager/server/settings.ts` 的 `AISettings` 接口为 `{ presets: ModelPreset[], scenes: Partial<Record<SceneType, SceneConfig>> }`，移除旧字段
- [x] 2.2 在 `loadSettings()` 中添加旧格式迁移逻辑：检测 `ai.provider` 存在且 `ai.presets` 不存在时，转换为单预设 + 空 scenes，备份到 `ai_legacy`
- [x] 2.3 新增 `getPreset(id)` / `getDefaultPreset()` / `createPreset()` / `updatePreset()` / `deletePreset()` / `setDefaultPreset()` 函数
- [x] 2.4 新增 `getScenes()` / `updateScenes()` 函数
- [x] 2.5 新增 `resolveForScene(sceneType)` 函数：查找场景配置 → 查找预设 → 组合返回 model + options，处理 null presetId 和引用断裂回退

## 3. Backend Provider & Constants

- [x] 3.1 更新 `manager/server/services/ai/provider.ts` 的 `resolveModel` 支持 `openai-compatible`（使用 baseURL）和 baseURL 覆盖（其他 provider 可选传 baseURL）
- [x] 3.2 更新 `manager/server/services/ai/constants.ts`：新增 `openai-compatible` 到 PROVIDERS（models 为空数组，提示自由输入），移除其他 provider 的硬编码模型列表

## 4. Backend Routes

- [x] 4.1 在 `manager/server/routes/ai.ts` 中新增 Preset CRUD 路由：GET /api/ai/presets、POST /api/ai/presets、PUT /api/ai/presets/:id、DELETE /api/ai/presets/:id、PUT /api/ai/presets/:id/default
- [x] 4.2 在 `manager/server/routes/ai.ts` 中新增 Scene 路由：GET /api/ai/scenes、PUT /api/ai/scenes
- [x] 4.3 更新 DELETE 预设路由实现删除保护：遍历 scenes 检查引用，有绑定返回 400 + 场景名列表
- [x] 4.4 更新 GET /api/ai/config 适配新结构（返回 presets 列表和 scenes）
- [x] 4.5 更新 GET /api/ai/models 适配新结构

## 5. Backend AI Handlers

- [x] 5.1 更新 `manager/server/services/ai/chat.ts` 使用 `resolveForScene('chat')` 替代直接 resolveModel
- [x] 5.2 更新 `manager/server/services/ai/task.ts` 使用 `resolveForScene('task')`
- [x] 5.3 更新 `manager/server/services/ai/analyze.ts` 使用 `resolveForScene('analyze')`，移除硬编码 `Math.min(options.temperature, 0.5)`
- [x] 5.4 更新 `manager/server/services/ai/agent.ts` 使用 `resolveForScene('agent')`
- [x] 5.5 更新 `manager/server/services/ai/dispatch.ts` 使用 `resolveForScene('dispatch')`
- [x] 5.6 更新 `manager/server/services/ai/review.ts` 使用 `resolveForScene('review')`

## 6. Manager Frontend — Models Page

- [x] 6.1 在 `manager/web/src/router.ts` 中新增 `/models` 路由
- [x] 6.2 在 Manager 侧边栏组件中新增 Models 导航项（位于 Users 和 Settings 之间）
- [x] 6.3 创建 `manager/web/src/views/Models.vue`：预设列表（卡片形式，★ 默认标记），每张卡片显示名称/provider/model/掩码 apiKey
- [x] 6.4 实现 [+ Add] 内联展开表单：name/provider/model/baseURL/apiKey，provider 选择 openai-compatible 时 baseURL 变必填
- [x] 6.5 实现 [Edit] 内联展开编辑：预填现有值，apiKey 显示占位符，空字符串保留原值
- [x] 6.6 实现 [Delete] 功能：调用 DELETE API，404/400 时显示错误提示
- [x] 6.7 实现 ★ 设为默认功能：调用 PUT /api/ai/presets/:id/default

## 7. Manager Frontend — Settings Scene Configuration

- [x] 7.1 重构 `manager/web/src/views/Settings.vue` AI 配置区：替换原单一配置卡片为场景映射表格
- [x] 7.2 实现 6 行场景表格：每行包含场景名称（中文描述）、预设下拉（首项 "Default" + 各预设名）、temperature 输入、maxTokens 输入
- [x] 7.3 实现无预设引导：当无预设时显示 "请先在 Models 页面添加模型预设" + 跳转链接
- [x] 7.4 实现默认预设提示：表格上方显示当前默认预设名称
- [x] 7.5 实现 Save 调用 PUT /api/ai/scenes 提交变更，成功后显示提示
