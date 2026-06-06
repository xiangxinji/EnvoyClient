## MODIFIED Requirements

### Requirement: Agent Reason 端点

Manager SHALL 提供 `POST /api/ai/agent/reason` 端点（clientAuth 保护），供 Member 调用进行 AI 推理。模型配置 SHALL 从 `agent` 场景的映射预设中解析。端点 SHALL 读取 `c.req.header("team")` 和 `c.get("userId")` 获取团队和用户上下文，调用完成后 SHALL 通过 `recordUsage()` 记录 token 用量。

#### Scenario: 正常推理请求
- **WHEN** Member POST `{ messages: [...], tools: [{ name, description, parameters }] }` 到 `/api/ai/agent/reason`（携带 `X-Envoy-Token` 和 `team` header）
- **THEN** Manager SHALL 从场景配置中解析 `agent` 场景对应的模型预设，调用 ai-sdk `generateText({ model, messages, tools })` 并返回 JSON `{ toolCalls?: [...], text?: string, usage: {...} }`

#### Scenario: 推理请求记录用量
- **WHEN** Agent reason 端点完成推理
- **THEN** SHALL 提取 `result.usage`，以 `scene: "agent"`、`team` 来自 header、`username` 来自 `c.get("userId")`、`presetId` 来自解析的预设，调用 `recordUsage()` 持久化

#### Scenario: AI 返回 tool calls
- **WHEN** AI 模型决定调用工具
- **THEN** 响应 SHALL 包含 `toolCalls` 数组，每项包含 `{ id, name, args }`

#### Scenario: AI 返回纯文本（无 tool call）
- **WHEN** AI 模型不调用任何工具，直接生成文本回复
- **THEN** 响应 SHALL 包含 `text` 字段和 `done: true` 标记，表示 Agent 应结束循环

#### Scenario: AI 未配置
- **WHEN** 系统中无任何模型预设
- **THEN** SHALL 返回 `{ error: "AI not configured" }` 状态码 503

#### Scenario: 请求缺少 messages 或 tools
- **WHEN** 请求体中缺少 `messages` 或 `tools` 字段
- **THEN** SHALL 返回 `{ error: "messages and tools are required" }` 状态码 400
