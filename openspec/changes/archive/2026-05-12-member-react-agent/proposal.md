## Why

当前 Member 端收到 Leader 派发的任务后，`client.doing()` 直接将任务内容作为 shell 命令无脑执行，没有推理能力、无法处理复杂任务、无法迭代纠错。项目的核心价值在于 Member 端能够自主理解任务、规划步骤、执行并观察结果，形成 ReAct (Reason-Act-Observe) 循环。Manager 已有完整的 AI 基础设施（多 Provider、SSE 流式、结构化输出），但没有 Agent 级别的 AI 接口供 Member 调用。

## What Changes

- **新增 Member 端 Agent 引擎** (`useAgent.ts`)：独立 composable，实现 ReAct 循环编排，最大 20 轮迭代
- **新增 Member 端 Tool 定义体系**：Member 本地定义可用 tools（shell、file_read、file_write、done），包含 schema 和 execute 实现
- **新增 Manager AI Agent 端点** (`POST /api/ai/agent/reason`)：无状态 AI 代理，接收 Member 传来的对话历史 + tool schemas，调用 ai-sdk `generateText` 返回 tool calls
- **改造 `useTeamClient.ts` 的 `doing` 处理器**：从直接 `shell_exec` 改为调用 Agent ReAct 循环
- **新增 Rust Tauri commands**：`file_read`、`file_write` 命令支持 Agent 的文件操作 tool

## Capabilities

### New Capabilities
- `member-react-agent`: Member 端 ReAct Agent 引擎，包含循环编排、tool 定义、本地执行、结果收集
- `manager-agent-endpoint`: Manager 端无状态 AI Agent 推理端点，透传 tool schemas 给 AI 模型并返回 tool calls
- `tauri-file-commands`: Rust 端文件读写 Tauri commands，供 Agent tools 调用

### Modified Capabilities
<!-- 无现有 spec 需要修改 -->

## Impact

- **新增文件**: `src/composables/useAgent.ts`, `manager/server/services/ai/agent.ts`, `manager/server/services/ai/prompts/agent.ts`
- **修改文件**: `src/composables/useTeamClient.ts`（doing 处理器改造）, `manager/server/routes/ai.ts`（挂载新路由）, `src-tauri/src/lib.rs`（新增 file_read/file_write commands）
- **API 变更**: Manager 新增 `POST /api/ai/agent/reason` 公开端点
- **依赖**: 无新外部依赖，复用现有 ai-sdk 的 `generateText` + tool calling
