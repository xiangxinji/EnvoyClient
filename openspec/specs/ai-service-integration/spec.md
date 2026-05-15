## ADDED Requirements

### Requirement: AI 服务内联到 manager
系统 SHALL 将所有 AI 服务逻辑（chat、task、analyze、provider、stream、prompts、constants）直接放置在 `manager/server/services/ai/` 目录下，而非独立包。

#### Scenario: Manager 启动加载 AI 路由
- **WHEN** Manager 后端启动
- **THEN** AI 路由通过 `manager/server/routes/ai.ts` 从本地 `services/ai/` 加载，不再引用 `ai-layer` 包

#### Scenario: AI 端点行为不变
- **WHEN** 前端调用 `/api/ai/chat/stream`、`/api/ai/task/generate`、`/api/ai/analyze` 等端点
- **THEN** 请求/响应格式、SSE 事件格式、错误处理行为与迁移前完全一致

### Requirement: 共享类型提取
系统 SHALL 将 AI 相关的共享类型定义放置在项目根 `shared/types/` 目录下。

#### Scenario: 类型文件可被多端引用
- **WHEN** manager 后端或前端需要 AIConfig、ChatRequest、SSEEvent 等类型
- **THEN** 可通过 `shared/types/ai.ts` 或 `shared/types/sse.ts` 引用

### Requirement: ai-layer 包移除
系统 SHALL 完全移除 `ai-layer/` 目录及其作为独立包的身份。

#### Scenario: 项目无 ai-layer 依赖
- **WHEN** 检查项目目录结构
- **THEN** `ai-layer/` 目录不存在，所有代码和依赖已迁移到对应位置

#### Scenario: 依赖已迁移
- **WHEN** 检查 `manager/server/package.json`
- **THEN** 包含 ai、@ai-sdk/openai、@ai-sdk/anthropic、@ai-sdk/google、@ai-sdk/deepseek、zod 依赖

### Requirement: client 模块不保留
系统 SHALL 不保留 ai-layer 的 client 模块代码。前端 continue 使用 useAI.ts 中的现有实现。

#### Scenario: 前端不受影响
- **WHEN** Tauri 前端通过 useAI.ts 调用 AI 功能
- **THEN** 行为与迁移前一致，无任何变更
