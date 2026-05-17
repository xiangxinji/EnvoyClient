# AI Architecture

EnvoyClient AI 系统采用三层架构：**客户端 Composables** → **Manager HTTP 路由** → **AI Service Handlers** → **Vercel AI SDK** → **LLM Providers**。Agent 执行采用分布式模式——客户端维护循环状态并本地执行工具，Manager 仅负责 LLM 推理。

## 整体架构图

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        Tauri Desktop Client (Vue 3)                         │
│                                                                             │
│  ┌─────────────────┐  ┌──────────────────┐  ┌────────────────────────────┐ │
│  │   useAI.ts      │  │ useAutoReply.ts  │  │  ReAct Agent (react.ts)   │ │
│  │                 │  │                  │  │                            │ │
│  │ suggestReply()  │  │ trigger()        │  │  Loop (max 20 steps)      │ │
│  │ planTask()      │  │   └─5s debounce  │  │  ┌──────────────────────┐ │ │
│  │ dispatchTask()  │  │ generateReply()  │  │  │ Step: POST reason    │ │ │
│  │ analyzeTask()   │  │                  │  │  │   ↓ toolCalls?       │ │ │
│  │ reviewTask()    │  │                  │  │  │   ├─ Yes → 本地执行   │ │ │
│  │                 │  │                  │  │  │   │  tools.ts         │ │ │
│  │ consumeSSE()    │  │                  │  │  │   │  ├ shell         │ │ │
│  │ ┌─────────────┐ │  │                  │  │  │   │  ├ file_read     │ │ │
│  │ │ SSE Parser  │ │  │                  │  │  │   │  ├ file_write    │ │ │
│  │ │ text-delta  │ │  │                  │  │  │   │  ├ done          │ │ │
│  │ │ tool-call   │ │  │                  │  │  │   │  ├ upload_res    │ │ │
│  │ │ tool-result │ │  │                  │  │  │   │  └ read_skill   │ │ │
│  │ │ done/error  │ │  │                  │  │  │   └─ No → return     │ │ │
│  │ └─────────────┘ │  │                  │  │  └──────────────────────┘ │ │
│  └────────┬────────┘  └────────┬─────────┘  └─────────────┬──────────────┘ │
│           │                    │                          │                │
│           │  Tauri invoke()    │                          │ Tauri invoke() │
│           │  (shell_exec,      │                          │ (shell_exec,   │
│           │   file_read/write) │                          │  file_read/    │
│           │                    │                          │  write)        │
└───────────┼────────────────────┼──────────────────────────┼────────────────┘
            │ HTTP / SSE         │ HTTP                     │ HTTP
            ▼                    ▼                          ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      Manager Backend (Hono, :8080)                          │
