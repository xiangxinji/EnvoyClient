## 1. Rust Tauri File Commands

- [x] 1.1 在 `src-tauri/src/lib.rs` 中实现 `file_read` command：解析 `~` 为 home 目录，路径安全检查（必须在 home 内），读取文件内容返回 `{ content: string }`，处理文件不存在和路径遍历
- [x] 1.2 在 `src-tauri/src/lib.rs` 中实现 `file_write` command：路径安全检查同上，自动创建父目录，写入内容返回 `{ success: boolean }`
- [x] 1.3 在 `src-tauri/src/lib.rs` 的 `tauri::Builder` 中注册 `file_read` 和 `file_write` commands

## 2. Manager Agent Endpoint

- [x] 2.1 创建 `manager/server/services/ai/prompts/agent.ts`：定义 AGENT_SYSTEM_PROMPT（ReAct 模式指令，引导模型思考-行动-观察循环）
- [x] 2.2 创建 `manager/server/services/ai/agent.ts`：实现 `handleAgentReason` 函数，接收 `{ messages, tools }`，调用 `generateText({ model, messages, tools })`，返回 `{ toolCalls?, text?, done, usage }`
- [x] 2.3 在 `manager/server/routes/ai.ts` 中注册 `POST /api/ai/agent/reason` 路由，挂载 `handleAgentReason`

## 3. Member Agent Engine (useAgent)

- [x] 3.1 创建 `src/composables/useAgent.ts`：定义 `AgentTool` 接口（name, description, parameters, execute）和内置 tool 定义（shell, file_read, file_write, done）
- [x] 3.2 实现 `reactLoop(taskContent, tools)` 函数：20 轮循环，每轮 POST `/api/ai/agent/reason`，匹配 tool calls 本地执行，拼接对话历史
- [x] 3.3 实现超时保护：AI 推理 30s 超时，tool 执行 60s 超时
- [x] 3.4 实现 tool result truncate：stdout 截断 2000 字符，stderr 截断 1000 字符，防止上下文溢出
- [x] 3.5 导出 `useAgent()` composable：返回 `{ reactLoop, isRunning, currentStep, error }` 响应式属性

## 4. 集成到 useTeamClient

- [x] 4.1 修改 `src/composables/useTeamClient.ts` 的 `client.doing()` 处理器：从直接 `shell_exec` 改为调用 `reactLoop(taskContent, tools)`
- [x] 4.2 处理 browser mode：非 Tauri 环境下 Agent tools 的 graceful fallback
