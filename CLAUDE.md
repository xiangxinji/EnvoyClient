# CLAUDE.md

## Project Overview

EnvoyClient 是一个基于 Tauri 2 + Vue 3 的 **团队 AI Agent 协作桌面客户端**。使用自研 Envoy 框架进行 WebSocket 实时通信，支持 Leader/Member 角色区分，微信风格聊天界面（消息撤回、AI 自动回复、文件下载），手动与 AI 智能任务分派，以及本地 ReAct Agent 自主执行任务。任务完成后支持 Reviewing 工作流（Leader 手动/AI 自动审批）。项目还包含 Manager 管理后台（Hono HTTP API + Vue 3 Web），支持多团队创建、用户管理、AI 配置（per-scene model preset）和仪表盘。所有 AI 能力（聊天、任务分派、Agent 推理、自动回复、任务审批）通过 Manager 统一代理，支持 OpenAI/Anthropic/Google/DeepSeek 多 Provider。客户端支持桌面通知、成员个性化设置（执行模式、AI 自动回复、工作目录）和完整登出流程。

## Tech Stack

- **Client Frontend**: Vue 3 + TypeScript + Vite + Vue Router (hash mode)
- **Desktop Runtime**: Tauri 2 (Rust backend) — 文件 IO、Shell 执行、消息持久化、桌面通知、原生保存对话框
- **Communication**: Envoy 框架 (WebSocket, Git submodule `envoy/`) — Server/Client/Team/Leader/Member
- **AI Integration**: Vercel AI SDK (`ai` + `@ai-sdk/*`) — generateText, generateObject, SSE streaming
- **AI Providers**: OpenAI / Anthropic / Google / DeepSeek（通过 Manager 统一配置代理）
- **AI Scenes**: chat / task / analyze / agent / dispatch / review / auto-reply（per-scene model preset + temperature + maxTokens）
- **Agent System**: 客户端 ReAct 循环 + Manager AI 推理端点 + Tauri 本地工具（Shell/File）+ Skill Catalog
- **Manager Backend**: Hono + @hono/node-server (Node.js HTTP API, port 8080)
- **Manager Frontend**: Vue 3 + TypeScript + Vite + Vue Router (port 5180)
- **Storage**: Rust 文件 IO + SQLite (better-sqlite3) — `~/.envoy/` 目录下（history, teams, users, keys, settings, brains）
- **Auth**: RSA-OAEP 加密传输 + bcrypt 密码哈希 + session token (24h)
- **Notifications**: @tauri-apps/plugin-notification — 任务状态变化桌面通知
- **File Dialogs**: @tauri-apps/plugin-dialog — 原生保存对话框（文件下载）

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
│  ├── Messages API   → 消息中转/撤回/同步 + 任务提交/结果  │
│  ├── AI API         → AI 推理/聊天/分派/分析/审批/自动回复│
│  └── Dashboard API  → 全局统计                           │
│  Storage: SQLite (better-sqlite3) + JSON files          │
├─────────────────────────────────────────────────────────┤
│                   Envoy Framework                        │
│  WebSocket Server  → 任务调度 (serial/parallel)          │
│  Leader/Member     → 角色化客户端 (team:join)            │
│  Team              → 成员管理 + 广播 + 角色追踪           │
│  Task Reviewing    → 串行任务完成后 Leader 审批/驳回      │
├─────────────────────────────────────────────────────────┤
│                 Tauri Desktop Client                     │
│  Vue 3 UI          → 聊天/任务中心/任务分派/设置面板      │
│  ReAct Agent       → 本地 Agent 循环 (max 20 steps)      │
│  Tauri Commands    → shell_exec / file_read / file_write  │
│                    → save_binary_file / load_skill_catalog│
│  History           → ~/.envoy/history/{userId}/{peerId}  │
│  Notifications     → 桌面通知 (任务状态变化)              │
│  Member Settings   → 执行模式/AI自动回复/工作目录         │
└─────────────────────────────────────────────────────────┘
```

### 数据存储

| 路径 | 用途 |
|------|------|
| `~/.envoy/history/{userId}/{peerId}.json` | 聊天消息记录（本地持久化） |
| `~/.envoy/teams/{teamName}/meta.json` | 团队配置（成员列表、端口） |
| `~/.envoy/teams/{teamName}/db/team.db` | SQLite 数据库（消息、任务） |
| `~/.envoy/teams/{teamName}/tasks/{taskId}/task.json` | 任务持久化 |
| `~/.envoy/teams/{teamName}/tasks/{taskId}/resources/` | 任务资源文件 |
| `~/.envoy/users.json` | 全局用户账号（bcrypt 哈希） |
| `~/.envoy/keys/` | RSA 密钥对（密码加密传输） |
| `~/.envoy/manager.json` | Manager 设置 + AI 配置（presets + scenes） |
| `~/.envoy/settings.json` | 客户端设置 + per-user 成员设置 |
| `~/.envoy/brains/{username}/` | 用户 Agent 记忆/技能目录 |
| `~/.envoy/brains/{username}/skills/` | Agent 技能目录（Skill Catalog） |

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
2. 消息同步: 连接时调用 `GET /api/messages/sync` 拉取离线消息
3. 发送消息: `sendChat(targetId, text)` → 本地立即添加 + POST `/api/messages`
4. Manager 存入 SQLite → `team.innerServer.relay()` → WebSocket 转发到目标客户端
5. 目标客户端 `client.on("message")` → `useMessages` 添加到会话 + 增加未读计数
6. 消息通过 `invoke("save_message")` 持久化到本地文件
7. 若开启 AI 自动回复 → 5s 防抖后自动生成并发送 AI 回复（`source: "ai-auto"`）

### 综合频道（群聊）流程

1. **虚拟 Peer**: 使用 `"__team__"` 作为虚拟 peer ID，侧边栏固定入口，当前频道名为 `"general"`
2. **发送**: `sendChat("__team__", text, { channel: "general", mentions })` — 不指定 `to`，由服务端设置 `to_user = "__team__"`
3. **服务端广播**: Manager 检测到 `body.channel` → 调用 `team.broadcastChat()` 遍历所有在线角色，逐个 `relay()` 跳过发送者
4. **接收路由**: 客户端 `handleIncomingMessage` 检测 `payload.channel` → 路由到 `"__team__"` 会话桶
5. **离线同步**: SQLite `queryMessages()` 使用 `channel = 'general'` 条件，所有用户同步时都能拉到频道消息
6. **@提及**: 频道模式输入 `@` 触发 MentionPopup（含 `@all` 选项），选中后记入 `currentMentions`；发送后服务端向被提及者发送 `channel-mention` 通知 → 桌面通知
7. **UI 差异**: 频道模式每条消息显示发送者头像和昵称，气泡更宽，支持 `@mention` 高亮渲染
8. **撤回**: 频道消息撤回通过 `team.broadcastChat()` 广播 `chat-revoke` 子类型
9. **自动回复跳过**: 频道消息不触发 AI 自动回复（`if (payload.channel) return`）

### 消息引用（Quote/Reply）流程

1. 用户右键消息 → 上下文菜单选择"引用" → 设置 `quotingMsg` ref → 编辑器上方显示引用预览条
2. 生成快照文本 `generateSnapshotText(msg)`：截取原文前 100 字符，图片/文件/转发消息使用占位文案
3. 发送时构建 `QuoteInfo { id, from, text, timestamp }` → 通过 `sendChat` 的 `quote` 字段传递
4. 服务端存入 SQLite `extra.quote` JSON 字段 + WebSocket payload 转发
5. 接收端渲染为 `.quote-card`：显示引用者昵称 + 快照文本
6. **点击跳转**: 点击引用卡片 → `scrollToQuote(id)` → 定位到原始消息 + 高亮动画（1.5s 脉冲）
7. **撤回检测**: `isQuoteRevoked` 检查被引消息是否已撤回，已撤回则显示占位文案 + 淡化样式

### 消息转发流程

1. 用户通过头部下拉菜单"多选"或右键菜单"转发"进入多选模式（`selectMode`）
2. 点击消息气泡的圆形复选框切换选中状态（`selectedIds: Set<string>`）
3. 底部操作栏显示选中数量 + "转发"按钮 → 打开 ForwardDialog 选择目标成员
4. 确认后构建 `ForwardedRecord[]`（包含每条消息的 from/text/timestamp/attachments）
5. 以摘要文本 `"聊天记录 (N)"` 作为消息正文，`forwarded` 字段携带记录数组 → `sendChat(targetId, summary, { forwarded: records })`
6. 服务端存入 SQLite `extra.forwarded` + WebSocket 转发
7. 接收端渲染：隐藏正文，显示可点击的转发摘要条 → 点击展开详情弹窗（逐条显示原始发送者、时间、文本、附件）
8. 转发完成后退出多选模式 + 成功 Toast

### 消息撤回流程

1. 用户点击自己发送的消息的撤回按钮
2. `revokeMessage(id)` → DELETE `/api/messages/{id}?from={userId}`
3. Manager 验证发送者身份 → 从 SQLite 删除 → 1:1 消息通过 `relay()`、频道消息通过 `broadcastChat()` 发送 `chat-revoke` 子类型
4. 本地和接收端将 timeline 中的消息替换为 `RevokedNotice`（显示"消息已撤回"）

### AI 自动回复流程

1. 用户在成员设置面板开启 `ai_auto_reply`
2. 收到聊天消息时，`useAutoReply.trigger(peerId, historyCount)` 启动 5s 防抖计时器
3. 计时到期后 `generateReply()` → 获取对话历史 → POST `/api/ai/auto-reply/generate`
4. Manager 使用 `"auto-reply"` scene 调用 AI，模拟用户口吻生成回复
5. 自动调用 `sendChat()` 发送，消息标记 `source: "ai-auto"`
6. 接收端显示 "AI auto reply" 徽章

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

1. Member 收到 dispatch 任务 → `useTaskExecution.registerHandler(client)` 被触发
2. 检查执行模式：`auto` → 自动执行，`manual` → 等待用户手动触发（返回 `SKIP_RESULT`）
3. 自动执行时，组装工具集 + 从 `load_skill_catalog` 加载技能目录：
   - `shell`: 执行 Shell 命令 (Tauri `shell_exec`)，工作目录取自成员设置
   - `file_read` / `file_write`: 读写本地文件
   - `upload_resource` / `query_resources` / `read_resource`: 任务资源管理
   - `done`: 完成任务并提交结果
4. POST `/api/tasks/{id}/start` 将任务状态转为 running
5. `useAgent.runAgent(taskContent, tools)` 启动 ReAct 循环 (max 20 steps)
6. **每一步**:
   - 发送对话历史 + 工具 schema → POST `/api/ai/agent/reason`
   - Manager 将工具定义转为 AI SDK 格式，调用 `generateText()`
   - AI 返回文本结果或工具调用
   - 若有工具调用 → 本地执行（60s 超时）→ 结果追加到历史
   - 若无工具调用 → 作为最终结果返回
7. `done` 工具被调用时 → POST `/api/tasks/{id}/result` 提交结果 + 执行 trace 到 Manager
8. 结果持久化到 `~/.envoy/teams/{team}/tasks/{id}/resources/{memberId}.json`

### 任务 Reviewing 工作流

1. 串行任务所有 Member 完成后，Envoy Server 将任务状态设为 `"reviewing"`
2. 任务自动 dispatch 回 Leader
3. Leader 端 `useTaskExecution` 检测到 reviewing 状态：
   - **Auto 模式**: 调用 `ai.reviewTaskResult()` → POST `/api/ai/task/review`（AI 使用 `generateObject` + Zod 判断 `{ success, summary }`）
   - **Manual 模式**: 在 TaskDetailPanel 中手动审批
4. 审批通过 → POST `/api/tasks/{id}/result` (success: true) → 任务 completed
5. 审批驳回 → POST `/api/tasks/{id}/result` (success: false) → Server 调用 `resetForRetry()` 重新分派给所有 Member

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
- **任务中心**: 查看所有任务（按状态分组：运行中/待执行/审核中/已完成/失败）
- **分派任务** (仅 Leader): AI 辅助创建和分派新任务
- **成员列表**: 显示在线/离线状态
- **设置**: 成员个性化设置（执行模式、AI 自动回复、工作目录）

**右侧内容区（根据侧边栏选择切换）**:
- **任务中心视图 (TaskCenterView)**: 聚合展示所有任务，按状态分组，显示任务卡片（状态、成员、资源、时间戳）
- **任务详情面板 (TaskDetailPanel)**: 任务 timeline、成员执行结果、Agent trace、Leader 审批、资源文件下载
- **任务分派面板 (TaskDispatchPanel)**: 输入任务描述 → AI 匹配成员 → 预览 → 确认分派
- **聊天面板 (ChatPanel)**: 1:1 对话，支持 Markdown 渲染（marked + DOMPurify），AI 建议回复，消息撤回，文件下载
- **设置面板 (SettingsPanel)**: 分组配置（个人资料 / 任务与 Agent / AI 助手 / 通用），包含任务执行模式、工作目录、AI 自动回复、AI 建议历史条数、语言切换、登出

## Core Mechanisms

### Envoy 任务调度

- **Serial Mode**: 串行分发，一个成员完成后才发给下一个。当前成员离线则任务失败
- **Parallel Mode**: 并行分发，所有订阅者同时收到，全部完成后任务完成
- **任务生命周期**: created → dispatched → running → reviewing(仅串行) → completed/failed
- **Reviewing 阶段**: 串行任务所有成员完成后进入 reviewing，dispatch 回 Leader 审批。Leader 离线则强制完成。驳回触发 `resetForRetry()` 重新分派
- **自动结果发送**: Member 的 `doing()` handler 执行完毕后自动将结果发回 Server
- **客户端离线处理**: 断连时标记为 failed，串行模式跳到下一个，并行模式检查是否还有待响应者
- **桌面通知**: 任务 dispatch/完成/reviewing 时通过 `@tauri-apps/plugin-notification` 发送 OS 通知

### ReAct Agent

- **Reason + Act 循环**: 客户端运行循环，Manager 提供 AI 推理
- **执行入口**: `useTaskExecution.registerHandler(client)` 注册 doing handler，区分 auto/manual 模式
- **Skill Catalog**: 启动时通过 `load_skill_catalog(username)` 加载 `~/.envoy/brains/{username}/skills/`
- **工作目录**: Shell 工具的 cwd 取自成员设置 `working_directory`
- **最大步数**: 20 步
- **超时**: AI 推理 30s，工具执行 60s
- **工具输出截断**: stdout 限制 2000 字符，stderr 限制 1000 字符
- **终止条件**: AI 返回纯文本（无工具调用）或 `done` 工具被调用
- **执行 Trace**: 每步的输入输出记录在 `ExecutionTraceData` 中，随结果一起提交

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
- `downloadFileWithDialog()` 在浏览器端降级为 `<a>` download

### AI Scene / Model 映射

- **8 个 AI Scene**: `chat` | `task` | `analyze` | `agent` | `dispatch` | `review` | `auto-reply`
- 每个 scene 可映射到不同的 model preset（provider + model + apiKey）
- 每个 scene 可独立配置 `temperature` 和 `maxTokens`
- `resolveForScene(sceneType)` 查找 scene 配置 → 找到 preset → fallback 到默认 preset
- 配置存储在 `manager.json` 的 `presets` 和 `scenes` 字段

### 成员设置 (Member Settings)

- **存储**: `~/.envoy/settings.json` 的 `users[username]` 路径下，通过 Tauri `get_settings`/`save_settings` 读写
- **task_execution_mode**: `"auto"`（AI 自动处理任务）或 `"manual"`（用户手动触发）
- **ai_auto_reply**: 布尔值，开启后收到消息 5s 防抖自动生成 AI 回复
- **working_directory**: Agent shell 执行的根目录
- **ai_suggestion_history_count**: AI 回复建议上下文消息数（1-50，默认 5）

## Key Files

### 前端核心 (`src/`)

| 文件 | 职责 |
|------|------|
| `src/App.vue` | 根组件：TitleBar + router-view（page transition 动画），全局 CSS 变量（light/dark 主题） |
| `src/router.ts` | 路由定义：`/` → RoleSelect, `/chat` → ChatView |
| `src/types.ts` | 类型定义：MemberInfo, ChatMessage(channel/mentions/quote/forwarded), QuoteInfo, ForwardedRecord, MessageAttachment, TaskMessage, TaskResource, TaskPlan, TimelineItem, RevokedNotice, AgentStep, AgentResult, ExecutionTraceData, TaskExecutionMode, MemberSettings |
| `src/api.ts` | Manager REST API 封装：setManagerUrl, managerFetch, managerPost |
| `src/envoy/BrowserTransport.ts` | 浏览器兼容 WebSocket Transport |
| `src/composables/useTeamClient.ts` | **核心 composable**: 连接管理、消息收发、任务更新、auto-reply 集成、桌面通知、频道提及通知 |
| `src/composables/useMessages.ts` | 消息管理 composable：消息收发、撤回、离线同步、频道消息路由（`__team__` 桶）、引用/转发字段处理 |
| `src/composables/useAI.ts` | AI composable: SSE 流式聊天、任务规划、结果分析、智能分派、任务审批 |
| `src/composables/useAutoReply.ts` | AI 自动回复 composable：5s 防抖、调用 Manager auto-reply API、发送 AI 生成消息 |
| `src/composables/useMemberSettings.ts` | 成员设置 composable：per-user 设置读写（执行模式、AI 自动回复、工作目录） |
| `src/composables/useTaskExecution.ts` | 任务执行 composable：doing handler 注册、auto/manual 分发、Leader review/Member execution |
| `src/composables/useTheme.ts` | 主题切换（dark/light），localStorage 持久化 |
| `src/composables/teamClientContext.ts` | 全局 TeamClient 实例（shallowRef + provide/inject）+ getMemberSettings/setTeamClientInstance |
| `src/agent/react.ts` | ReAct Agent 循环：max 20 步，调用 Manager AI 推理 + 本地工具执行 |
| `src/agent/tools.ts` | Agent 工具定义：shell, file_read, file_write, done, upload/query/read_resource |
| `src/utils/notification.ts` | 桌面通知 + 文件下载：sendDesktopNotification, downloadFileWithDialog |
| `src/views/RoleSelect.vue` | 登录页：RSA 加密认证、团队选择、WebSocket 连接 |
| `src/views/ChatView.vue` | 主布局：三面板（侧边栏 + 任务中心/分派/聊天/设置/任务详情） |
| `src/views/TaskCenterView.vue` | 任务中心：按状态聚合显示所有任务（含 reviewing 分组） |
| `src/views/TaskDispatchPanel.vue` | 任务分派：AI 辅助匹配成员、预览、确认 |
| `src/components/TitleBar.vue` | macOS 风格标题栏：traffic lights + logo + 主题切换 |
| `src/components/MemberSidebar.vue` | 侧边栏：工具区（云端资源/任务中心/分派）、频道入口（`__team__`）、成员列表（在线/离线）、设置入口 |
| `src/components/ChatPanel.vue` | 聊天面板：消息列表、AI 建议回复、输入控制、文件附件下载、图片查看器、@提及弹窗、引用预览条、多选转发、上下文菜单 |
| `src/components/MessageBubble.vue` | 消息气泡：Markdown 渲染、撤回按钮、AI auto reply 徽章、附件卡片、频道布局（头像+发送者）、引用卡片（点击跳转+高亮）、转发摘要+详情弹窗、@mention 高亮 |
| `src/components/TaskCard.vue` | 任务卡片：状态徽章、成员、资源、时间戳 |
| `src/components/TaskDetailPanel.vue` | 任务详情面板：timeline、成员结果、Agent trace、Leader 审批、资源下载、操作按钮 |
| `src/components/SettingsPanel.vue` | 成员设置面板：分组展示（个人资料 / 任务与 Agent / AI 助手 / 通用），含执行模式、工作目录、AI 自动回复、建议历史条数、语言、登出 |
| `src/components/GlassButton.vue` | 基础按钮控件：default/primary/danger 变体，36px，毛玻璃样式 |
| `src/components/GlassSelect.vue` | 基础下拉选择控件：36px，毛玻璃样式 |
| `src/components/GlassCheckbox.vue` | 基础复选框控件：36px，毛玻璃样式 |
| `src/components/BackButton.vue` | 通用返回按钮：左箭头 + 文字，用于面板头部导航 |
| `src/components/MentionPopup.vue` | @提及选择弹窗：成员列表 + `@all` 选项，键盘导航（Arrow/Enter/Escape） |
| `src/components/ForwardDialog.vue` | 转发目标选择对话框：成员列表（排除当前对话），单选确认 |

### Tauri 后端 (`src-tauri/`)

| 文件 | 职责 |
|------|------|
| `src-tauri/src/lib.rs` | Tauri commands：file_read, file_write, shell_exec, save_binary_file, load_skill_catalog, save/load/export/import history, settings, init_brains |
| `src-tauri/src/history.rs` | 消息持久化：按用户/对端分 JSON 文件存储 |
| `src-tauri/src/settings.rs` | 客户端设置读写 (`~/.envoy/settings.json`) |
| `src-tauri/src/brains.rs` | 初始化用户 Agent 记忆目录 (`~/.envoy/brains/{username}`) |
| `src-tauri/tauri.conf.json` | 窗口配置：800x600，无装饰，CSP 策略 |
| `src-tauri/capabilities/default.json` | Tauri 权限：notification:default, dialog:default |
| `src-tauri/brains/` | Agent 记忆模板目录（基础信息/偏好/日志/技能） |

### Manager 后端 (`manager/server/`)

| 文件 | 职责 |
|------|------|
| `manager/server/index.ts` | Hono 入口：CORS、RSA 初始化、Team 恢复、路由注册、任务持久化监听 |
| `manager/server/crypto.ts` | RSA 密钥对生成/加载、加密/解密 |
| `manager/server/db.ts` | SQLite 数据库操作 (better-sqlite3)：消息增删查、附件存储、channel/mentions 列 + extra JSON 字段（quote/forwarded） |
| `manager/server/settings.ts` | 管理员设置 + AI 配置持久化 (`manager.json`) + resolveForScene scene/preset 解析 |
| `manager/server/team-registry.ts` | 团队 CRUD：meta.json 读写、端口分配、目录管理 |
| `manager/server/user-registry.ts` | 用户 CRUD：users.json 读写、bcrypt 认证 |
| `manager/server/routes/admin.ts` | 管理员认证：session token，24h 过期 |
| `manager/server/routes/ai.ts` | AI 路由：health、agent reason、task dispatch、auto-reply generate、task review、config CRUD |
| `manager/server/routes/teams.ts` | 团队 CRUD、成员管理、任务查询、实时统计 |
| `manager/server/routes/messages.ts` | 消息中转/撤回/同步/对话列表、频道广播（broadcastChat）、@提及通知（channel-mention）、任务提交/结果、附件上传下载、资源管理 |
| `manager/server/routes/users.ts` | 用户管理：增删查、RSA 加密密码认证 |
| `manager/server/routes/dashboard.ts` | 仪表盘：全局统计（团队/成员/任务） |
| `manager/server/services/ai/index.ts` | `createAIRoutes()` — AI HTTP 路由挂载 |
| `manager/server/services/ai/provider.ts` | Provider 工厂：OpenAI/Anthropic/Google/DeepSeek → AI SDK model |
| `manager/server/services/ai/stream.ts` | AI stream → SSE 转换器 |
| `manager/server/services/ai/chat.ts` | 聊天补全处理器（SSE streaming）+ 自动回复生成处理器 |
| `manager/server/services/ai/task.ts` | 任务生成处理器（generateObject + Zod） |
| `manager/server/services/ai/analyze.ts` | 任务结果分析处理器 |
| `manager/server/services/ai/agent.ts` | Agent 推理处理器：工具定义转换 + generateText |
| `manager/server/services/ai/dispatch.ts` | 智能分派：职责匹配 + generateObject 结构化输出 |
| `manager/server/services/ai/review.ts` | 任务审批处理器：generateObject + Zod `{ success, summary }` |
| `manager/server/services/ai/prompts/` | 所有 AI Prompt 模板（chat, task, analyze, agent, dispatch, review, auto-reply） |

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
| `envoy/packages/core/task.ts` | 任务类型：TaskMode (serial/parallel), TaskStatus (含 reviewing), Resource |
| `envoy/packages/core/queue.ts` | 通用 FIFO 队列 |
| `envoy/packages/core/event-emitter.ts` | 类型安全事件系统 |
| `envoy/packages/server/server.ts` | Server：任务调度（串行/并行）、消息中转、心跳、客户端追踪、reviewing 状态管理 |
| `envoy/packages/server/connection-manager.ts` | 客户端状态管理 + 心跳超时 |
| `envoy/packages/client/client.ts` | Client：doing() 注册处理器、submit() 提交任务、串行任务队列、自动结果发送 |
| `envoy/packages/client/watcher-client.ts` | Watcher 客户端：观察任务和客户端事件 |
| `envoy/packages/teams/team.ts` | Team：封装 Server，角色管理，成员广播，`broadcastChat()` 频道消息广播 |
| `envoy/packages/teams/leader.ts` | Leader：Client 子类，team:join(role=leader) |
| `envoy/packages/teams/member.ts` | Member：Client 子类，team:join(role=member) |

### 共享类型 (`shared/`)

| 文件 | 职责 |
|------|------|
| `shared/types/ai.ts` | AI 类型：ProviderType, SceneType, SceneConfig, ModelPreset, AIConfig, ChatRequest, TaskPlan, AgentMessage |
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
--task-*        任务卡片相关（含 --task-reviewing-*）
--bubble-*      聊天气泡
--role-*        角色标签
--sidebar-*     侧边栏
--titlebar-*    标题栏
--error         错误色
--warning       警告色（橙色系列）
--warning-bg    警告背景色
--warning-border 警告边框色
--glass-*       毛玻璃效果系列
--overlay-bg    模态遮罩背景
--app-gradient  应用主背景渐变
```

