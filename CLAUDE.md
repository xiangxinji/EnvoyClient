# CLAUDE.md

## Project Overview

EnvoyClient 是一个基于 Tauri 2 + Vue 3 的 **团队 AI Agent 协作桌面客户端**。使用自研 Envoy 框架进行 WebSocket 实时通信，支持 Leader/Member 角色区分，微信风格聊天界面，手动与 AI 智能任务分派，以及本地 ReAct Agent 自主执行任务。项目还包含 Manager 管理后台（Hono HTTP API + Vue 3 Web），支持多团队创建、用户管理、AI 配置和仪表盘。所有 AI 能力（聊天、任务分派、Agent 推理）通过 Manager 统一代理，支持 OpenAI/Anthropic/Google/DeepSeek 多 Provider。

## Tech Stack

- **Client Frontend**: Vue 3 + TypeScript + Vite + Vue Router (hash mode)
- **Desktop Runtime**: Tauri 2 (Rust backend) — 文件 IO、Shell 执行、消息持久化
- **Communication**: Envoy 框架 (WebSocket, Git submodule `envoy/`) — Server/Client/Team/Leader/Member
- **AI Integration**: Vercel AI SDK (`ai` + `@ai-sdk/*`) — generateText, generateObject, SSE streaming
- **AI Providers**: OpenAI / Anthropic / Google / DeepSeek（通过 Manager 统一配置代理）
- **Agent System**: 客户端 ReAct 循环 + Manager AI 推理端点 + Tauri 本地工具（Shell/File）
- **Manager Backend**: Hono + @hono/node-server (Node.js HTTP API, port 8080)
- **Manager Frontend**: Vue 3 + TypeScript + Vite + Vue Router (port 5180)
- **Storage**: Rust 文件 IO — `~/.envoy/` 目录下（history, teams, users, keys, settings, brains）
- **Auth**: RSA-OAEP 加密传输 + bcrypt 密码哈希 + session token (24h)

## Commands

```bash
# EnvoyClient (Tauri 桌面客户端)
npm run tauri:dev              # 启动 Tauri 桌面应用
npm run build                  # 前端构建
npm run tauri build            # 完整桌面构建

# Manager (管理后台)
npm run manager                # 同时启动后端 (port 8080) + 前端 (port 5180)
npm run manager:server         # 仅启动后端
npm run manager:web            # 仅启动前端
```

## Architecture

### 三层架构

```
┌─────────────────────────────────────────────────────────┐
│                   Manager Backend                       │
│  Hono HTTP API (8080)                                   │
│  ├── Teams API      → Team 实例池 (每团队独立 WS 端口)   │
│  ├── Users API      → 用户注册/认证 (users.json)        │
│  ├── Messages API   → 消息中转 + 任务提交/结果           │
│  ├── AI API         → AI 推理/聊天/分派/分析              │
│  └── Dashboard API  → 全局统计                           │
├─────────────────────────────────────────────────────────┤
│                   Envoy Framework                        │
│  WebSocket Server  → 任务调度 (serial/parallel)          │
│  Leader/Member     → 角色化客户端 (team:join)            │
│  Team              → 成员管理 + 广播 + 角色追踪           │
├─────────────────────────────────────────────────────────┤
│                 Tauri Desktop Client                     │
│  Vue 3 UI          → 聊天/任务中心/任务分派               │
│  ReAct Agent       → 本地 Agent 循环 (max 20 steps)      │
│  Tauri Commands    → shell_exec / file_read / file_write  │
│  History           → ~/.envoy/history/{userId}/{peerId}  │
└─────────────────────────────────────────────────────────┘
```

### 数据存储

| 路径 | 用途 |
|------|------|
| `~/.envoy/history/{userId}/{peerId}.json` | 聊天消息记录 |
| `~/.envoy/teams/{teamName}/meta.json` | 团队配置（成员列表、端口） |
| `~/.envoy/teams/{teamName}/tasks/{taskId}/task.json` | 任务持久化 |
| `~/.envoy/teams/{teamName}/tasks/{taskId}/resources/` | 任务资源文件 |
| `~/.envoy/users.json` | 全局用户账号（bcrypt 哈希） |
| `~/.envoy/keys/` | RSA 密钥对（密码加密传输） |
| `~/.envoy/manager.json` | Manager 设置 + AI 配置 |
| `~/.envoy/settings.json` | 客户端设置 |
| `~/.envoy/brains/{username}/` | 用户 Agent 记忆/技能目录 |

