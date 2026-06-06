## MODIFIED Requirements

### Requirement: AI 服务内联到 manager
系统 SHALL 将所有 AI 服务逻辑（chat、task、analyze、provider、stream、prompts、constants）直接放置在 `manager/server/services/ai/` 目录下，而非独立包。

所有 AI handler（`generateText`、`streamText`、`generateObject`）SHALL 在每次调用完成后提取 `result.usage` 并调用 `recordUsage()` 持久化 token 用量。

#### Scenario: Manager 启动加载 AI 路由
- **WHEN** Manager 后端启动
- **THEN** AI 路由通过 `manager/server/routes/ai.ts` 从本地 `services/ai/` 加载，不再引用 `ai-layer` 包

#### Scenario: AI 端点行为不变
- **WHEN** 前端调用 `/api/ai/chat/stream`、`/api/ai/task/generate`、`/api/ai/analyze` 等端点
- **THEN** 请求/响应格式、SSE 事件格式、错误处理行为与迁移前完全一致

#### Scenario: generateText 端点记录用量
- **WHEN** `agent.ts`、`chat.ts`（generate、auto-reply）等 generateText 端点完成调用
- **THEN** SHALL 提取 `result.usage` 的 `promptTokens` 和 `completionTokens`，调用 `recordUsage()` 持久化

#### Scenario: streamText 端点记录用量
- **WHEN** `chat.ts`（stream）端点的 SSE 流完成
- **THEN** SHALL 在发送 `done` 事件的位置同时调用 `recordUsage()` 持久化 usage

#### Scenario: generateObject 端点记录用量
- **WHEN** `task.ts`、`dispatch.ts`、`review.ts`、`analyze.ts`、`cloudOrganize.ts` 等 generateObject 端点完成调用
- **THEN** SHALL 提取 `result.usage`（此前未提取）并调用 `recordUsage()` 持久化