### Glass Design System (毛玻璃设计系统)

项目采用统一的毛玻璃设计语言。所有面板、卡片、对话框和通知组件必须遵循以下规范。

#### 玻璃层级

| 层级 | 变量 | 用途 | 典型组件 |
|------|------|------|---------|
| Light | `--glass-bg-light` (55% opacity) | 轻量背景，嵌套在 glass 容器内的子元素 | RichEditor, TaskInput, MemberChip |
| Standard | `--glass-bg` (72% opacity) | 标准玻璃面板、卡片 | TaskCard, MessageBubble(他人), Sidebar, AIPanel, DispatchPreview |
| Heavy | `--glass-bg-heavy` (85% opacity) | 结构性元素，需要更高可读性 | TitleBar, Header, InputArea, Dialog, Toast, LoginCard |

#### 标准毛玻璃三件套

需要毛玻璃效果的元素必须同时包含这三个属性：

```css
background: var(--glass-bg);       /* 或 --glass-bg-heavy / --glass-bg-light */
backdrop-filter: blur(var(--glass-blur));
-webkit-backdrop-filter: blur(var(--glass-blur));  /* Safari 必需 */
border: 1px solid var(--glass-border);
```

#### 玻璃阴影

| 变量 | 用途 |
|------|------|
| `--glass-shadow` | 卡片、下拉菜单、Toast |
| `--glass-shadow-heavy` | 对话框、登录卡片 |