## Business Flows

### 登录与连接流程

1. **认证**: 用户输入用户名/密码/Manager URL
2. **RSA 加密**: 客户端获取 `/api/public-key`，用 RSA-OAEP 加密密码
3. **校验**: POST `/api/auth` 发送加密密码，服务器返回用户 `role` (leader/member)
4. **初始化**: Tauri 环境调用 `init_brains` 创建用户 Agent 记忆目录
5. **获取团队**: GET `/api/teams` 获取可用团队列表
6. **连接**: 用户选择团队 → 构造 `ws://{host}:{port}` → `useTeamClient(role, opts).connect()`
7. **加入**: Leader/Member 自动发送 `team:join` → Team 广播成员列表 → 进入 ChatView

### 聊天流程

1. 用户选择聊天对象 → ChatPanel 显示对话
2. 发送消息: `sendChat(targetId, text)` → 本地立即添加 + POST `/api/messages`
3. Manager 调用 `team.innerServer.relay()` → WebSocket 转发到目标客户端
4. 目标客户端 `client.on("message")` → `useTeamClient` 添加到会话 + 增加未读计数
5. 消息通过 `invoke("save_message")` 持久化到本地文件

### 任务分派流程（手动）

1. Leader 在侧边栏选择"分派任务" → TaskDispatchPanel
2. 选择目标成员 + 输入任务描述
3. `dispatchTask(targetIds, content)` → POST `/api/tasks` (serial mode)
4. Manager 调用 `team.innerServer.submitFrom()` → Task 创建
5. Envoy Server 通过 WebSocket dispatch 到订阅者
6. Member 的 `client.doing()` handler 被触发 → 启动 Agent 执行

### 任务分派流程（AI 智能分派）

1. Leader 输入自然语言任务描述
2. `useAI.dispatchTask(description, members)` → POST `/api/ai/task/dispatch`
3. Manager AI 服务用 `generateObject()` + Zod schema 结构化输出：
   - `subscribe`: 匹配的成员 ID 列表（基于职责匹配）
   - `content`: 优化后的任务描述
4. 返回后自动填充分派面板，Leader 确认后执行手动分派流程

### Agent 执行流程 (ReAct Loop)

1. Member 收到 dispatch 任务 → `useTeamClient` 组装工具集：
   - `shell`: 执行 Shell 命令 (Tauri `shell_exec`)
   - `file_read` / `file_write`: 读写本地文件
   - `upload_resource` / `query_resources` / `read_resource`: 任务资源管理
   - `done`: 完成任务并提交结果
2. `useAgent.runAgent(taskContent, tools)` 启动 ReAct 循环 (max 20 steps)
3. **每一步**:
   - 发送对话历史 + 工具 schema → POST `/api/ai/agent/reason`
   - Manager 将工具定义转为 AI SDK 格式，调用 `generateText()`
   - AI 返回文本结果或工具调用
   - 若有工具调用 → 本地执行（60s 超时）→ 结果追加到历史
   - 若无工具调用 → 作为最终结果返回
4. `done` 工具被调用时 → POST `/api/tasks/{id}/result` 提交结果到 Manager
5. 结果持久化到 `~/.envoy/teams/{team}/tasks/{id}/resources/{memberId}.json`

### AI 聊天辅助

1. 在任意对话中，`useAI.suggestReply(items)` 流式获取回复建议
2. SSE 连接到 `/api/ai/chat/stream`，发送对话历史
3. Manager 调用 AI SDK streaming → 转为标准 SSE 格式
4. 客户端解析 SSE 事件，实时显示建议文本

## Client Operation Process

### 角色选择页面 (`/` → RoleSelect.vue)

1. 输入 Manager URL（默认 `http://localhost:8080`）
2. 输入用户名和密码 → 点击登录
3. 系统显示可用团队下拉列表
4. 选择团队 → 点击"连接"
5. WebSocket 连接建立 → 自动跳转到 `/chat`

