## Context

当前 Member 端 `client.doing()` 收到任务后直接执行 shell 命令，没有任何推理能力。Manager 端已有完整的 AI 基础设施（ai-sdk、多 Provider、结构化输出），但缺少供 Agent 循环使用的推理端点。Member 和 Manager 分布在不同主机上，通过 Manager HTTP API 通信，Agent 的 tool 执行必须在 Member 本地完成。

## Goals / Non-Goals

**Goals:**
- Member 端实现 ReAct (Reason-Act-Observe) 循环，能自主理解任务、规划步骤、迭代执行
- Manager 端提供无状态 AI 推理端点，透传 tool schemas 给模型并返回 tool calls
- Member 端可扩展的 tool 定义体系（schema + execute 分离）
- 安全边界：最大 20 轮迭代，单轮超时保护

**Non-Goals:**
- 多 Agent 间通信协作（本次只做单 Agent 单 Member）
- Agent 的学习/记忆能力（跨任务持久化）
- shell 命令白名单或沙箱隔离（后续安全迭代）
- Leader 端的 UI 展示 Agent 执行过程（后续优化）

## Decisions

### D1: Member 编排循环，Manager 无状态代理

**选择**: Member 端维护完整的 ReAct 循环状态（对话历史），每轮 POST 到 Manager 获取 AI 推理结果。

**备选**:
- A: Manager 端有状态会话（WebSocket 或 session），Manager 自动循环 — 复杂度高，需维护会话生命周期
- B: Member 本地跑 AI — API key 暴露，不安全

**理由**: Member 持有状态最自然（它在本地执行 tools），Manager 保持无状态 HTTP 最简单。每轮传完整对话历史，ReAct 循环通常 5-15 轮，上下文量可控。

### D2: 使用 ai-sdk tool calling（非结构化输出）

**选择**: Manager 端用 `generateText({ tools })` 的原生 tool calling，tool schemas 由 Member 在请求中传入。

**备选**:
- A1: `generateObject` + zod 约束输出格式 — 模型非原生范式，准确度低

**理由**: 现代模型专门训练过 function calling，tool 选择和参数生成更可靠。schema 由 Member 定义（它才是执行者），Manager 只透传。

### D3: Tool 定义体系

**选择**: Member 端定义 tools，每个 tool 包含 `name`、`description`、`parameters`（JSON Schema）和 `execute` 函数。调用 Manager 时只传 schema（不含 execute）。

**初始 tool 集**:
- `shell`: 执行 shell 命令，返回 stdout/stderr/exitCode
- `file_read`: 读取文件内容，返回 string
- `file_write`: 写入文件，返回 success
- `done`: 声明任务完成，提交最终结果

### D4: useAgent 作为独立 composable

**选择**: 新建 `src/composables/useAgent.ts`，与现有 `useAI.ts`（聊天建议）职责分离。

**理由**: Agent 引擎和聊天建议是完全不同的职责 — 一个是长循环编排，一个是单次建议生成。独立 composable 保持关注点分离。

### D5: Manager 端点设计

**选择**: `POST /api/ai/agent/reason`，请求体包含 `{ messages, tools }`，响应返回 `{ toolCalls?, text?, done }`。

**不使用 SSE 流式**: ReAct 循环中每轮推理需要完整结果才能继续，流式无法支持。使用 `generateText`（非 stream）。

### D6: 新增 Tauri file commands

**选择**: Rust 端新增 `file_read` 和 `file_write` 两个 invoke commands，供 Member Agent 的 file tool 调用。

**限制**: 仅允许操作用户 home 目录下的文件，防止任意文件系统访问。

## Risks / Trade-offs

- **[每轮传完整历史]** → ReAct 20 轮时对话可能较长。缓解：对 tool result 做 truncate（stdout/stderr 截断至 2000/1000 字符），确保上下文窗口不溢出
- **[无 shell 沙箱]** → Agent 可执行任意命令。缓解：后续迭代加白名单，本次先实现核心循环
- **[Agent 循环耗时]** → 单个任务可能运行数分钟。缓解：Leader 端已有 task status 更新机制，Member 端加单轮超时（30s AI 推理 + 60s tool 执行）
- **[Manager AI 单点]** → 所有 Member 的推理请求都经过 Manager。缓解：Manager 无状态，可水平扩展；当前规模不是问题