#### 组件分类规则

**结构面板**（Heavy glass）— TitleBar, Sidebar, 各 View 的 Header 区域
**内容区域**（Transparent background）— 面板根容器使用 `background: transparent`，让应用渐变透出
**卡片/浮层**（Standard glass + blur）— TaskCard, MessageBubble, AI 面板, 预览卡
**表单控件**（Light glass，无 blur）— 嵌套在已有 blur 容器内，只需半透明背景
**对话框/弹窗**（Heavy glass + heavy shadow + overlay）— ConfirmDialog, CloseConfirmDialog
**Toast**（Heavy glass + standard shadow）— 保持轻量，边框颜色区分类型

#### 应用背景

```css
/* html, body 使用渐变背景，这是玻璃效果可见的前提 */
background: var(--app-gradient);
```

禁止在面板根容器使用 `--bg-primary` 等纯色背景——会遮盖渐变，导致玻璃效果失效。

#### 禁忌

1. **禁止硬编码 rgba 颜色** — 使用 `var(--glass-*)`, `var(--overlay-bg)`, `var(--warning-*)` 等变量
2. **禁止遗漏 `-webkit-backdrop-filter`** — Safari 不支持无前缀版本
3. **禁止在玻璃元素上使用 `overflow: hidden`** — 会裁切 backdrop-filter 效果
4. **禁止纯色背景覆盖渐变** — 面板根容器必须是 `transparent`
5. **禁止新增组件不遵循玻璃规范** — 所有新 UI 必须按上述分类选择对应层级