### 主界面 (`/chat` → ChatView.vue)

**左侧边栏 (MemberSidebar)**:
- **任务中心**: 查看所有任务（按状态分组：运行中/待执行/已完成/失败）
- **分派任务** (仅 Leader): AI 辅助创建和分派新任务
- **成员列表**: 显示在线/离线状态

**右侧内容区（根据侧边栏选择切换）**:
- **任务中心视图 (TaskCenterView)**: 聚合展示所有任务，按状态分组，显示任务卡片（状态、成员、资源、时间戳）
- **任务分派面板 (TaskDispatchPanel)**: 输入任务描述 → AI 匹配成员 → 预览 → 确认分派
- **聊天面板 (ChatPanel)**: 1:1 对话，支持 Markdown 渲染（marked + DOMPurify），AI 建议回复

## Core Mechanisms

### Envoy 任务调度

- **Serial Mode**: 串行分发，一个成员完成后才发给下一个。当前成员离线则任务失败
- **Parallel Mode**: 并行分发，所有订阅者同时收到，全部完成后任务完成
- **任务生命周期**: created → dispatched → running → completed/failed
- **自动结果发送**: Member 的 `doing()` handler 执行完毕后自动将结果发回 Server
- **客户端离线处理**: 断连时标记为 failed，串行模式跳到下一个，并行模式检查是否还有待响应者

### ReAct Agent

- **Reason + Act 循环**: 客户端运行循环，Manager 提供 AI 推理
- **最大步数**: 20 步
- **超时**: AI 推理 30s，工具执行 60s
- **工具输出截断**: stdout 限制 2000 字符，stderr 限制 1000 字符
- **终止条件**: AI 返回纯文本（无工具调用）或 `done` 工具被调用

### SSE 流式通信

- Manager 将 AI SDK 流转换为标准 SSE: `event: text-delta|tool-call|tool-result|done|error` + `data: JSON\n\n`
- 客户端 `useAI.consumeSSE()` 解析 SSE 事件流，通过回调实时更新 UI

### 认证与安全

- **密码传输**: RSA-OAEP 加密（客户端加密，服务端解密）
- **密码存储**: bcrypt 哈希存储在 `users.json`
- **管理员会话**: session token，24 小时过期
- **文件沙箱**: Tauri `file_read`/`file_write` 限制在 home 目录内，拒绝二进制文件读取

### 浏览器兼容

- `safeInvoke()` 检测 Tauri 环境，浏览器端静默跳过 Rust 调用
- `BrowserTransport.ts` 提供浏览器端 WebSocket Transport 替代 Node.js `ws` 模块

## Key Files

### 前端核心 (`src/`)

| 文件 | 职责 |
|------|------|
| `src/App.vue` | 根组件：TitleBar + router-view，全局 CSS 变量（light/dark 主题） |
| `src/router.ts` | 路由定义：`/` → RoleSelect, `/chat` → ChatView |
| `src/types.ts` | 类型定义：MemberInfo, ChatMessage, TaskMessage, TaskResource, TaskPlan, TimelineItem |
| `src/api.ts` | Manager REST API 封装：setManagerUrl, managerFetch, managerPost |
| `src/envoy/BrowserTransport.ts` | 浏览器兼容 WebSocket Transport |
| `src/composables/useTeamClient.ts` | **核心 composable**: 连接管理、消息收发、任务更新、Agent 任务执行注册 |
| `src/composables/useAI.ts` | AI composable: SSE 流式聊天、任务规划、结果分析、智能分派 |
| `src/composables/useTheme.ts` | 主题切换（dark/light），localStorage 持久化 |
| `src/composables/teamClientContext.ts` | 全局 TeamClient 实例（shallowRef + provide/inject） |
| `src/agent/react.ts` | ReAct Agent 循环：max 20 步，调用 Manager AI 推理 + 本地工具执行 |
| `src/agent/tools.ts` | Agent 工具定义：shell, file_read, file_write, done, upload/query/read_resource |
| `src/views/RoleSelect.vue` | 登录页：RSA 加密认证、团队选择、WebSocket 连接 |
| `src/views/ChatView.vue` | 主布局：三面板（侧边栏 + 任务中心/分派/聊天） |
| `src/views/TaskCenterView.vue` | 任务中心：按状态聚合显示所有任务 |
| `src/views/TaskDispatchPanel.vue` | 任务分派：AI 辅助匹配成员、预览、确认 |
| `src/components/TitleBar.vue` | macOS 风格标题栏：traffic lights + logo + 主题切换 |
| `src/components/MemberSidebar.vue` | 侧边栏：任务中心、分派入口、成员列表（在线/离线） |
| `src/components/ChatPanel.vue` | 聊天面板：消息列表、AI 建议回复、输入控制 |
| `src/components/MessageBubble.vue` | 消息气泡：Markdown 渲染（marked + DOMPurify） |
| `src/components/TaskCard.vue` | 任务卡片：状态徽章、成员、资源、时间戳 |

