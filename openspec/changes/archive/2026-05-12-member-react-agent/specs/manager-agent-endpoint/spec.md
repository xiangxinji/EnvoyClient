## ADDED Requirements

### Requirement: Agent Reason 端点

Manager SHALL 提供 `POST /api/ai/agent/reason` 公开端点（无需认证），供 Member 调用进行 AI 推理。

#### Scenario: 正常推理请求
- **WHEN** Member POST `{ messages: [...], tools: [{ name, description, parameters }] }` 到 `/api/ai/agent/reason`
- **THEN** Manager 调用 ai-sdk `generateText({ model, messages, tools })` 并返回 JSON `{ toolCalls?: [...], text?: string, usage: {...} }`

#### Scenario: AI 返回 tool calls
- **WHEN** AI 模型决定调用工具
- **THEN** 响应 SHALL 包含 `toolCalls` 数组，每项包含 `{ id, name, args }`

#### Scenario: AI 返回纯文本（无 tool call）
- **WHEN** AI 模型不调用任何工具，直接生成文本回复
- **THEN** 响应 SHALL 包含 `text` 字段和 `done: true` 标记，表示 Agent 应结束循环

#### Scenario: AI 未配置
- **WHEN** Manager 的 AI 配置中无 apiKey
- **THEN** SHALL 返回 `{ error: "AI not configured" }` 状态码 503

#### Scenario: 请求缺少 messages 或 tools
- **WHEN** 请求体中缺少 `messages` 或 `tools` 字段
- **THEN** SHALL 返回 `{ error: "messages and tools are required" }` 状态码 400

### Requirement: Tool Schema 透传

Manager SHALL 将 Member 传入的 tool schemas 原样传递给 ai-sdk 的 `generateText`，不做修改或过滤。

#### Scenario: 透传自定义 tools
- **WHEN** Member 在请求中传入 `[{ name: "custom_tool", description: "...", parameters: {...} }]`
- **THEN** Manager SHALL 将这些 tools 原样传给 `generateText({ tools })`，AI 可正常选择调用

### Requirement: Agent System Prompt

Manager 端 SHALL 为 Agent 推理提供专用 system prompt，指导模型以 ReAct 模式工作。

#### Scenario: System prompt 注入
- **WHEN** Member 调用 `/api/ai/agent/reason`
- **THEN** Manager SHALL 在 messages 前注入 system prompt，内容为：你是一个自主任务执行 Agent，通过调用工具完成任务。你应该在每一轮思考下一步操作，观察执行结果，决定是否继续。当你认为任务完成时，调用 done 工具提交结果。

### Requirement: 无状态设计

端点 SHALL 为无状态设计 — 不维护会话、不存储对话历史。每轮请求 MUST 包含完整的对话上下文。

#### Scenario: 多轮请求无关联
- **WHEN** Member 连续发送两次 `/api/ai/agent/reason` 请求
- **THEN** 两次请求 SHALL 独立处理，Manager 不依赖上一次请求的状态

### Requirement: 路由挂载

`/api/ai/agent/reason` SHALL 挂载在 Manager 的 AI 路由组下，与现有 chat/task 路由同级。

#### Scenario: 路由注册
- **WHEN** Manager 服务启动
- **THEN** `/api/ai/agent/*` 路由 SHALL 可访问，且 `/api/ai/agent/reason` 响应 POST 请求
