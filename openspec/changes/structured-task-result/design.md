## Context

当前 Member 完成任务后，`reactLoop()` 只返回最终字符串结果（通过 `done` tool 或 AI 纯文本回复）。完整的 `messages[]` 对话历史（包含每步 AI 推理、工具调用名/参数、工具执行结果）作为局部变量被丢弃。上传的文件通过 `POST /api/tasks/:id/resources` 写入 Manager 磁盘，但不在 Envoy 的 `task.resources[]` 中登记。TaskCard 组件的 `formatResource()` 对非 stdout/stderr 数据一律 `JSON.stringify` 渲染。

涉及的文件：`src/agent/react.ts`、`src/composables/useTeamClient.ts`、`src/composables/useAgent.ts`、`manager/server/routes/messages.ts`、`envoy/packages/server/server.ts`、`src/components/TaskCard.vue`、`src/types.ts`。

## Goals / Non-Goals

**Goals:**
- 捕获并持久化 ReAct Agent 的完整执行步骤（AI 推理文本、工具调用名和参数、工具执行结果）
- 在 `task.resources[]` 中登记上传的文件资源（文件名、大小、上传者、时间戳）
- TaskCard 分三区展示：AI Summary（Markdown 渲染）、文件资源列表（含下载 URL）、执行过程时间线（可折叠）
- 保持向后兼容——现有 `client-result` 类型不变，新增类型为增量扩展

**Non-Goals:**
- 不修改 Agent 的推理逻辑或 tool 定义
- 不增加执行过程的实时推送（本次只做事后展示）
- 不简化/截断执行步骤（用户明确要求全量展示，后续再精简）
- 不修改 Manager Web 端的任务展示（只改 Client 前端）

## Decisions

### 1. reactLoop 返回结构化对象而非字符串

**决策**: `reactLoop()` 返回 `{ result: string, trace: AgentStep[] }` 而非 `string`。

**理由**: `messages[]` 已经在循环中完整构建，只需要在返回时一起传出。`AgentStep` 提取自每轮的 assistant message 和对应的 tool messages，包含 `index`、`reasoning`（AI 文本）、`toolCalls`（调用列表）、`toolResults`（执行结果）。

**替代方案**: 在循环中通过回调/事件逐步发射步骤数据。但本次只做事后展示，不需要实时性，返回时一起带出更简单。

### 2. 新增两种 task.resources 类型

**决策**: 在 `task.resources[]` 中新增 `file-resource` 和 `execution-trace` 两种类型，与现有 `client-result` 并列。

**理由**: 复用 Envoy 已有的 `addResource()` + `notifyTaskUpdate()` 机制。WebSocket 通知会自动携带新的 resources 到所有订阅者，不需要新建通知通道。

数据结构：
- `file-resource`: `{ filename, size, uploadedAt, uploader }` — 由 Manager 在文件上传时添加
- `execution-trace`: `{ steps: AgentStep[] }` — 由客户端在提交结果时附带

### 3. 执行 trace 与结果一起提交

**决策**: 扩展 `POST /api/tasks/:id/result` 的请求体，新增 `trace` 和 `uploadedFiles` 字段。Manager 收到后调用 `addResource()` 分别添加 `execution-trace` 和 `file-resource`。

**理由**: 避免新建 endpoint。result 提交是任务完成的唯一入口，在这里一并处理最自然。

### 4. TaskCard 三区展示

**决策**: TaskCard 内部按 `resource.type` 分组渲染：
- `client-result` → Summary 区（Markdown 渲染，复用 `marked` + `DOMPurify`）
- `file-resource` → Resources 区（文件列表，每项显示文件名、大小、上传者，构造 `{managerUrl}/api/tasks/{taskId}/resources/{filename}` 下载链接）
- `execution-trace` → Trace 区（时间线组件，每步可展开查看详情）

**理由**: 三种数据语义完全不同，分区展示比混合列表更清晰。复用已有的 Markdown 渲染依赖，不引入新库。

## Risks / Trade-offs

- **[trace 数据量较大]** → Agent 最多 20 步，每步的 tool result 已有截断（stdout 2000 字符、stderr 1000 字符），整体 trace 预计在 50KB 以内，WebSocket 传输和磁盘存储可接受
- **[file-resource 与磁盘文件不一致]** → 如果文件被手动删除，`file-resource` 记录仍在。可通过文件列表 API 做一致性校验，但本次不处理
- **[reactLoop 返回类型变更]** → 只影响 `useAgent.runAgent()` 和 `useTeamClient.doing()` 两个调用点，影响面可控