### Tauri 后端 (`src-tauri/`)

| 文件 | 职责 |
|------|------|
| `src-tauri/src/lib.rs` | Tauri commands：file_read, file_write, shell_exec, save/load/export/import history, settings, init_brains |
| `src-tauri/src/history.rs` | 消息持久化：按用户/对端分 JSON 文件存储 |
| `src-tauri/src/settings.rs` | 客户端设置读写 (`~/.envoy/settings.json`) |
| `src-tauri/src/brains.rs` | 初始化用户 Agent 记忆目录 (`~/.envoy/brains/{username}`) |
| `src-tauri/tauri.conf.json` | 窗口配置：800x600，无装饰，CSP 策略 |
| `src-tauri/brains/` | Agent 记忆模板目录（基础信息/偏好/日志/技能） |

### Manager 后端 (`manager/server/`)

| 文件 | 职责 |
|------|------|
| `manager/server/index.ts` | Hono 入口：CORS、RSA 初始化、Team 恢复、路由注册、任务持久化监听 |
| `manager/server/crypto.ts` | RSA 密钥对生成/加载、加密/解密 |
| `manager/server/settings.ts` | 管理员设置 + AI 配置持久化 (`manager.json`) |
| `manager/server/team-registry.ts` | 团队 CRUD：meta.json 读写、端口分配、目录管理 |
| `manager/server/user-registry.ts` | 用户 CRUD：users.json 读写、bcrypt 认证 |
| `manager/server/routes/admin.ts` | 管理员认证：session token，24h 过期 |
| `manager/server/routes/ai.ts` | AI 路由：health、agent reason、task dispatch、config CRUD |
| `manager/server/routes/teams.ts` | 团队 CRUD、成员管理、任务查询、实时统计 |
| `manager/server/routes/messages.ts` | 消息中转、任务提交/结果、资源上传下载 |
| `manager/server/routes/users.ts` | 用户管理：增删查、RSA 加密密码认证 |
| `manager/server/routes/dashboard.ts` | 仪表盘：全局统计（团队/成员/任务） |
| `manager/server/services/ai/index.ts` | `createAIRoutes()` — AI HTTP 路由挂载 |
| `manager/server/services/ai/provider.ts` | Provider 工厂：OpenAI/Anthropic/Google/DeepSeek → AI SDK model |
| `manager/server/services/ai/stream.ts` | AI stream → SSE 转换器 |
| `manager/server/services/ai/chat.ts` | 聊天补全处理器（SSE streaming） |
| `manager/server/services/ai/task.ts` | 任务生成处理器（generateObject + Zod） |
| `manager/server/services/ai/analyze.ts` | 任务结果分析处理器 |
| `manager/server/services/ai/agent.ts` | Agent 推理处理器：工具定义转换 + generateText |
| `manager/server/services/ai/dispatch.ts` | 智能分派：职责匹配 + generateObject 结构化输出 |
| `manager/server/services/ai/prompts/` | 所有 AI Prompt 模板（chat, task, analyze, agent, dispatch） |

### Manager 前端 (`manager/web/`)

