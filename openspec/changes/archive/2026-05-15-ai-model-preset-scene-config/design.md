## Context

Manager 的 AI 配置当前是一个扁平的 `AISettings` 对象（provider/apiKey/model/temperature/maxTokens），所有 6 个 AI 功能共享。运行时通过 `resolveModel(config)` 和 `getModelOptions(config)` 解析，各 handler（chat.ts、agent.ts 等）直接调用这两个函数。

存储在 `~/.envoy/manager.json` 的 `ai` 字段中，无加密，无验证。前端 `Settings.vue` 中有硬编码的 PROVIDERS 列表（与 `constants.ts` 重复）。

## Goals / Non-Goals

**Goals:**
- 支持「模型预设」CRUD：每个预设只管连接信息（provider/model/baseURL/apiKey），不含推理参数
- 支持「场景配置」：6 个 AI 场景各绑定一个预设 ID + 独立的 temperature/maxTokens
- 默认回退机制：未配置场景使用标记为 default 的预设
- 新增 `openai-compatible` provider 类型支持自定义 base URL
- 删除保护：预设被场景绑定时禁止删除
- 自动迁移旧格式
- 前端新增独立的 Models 管理页面

**Non-Goals:**
- API Key 加密存储（本次不涉及）
- Prompt 模板自定义（本次不涉及）
- 连接测试功能（本次不涉及）
- topP/frequencyPenalty 等高级参数（本次不涉及，但架构上预留）
- Fallback 预设链（单层回退足够）

## Decisions

### 1. 数据模型：Presets + Scenes 分离

```
AISettings {
  presets: ModelPreset[]
  scenes: Partial<Record<SceneType, SceneConfig>>
}
```

**选择原因**：预设只存连接信息（方案 A），参数由场景持有。这样同一个模型可以创建多个预设（不同 name），每个场景可以独立调参数。解耦后预设是可复用资源，场景是消费者。

**备选方案**：预设包含完整参数（方案 B），场景只引用预设 ID。被否决因为场景无法微调参数，灵活性不足。

### 2. 运行时解析链

```
handler 调用 resolveForScene('agent')
  → scenes.agent 存在？
    → 有 presetId → findPreset(presetId)
    → 无 presetId → findDefaultPreset()
  → 组合 preset 连接信息 + scene 参数 → 返回 model + options
```

各 AI handler 不再直接调 `resolveModel(config)` 和 `getModelOptions(config)`，改为调用统一的 `resolveForScene(sceneType)` 返回 `{ model, temperature, maxTokens }`。

### 3. 旧格式迁移

在 `loadSettings()` 中检测：如果 `ai.presets` 不存在且 `ai.provider` 存在，自动将旧配置转换为一个默认预设 + 空 scenes。迁移后直接写入磁盘，后续请求使用新格式。

### 4. Provider 类型扩展

新增 `openai-compatible` 类型，内部使用 `createOpenAI({ apiKey, baseURL })` 创建。必填 baseURL 字段。其余 4 个 provider 保持不变。模型名改为自由输入（不锁下拉），但提供常用模型建议。

### 5. 删除保护实现

删除预设前遍历 `scenes` 检查是否有 `presetId` 匹配。有绑定则返回 400 + 绑定的场景名列表。前端展示错误提示。

### 6. 前端页面分离

- **Models 页面**（`/models`）：预设列表 + 内联增删改 + ★ 设默认
- **Settings 页面**：场景映射表格，每行一个场景（下拉选预设 + temperature + maxTokens）

侧边栏新增 Models 导航项，位于 Users 和 Settings 之间。

## Risks / Trade-offs

- **[迁移风险]** 旧格式用户首次升级时自动迁移，如果中途写入失败可能导致配置丢失 → 迁移前先备份旧配置到 `ai_legacy` 字段
- **[UI 复杂度增加]** 从单卡片配置变为两个页面的管理，初次使用门槛提高 → 无预设时在 Settings 页面显示引导链接到 Models 页面
- **[presetId 引用断裂]** 如果通过手动编辑 JSON 删除了预设但忘了清理 scenes → resolveForScene 找不到预设时 fallback 到默认预设，不崩溃