### 基础控件封装规范

所有基础表单控件（input、select、checkbox、button 等）必须封装为独立组件（`src/components/Glass*.vue`），不允许在页面中直接使用原生元素或各自定义样式。

**已有组件**：`GlassButton.vue`（default/primary/danger 变体）、`GlassSelect.vue`、`GlassCheckbox.vue`

**统一尺寸**：
```css
height: 36px;
box-sizing: border-box;
padding: 0 14px;
```

**新增控件时**：先在 `src/components/` 下创建 `GlassXxx.vue` 组件，遵循毛玻璃设计系统，页面中引用组件而非原生元素。

### Theme Toggle

使用 `useTheme()` composable，通过 `html.dark` class 切换。用户偏好保存在 `localStorage` key `envoy-theme`，默认 dark。

### 危险操作二次确认

所有不可逆或高风险操作必须执行前弹窗二次确认（`confirm()` 或自定义确认弹窗），用户明确同意后才执行。适用范围包括但不限于：
- 退出登录 / 断开连接
- 删除用户、团队、成员
- 清空聊天记录 / 历史导出覆盖
- 取消/终止正在运行的任务
- 消息撤回（不可恢复）
- 任务审批驳回（触发重新分派给所有 Member）

确认文案必须清楚说明操作后果（如 `确定要删除团队 "xxx" 吗？此操作不可恢复`）。
