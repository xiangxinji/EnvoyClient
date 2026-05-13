## 1. 类型定义

- [x] 1.1 在 `src/types.ts` 中添加 `AgentStep` 类型（index, reasoning, toolCalls, toolResults）和 `AgentResult` 类型（result, trace）
- [x] 1.2 扩展 `TaskResource` 类型，明确支持 `client-result`、`file-resource`、`execution-trace` 三种 data 结构

## 2. React Loop 改造

- [x] 2.1 修改 `src/agent/react.ts` 的 `reactLoop()` 返回类型从 `Promise<string>` 改为 `Promise<AgentResult>`，在循环中构建 `trace: AgentStep[]`
- [x] 2.2 在 `reactLoop()` 每轮循环末尾，提取 assistant message 的推理文本和 tool calls 信息，构建 AgentStep 追加到 trace 数组
- [x] 2.3 更新 `src/composables/useAgent.ts` 的 `runAgent()` 适配新的返回类型

## 3. Manager 后端扩展

- [x] 3.1 修改 `manager/server/routes/messages.ts` 的 `POST /api/tasks/:id/result`，解析新增的 `trace` 和 `uploadedFiles` 字段
- [x] 3.2 在 result 处理中，若有 `trace`，调用 `team.innerServer.addResource()` 添加 `execution-trace` 类型资源
- [x] 3.3 修改 `POST /api/tasks/:id/resources` 文件上传端点，成功写入磁盘后调用 `team.innerServer.addResource()` 添加 `file-resource` 类型资源（包含 filename, size, uploadedAt, uploader）
- [x] 3.4 确保 `envoy/packages/server/server.ts` 的 `addResource()` 方法支持新类型（验证现有实现是否通用可用）

## 4. Client 提交逻辑

- [x] 4.1 修改 `src/composables/useTeamClient.ts` 的 `client.doing()` handler，将 `runAgent()` 返回的 trace 附加到 result POST 请求中
- [x] 4.2 在 `doing()` handler 中记录 Agent 执行过程中上传的文件列表（通过工具返回值收集），一并提交

## 5. TaskCard UI 重构

- [x] 5.1 重构 `src/components/TaskCard.vue`，按 `resource.type` 将 resources 分为三组（client-result / file-resource / execution-trace）
- [x] 5.2 实现 Summary 区：使用 `marked` + `DOMPurify` 渲染 `client-result.data.result` 为 Markdown
- [x] 5.3 实现 Resources 区：展示文件列表（文件名、大小、上传者、时间），构造下载 URL `{managerUrl}/api/tasks/{taskId}/resources/{filename}`
- [x] 5.4 实现 Execution Trace 区：创建可折叠时间线组件，每步显示步骤序号、AI 推理、工具调用和执行结果
- [x] 5.5 确保向后兼容：仅有 `client-result` 的旧任务仍正常显示，不显示空的 Resources 和 Trace 区
- [x] 5.6 样式适配：所有新增样式使用 CSS 变量实现 dark/light 双色逻辑