| 文件 | 职责 |
|------|------|
| `manager/web/src/views/Dashboard.vue` | 全局概览：团队数/在线数/任务统计/最近任务 |
| `manager/web/src/views/Teams.vue` | 团队列表 + 创建/删除 |
| `manager/web/src/views/TeamDetail.vue` | 单团队详情：成员表 + 任务表 |
| `manager/web/src/views/Users.vue` | 用户管理：增删查账号 |
| `manager/web/src/views/Settings.vue` | 管理员设置 + AI Provider 配置 |
| `manager/web/src/views/Login.vue` | 管理员登录 |
| `manager/web/src/views/TaskDetail.vue` | 任务详情视图 |

### Envoy 框架 (`envoy/packages/`)

| 文件 | 职责 |
|------|------|
| `envoy/packages/core/message.ts` | 消息协议：9 种 MessageType，序列化/反序列化 |
| `envoy/packages/core/task.ts` | 任务类型：TaskMode (serial/parallel), TaskStatus, Resource |
| `envoy/packages/core/queue.ts` | 通用 FIFO 队列 |
| `envoy/packages/core/event-emitter.ts` | 类型安全事件系统 |
| `envoy/packages/server/server.ts` | Server：任务调度（串行/并行）、消息中转、心跳、客户端追踪 |
| `envoy/packages/server/connection-manager.ts` | 客户端状态管理 + 心跳超时 |
| `envoy/packages/client/client.ts` | Client：doing() 注册处理器、submit() 提交任务、串行任务队列、自动结果发送 |
| `envoy/packages/client/watcher-client.ts` | Watcher 客户端：观察任务和客户端事件 |
| `envoy/packages/teams/team.ts` | Team：封装 Server，角色管理，成员广播 |
| `envoy/packages/teams/leader.ts` | Leader：Client 子类，team:join(role=leader) |
| `envoy/packages/teams/member.ts` | Member：Client 子类，team:join(role=member) |

### 共享类型 (`shared/`)

| 文件 | 职责 |
|------|------|
| `shared/types/ai.ts` | AI 类型：ProviderType, ChatRequest, TaskPlan, AgentMessage |
| `shared/types/sse.ts` | SSE 事件类型：TextDelta, ToolCall, ToolResult, Done, Error |

## Style Rules

### TypeScript 类型安全

- **禁止使用 `any` 类型**，必须使用具体的类型或 `unknown` 配合类型守卫
- 函数参数和返回值必须有明确的类型声明
- `catch (e)` 中使用 `e: unknown`，通过 `e instanceof Error ? e.message : String(e)` 提取错误信息
- 从动态数据（JSON 解析、API 响应）获取的值使用 `as` 类型断言或类型守卫进行收窄
- 工具函数参数（如 `Record<string, unknown>`）在 execute 内部用 `as string` 等断言转换

### Dark/Light Mode

项目使用 CSS 变量实现主题切换，定义在 `App.vue` 的 `:root` 和 `html.dark` 中。

**所有更改或新增的样式必须包含双色逻辑：**
1. 使用 CSS 变量（`var(--xxx)`）而非硬编码颜色值
2. 如果现有变量不够用，在 `App.vue` 的 `:root` 和 `html.dark` 中同时添加新变量
3. 绝不允许写只有亮色或只有暗色的样式

变量命名规范：
```
--bg-*          背景色
--text-*        文字色
--border-*      边框色
--accent        主强调色
--task-*        任务卡片相关
--bubble-*      聊天气泡
--role-*        角色标签
--sidebar-*     侧边栏
--titlebar-*    标题栏
--error         错误色
```

### Theme Toggle

使用 `useTheme()` composable，通过 `html.dark` class 切换。用户偏好保存在 `localStorage` key `envoy-theme`，默认 dark。

### 危险操作二次确认

所有不可逆或高风险操作必须执行前弹窗二次确认（`confirm()` 或自定义确认弹窗），用户明确同意后才执行。适用范围包括但不限于：
- 退出登录 / 断开连接
- 删除用户、团队、成员
- 清空聊天记录 / 历史导出覆盖
- 取消/终止正在运行的任务

确认文案必须清楚说明操作后果（如 `确定要删除团队 "xxx" 吗？此操作不可恢复`）。