│                                                                             │
│  ┌─────────────────────────── routes/ai.ts ──────────────────────────────┐  │
│  │  Auth: X-Envoy-Token (client) | Bearer (admin) | Public (health)     │  │
│  │                                                                      │  │
│  │  POST /api/ai/chat/stream        → handleChatStream     [scene:chat] │  │
│  │  POST /api/ai/chat/generate     → handleChatGenerate    [scene:chat] │  │
│  │  POST /api/ai/auto-reply/gen    → handleAutoReplyGen    [scene:auto] │  │
│  │  POST /api/ai/task/generate     → handleTaskGenerate    [scene:task] │  │
│  │  POST /api/ai/task/dispatch     → handleTaskDispatch    [scene:disp] │  │
│  │  POST /api/ai/task/analyze      → handleAnalyze         [scene:anal] │  │
│  │  POST /api/ai/agent/reason      → handleAgentReason     [scene:agen] │  │
│  │  POST /api/ai/task/review       → handleTaskReview      [scene:revi] │  │
│  │  GET  /api/ai/health            → { configured, provider, model }    │  │
│  └──────────────────────────┬────────────────────────────────────────────┘  │
│                              │                                               │
│                              ▼                                               │
│  ┌────────────── settings.ts: resolveForScene(sceneType) ────────────────┐  │
│  │                                                                       │  │
│  │  scenes[sceneType] → presetId → presets[id] → { provider, model,      │  │
│  │                        apiKey, baseURL }                               │  │
│  │                     ↓ fallback → preset.isDefault === true             │  │
│  │                     ↓                                                │  │
│  │  ResolvedScene { model: LanguageModelV1, temperature, maxTokens }     │  │
│  └──────────────────────────┬────────────────────────────────────────────┘  │
│                              │                                               │
│                              ▼                                               │
│  ┌──────────── services/ai/provider.ts: resolveModel() ─────────────────┐  │
│  │                                                                       │  │
│  │  provider: "openai"    → @ai-sdk/openai      createOpenAI()           │  │
│  │  provider: "anthropic" → @ai-sdk/anthropic   createAnthropic()        │  │
│  │  provider: "google"    → @ai-sdk/google      createGoogleGenerativeAI│  │
│  │  provider: "deepseek"  → @ai-sdk/openai      (baseURL: deepseek.com) │  │
│  │  provider: "openai-compat" → @ai-sdk/openai  (custom baseURL)        │  │
│  │                                                                       │  │
│  │  Output: LanguageModelV1 instance                                     │  │
│  └──────────────────────────┬────────────────────────────────────────────┘  │
│                              │                                               │
│                              ▼                                               │
│  ┌──────────────── Service Handlers ─────────────────────────────────────┐  │
│  │                                                                       │  │
│  │  ┌─────────────┐  ┌──────────────┐  ┌────────────────┐               │  │
│  │  │  stream.ts   │  │  chat.ts     │  │  agent.ts      │               │  │
│  │  │             │  │              │  │                │               │  │
│  │  │ toStandardSSE│  │ ChatStream   │  │ AgentReason   │               │  │
│  │  │ textStream  │  │ ChatGenerate │  │ Tool schema   │               │  │
│  │  │ → SSE events│  │ AutoReplyGen │  │ conversion    │               │  │
│  │  └──────┬──────┘  └──────┬───────┘  │ Message hist  │               │  │
│  │         │                │           │ reconstruction│               │  │
│  │         │         ┌──────┴───────┐   └───────┬────────┘               │  │
│  │         │         │  task.ts     │           │                        │  │
│  │         │         │ analyze.ts   │           │                        │  │
│  │         │         │ dispatch.ts  │           │                        │  │
│  │         │         │ review.ts    │           │                        │  │
│  │         │         │              │           │                        │  │
│  │         │         │ generateObj  │           │                        │  │
│  │         │         │ + Zod schema │           │                        │  │
│  │         │         └──────┬───────┘           │                        │  │
│  │         │                │                   │                        │  │
│  └─────────┼────────────────┼───────────────────┼────────────────────────┘  │
│            │                │                   │                           │
└────────────┼────────────────┼───────────────────┼───────────────────────────┘
             │                │                   │
             ▼                ▼                   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    Vercel AI SDK (ai + @ai-sdk/*)                            │
│                                                                             │
│   streamText()          generateText()          generateObject()            │
│   ┌──────────┐          ┌──────────┐           ┌───────────────┐            │
│   │ Chat     │          │ Agent    │           │ Task Plan     │            │
│   │ (SSE)    │          │ Reason  │           │ Dispatch      │            │
│   │          │          │ Auto    │           │ Analyze       │            │
│   │          │          │ Reply   │           │ Review        │            │
│   └────┬─────┘          └────┬─────┘           └──────┬────────┘            │
│        │                     │                        │                     │
│        └─────────────────────┴────────────────────────┘                     │
│                              │                                              │
│                    LanguageModelV1.call()                                    │
└──────────────────────────────┼──────────────────────────────────────────────┘
                               │
              ┌────────────────┼────────────────┐
              ▼                ▼                ▼
     ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
     │   OpenAI     │  │  Anthropic   │  │   Google     │
     │   API        │  │  API         │  │   AI API     │
     └──────────────┘  └──────────────┘  └──────────────┘
              ▲
              │  (baseURL: api.deepseek.com)
     ┌──────────────┐  ┌──────────────────┐
     │  DeepSeek    │  │ OpenAI-Compatible│
     │  API         │  │ (custom baseURL) │
     └──────────────┘  └──────────────────┘
```

## 7 AI Scene 总览

| Scene | 路由 | SDK 调用 | 输入 | 输出 | 使用场景 |
|-------|------|----------|------|------|----------|
| `chat` | `/api/ai/chat/stream` | `streamText()` | 消息历史 | SSE 流 | 聊天回复建议 |
| `auto-reply` | `/api/ai/auto-reply/generate` | `generateText()` | 消息 + 用户上下文 | `{ text }` | 5s 防抖自动回复 |
| `agent` | `/api/ai/agent/reason` | `generateText()` | 消息 + 工具 schema | `{ toolCalls?, text? }` | ReAct 单步推理 |
| `task` | `/api/ai/task/generate` | `generateObject()` | 任务描述 + 成员 | `TaskPlan` (Zod) | 任务拆解规划 |
| `dispatch` | `/api/ai/task/dispatch` | `generateObject()` | 描述 + 成员能力 | `{ subscribe[], content }` | 智能成员匹配 |
| `analyze` | `/api/ai/task/analyze` | `generateObject()` | 任务 + 执行结果 | `AnalysisResult` (Zod) | 结果分析 |
| `review` | `/api/ai/task/review` | `generateObject()` | 任务 + 成员结果 | `{ success, summary }` | 任务审批 |

## Scene 配置与模型解析

每个 Scene 可独立绑定 Model Preset（provider + model + apiKey），支持 temperature 和 maxTokens 覆盖。未绑定的 Scene fallback 到默认 Preset。

```
manager.json
├── presets: ModelPreset[]          ← 可定义多个模型配置
│   ├── { id, name, provider, model, apiKey, baseURL?, isDefault }
│   └── ...
└── scenes: Partial<Record<SceneType, SceneConfig>>
    ├── chat:     { presetId, temperature?, maxTokens? }
    ├── agent:    { presetId, temperature?, maxTokens? }
    ├── auto-reply: { presetId, temperature?, maxTokens? }
    └── ...
```

**解析流程** (`settings.ts → resolveForScene()`):

```
sceneType → scenes[sceneType] → presetId → presets[id]
                                            ↓ not found
                                      presets.find(p => p.isDefault)
                                            ↓
                                    resolveModel({ provider, apiKey, model, baseURL })
                                            ↓
                                    ResolvedScene { model: LanguageModelV1, temperature, maxTokens }
```

默认值：`temperature = 0.7`，`maxTokens = 4096`。

## Provider 映射

| ProviderType | SDK 包 | 构造方式 | 备注 |
|-------------|--------|---------|------|
| `openai` | `@ai-sdk/openai` | `createOpenAI()(model)` | 标准接入 |
| `anthropic` | `@ai-sdk/anthropic` | `createAnthropic()(model)` | 标准接入 |
| `google` | `@ai-sdk/google` | `createGoogleGenerativeAI()(model)` | 标准接入 |
| `deepseek` | `@ai-sdk/openai` | `createOpenAI({ baseURL: "https://api.deepseek.com/v1" })(model)` | 复用 OpenAI SDK |
| `openai-compatible` | `@ai-sdk/openai` | `createOpenAI({ baseURL })(model)` | 自定义 baseURL |

## 数据流详解

### 1. 聊天回复建议 (Chat Suggestion)

```
用户点击 "AI 建议"
  → useAI.suggestReply(chatHistory)
    → consumeSSE("POST /api/ai/chat/stream", { messages, context })
      → Manager: resolveForScene("chat") → ResolvedScene
      → handleChatStream → buildChatMessages → streamText(model, messages)
      → toStandardSSE 将 textStream 转为 SSE 事件流
    ← SSE 事件: text-delta × N → done | error
  ← suggestion ref 实时更新，UI 逐字渲染
```

### 2. AI 自动回复 (Auto Reply)

```
收到聊天消息
  → useAutoReply.trigger(peerId, historyCount)
    → 5s debounce 计时器启动（同 peer 重置）
    → 计时到期后 generateReply()
      → 取最近 historyCount 条聊天记录
      → POST /api/ai/auto-reply/generate { messages, context: { username, role, team } }
        → Manager: resolveForScene("auto-reply")
        → handleAutoReplyGenerate → buildAutoReplyMessages（替换 {username}/{role}/{team} 占位符）
        → generateText(model, messages)
      ← { text, usage, finishReason }
    → text 非空则 sendChat(peerId, text, { source: "ai-auto" })
    → 消息标记 source: "ai-auto"，接收端显示 AI auto reply 徽章
```

### 3. ReAct Agent 执行

```
Member 收到 dispatch 任务
  → useTaskExecution.registerHandler(client)
    → 检查执行模式: auto → 自动执行 | manual → 等待用户触发
    → 组装工具集 + 加载 Skill Catalog
    → POST /api/tasks/{id}/start → 任务状态 → running
    → useAgent.runAgent(taskContent, tools) 启动 ReAct 循环
      → [循环, max 20 步]
        → POST /api/ai/agent/reason { messages, tools: schemas }
          → Manager: resolveForScene("agent")
          → handleAgentReason
            → 转换 JSON schema → AI SDK tool() 定义
            → 重建消息历史（tool calls/results 格式转换）
            → generateText(model, messages, { tools })
          ← { toolCalls?, text?, done, usage }
        → [有 toolCalls] 逐个本地执行
          → shell → Tauri shell_exec (cwd = working_directory)
          → file_read / file_write → Tauri 文件 IO
          → upload_resource → POST /api/tasks/{id}/resources
          → read_skill → 读取 ~/.envoy/brains/{user}/skills/{name}.md
          → done → 提交结果，退出循环
          → 工具执行结果追加到 messages，继续循环
        → [无 toolCalls] 返回文本作为最终结果
      ← AgentResult { result, trace }
    → POST /api/tasks/{id}/result 提交结果 + trace
```

### 4. 任务规划 (Task Planning)

```
useAI.planTask(description, members)
  → POST /api/ai/task/generate { description, members: [{ id, role }] }
    → Manager: resolveForScene("task")
    → handleTaskGenerate → generateObject(model, messages, { schema: taskPlanSchema })
  ← TaskPlan { summary, assignments: [{ memberId, description, commands: string[] }] }
```

### 5. 智能分派 (Smart Dispatch)

```
useAI.dispatchTask(description, members)
  → POST /api/ai/task/dispatch { description, members: [{ id, responsibilities?, capabilities? }] }
    → Manager: resolveForScene("dispatch")
    → handleTaskDispatch → generateObject(model, messages, { schema: dispatchSchema })
  ← { subscribe: memberId[], content: optimizedDescription }
```

### 6. 任务分析 (Task Analysis)

```
useAI.analyzeTaskResult(taskDescription, results)
  → POST /api/ai/task/analyze { taskDescription, results: [{ memberId, commands, stdout, stderr, exitCode }] }
    → Manager: resolveForScene("analyze")
    → handleAnalyze → generateObject(model, messages, { schema: analysisSchema })
  ← AnalysisResult { summary, issues: string[], suggestions: string[] }
```

### 7. 任务审批 (Task Review)

```
useAI.reviewTaskResult(taskContent, resources)
  → 分离 client-result (执行数据) 和 file-resource (文件元数据)
  → POST /api/ai/task/review { taskDescription, results, resources }
    → Manager: resolveForScene("review")
    → handleTaskReview → generateObject(model, messages, { schema: reviewSchema })
  ← { success: boolean, summary: string }
  → success=true → 任务 completed
  → success=false → 任务 resetForRetry()，重新分派给所有 Member
```

## SSE 协议

Chat 场景使用 SSE（Server-Sent Events）流式传输，协议定义在 `shared/types/sse.ts`。

### 事件格式

```
event: <event-type>
data: <JSON payload>

```

### 事件类型

| 事件 | Payload | 说明 |
|------|---------|------|
| `text-delta` | `{ text: string }` | 文本增量，逐块推送 |
| `tool-call` | `{ callId, name, args }` | 工具调用请求 |
| `tool-result` | `{ callId, result }` | 工具执行结果 |
| `done` | `{ finishReason, usage }` | 流结束 |
| `error` | `{ error: string }` | 错误 |

### 转换流程

```
streamText() → result.textStream → toStandardSSE()
                                    ├─ text chunks → text-delta events
                                    ├─ await steps → tool-call + tool-result events
                                    ├─ finishReason + usage → done event
                                    └─ catch → error event
```

## 认证模型

| 端点类型 | 认证方式 | 使用者 |
|---------|---------|--------|
| `GET /api/ai/health` | 无（公开） | 客户端检测 AI 可用性 |
| AI 功能端点 | `X-Envoy-Token` Header | Tauri 桌面客户端 |
| AI 配置端点 | `Authorization: Bearer` Token | Manager Web UI（管理员） |

## Agent 工具体系

### 本地工具（Tauri invoke）

| 工具 | Tauri Command | 说明 |
|------|---------------|------|
| `shell` | `shell_exec` | 执行 Shell 命令，工作目录取自成员设置 |
| `file_read` | `file_read` | 读取本地文件（限 home 目录，拒绝二进制） |
| `file_write` | `file_write` | 写入本地文件 |
| `done` | — | 声明任务完成，提交结果 |

### 远程工具（Manager HTTP API）

| 工具 | API | 说明 |
|------|-----|------|
| `upload_resource` | `POST /api/tasks/{id}/resources` | 上传任务资源文件 |
| `query_resources` | `GET /api/tasks/{id}/resources` | 查询任务资源列表 |
| `read_resource` | `GET /api/tasks/{id}/resources/{file}` | 读取资源文件内容 |

### 知识工具

| 工具 | 来源 | 说明 |
|------|------|------|
| `read_skill` | `~/.envoy/brains/{user}/skills/{name}.md` | 读取 Agent 技能文档 |

### Agent 约束

- **最大步数**: 20 步
- **AI 推理超时**: 30s
- **工具执行超时**: 60s
- **输出截断**: stdout ≤ 2000 字符，stderr ≤ 1000 字符
- **终止条件**: AI 返回纯文本（无工具调用）或 `done` 工具被调用

## 核心架构特点

1. **分布式 Agent** — 客户端维护循环状态 + 本地执行工具（Tauri），Manager 只做 LLM 推理，API Key 不暴露到客户端
2. **Scene 路由** — 7 个场景各自绑定独立 model preset + temperature + maxTokens，未配置时 fallback 到默认 preset
3. **Provider 抽象** — DeepSeek 和 OpenAI-Compatible 复用 `@ai-sdk/openai` + 自定义 baseURL，无需 Provider 专属 SDK
4. **流式仅限 Chat** — 只有 chat 场景走 SSE 流式，其余 6 个场景同步 JSON 返回
5. **结构化输出** — task / dispatch / analyze / review 使用 `generateObject()` + Zod schema 保证输出格式
6. **Prompt 模板化** — 所有 AI Prompt 存放在 `manager/server/services/ai/prompts/` 目录，支持占位符替换

## 关键文件索引

### 客户端

| 文件 | 职责 |
|------|------|
| `src/composables/useAI.ts` | AI composable：SSE 流式聊天、任务规划、结果分析、智能分派、任务审批 |
| `src/composables/useAutoReply.ts` | AI 自动回复：5s 防抖、调用 Manager auto-reply API |
| `src/agent/react.ts` | ReAct Agent 循环：max 20 步，调用 Manager AI 推理 + 本地工具执行 |
| `src/agent/tools.ts` | Agent 工具定义：shell, file_read, file_write, done, resource 工具 |

### Manager 后端

| 文件 | 职责 |
|------|------|
| `manager/server/routes/ai.ts` | AI 路由注册 + 认证分流 |
| `manager/server/settings.ts` | Scene/Preset 解析 → `resolveForScene()` |
| `manager/server/services/ai/provider.ts` | Provider 工厂：ProviderType → LanguageModelV1 |
| `manager/server/services/ai/stream.ts` | AI stream → SSE 转换器 |
| `manager/server/services/ai/chat.ts` | 聊天补全（SSE streaming）+ 自动回复生成 |
| `manager/server/services/ai/task.ts` | 任务规划生成（generateObject + Zod） |
| `manager/server/services/ai/agent.ts` | Agent 推理：工具定义转换 + generateText |
| `manager/server/services/ai/dispatch.ts` | 智能分派：职责匹配 + generateObject |
| `manager/server/services/ai/review.ts` | 任务审批：generateObject + Zod |
| `manager/server/services/ai/analyze.ts` | 任务结果分析 |
| `manager/server/services/ai/prompts/` | 所有 AI Prompt 模板 |

### 共享类型

| 文件 | 职责 |
|------|------|
| `shared/types/ai.ts` | AI 类型：ProviderType, SceneType, SceneConfig, ModelPreset, AIConfig |
| `shared/types/sse.ts` | SSE 事件类型：TextDelta, ToolCall, ToolResult, Done, Error |
