# EnvoyClient 项目流程图

> 使用 Mermaid 语法，可在 GitHub / VS Code (Mermaid Preview) / Typora 等工具中直接渲染。

---

## 1. 系统架构总览

```mermaid
graph TB
    subgraph Client["Tauri 桌面客户端"]
        UI["Vue 3 UI<br/>ChatView / ChatPanel"]
        Agent["ReAct Agent<br/>react.ts"]
        Tools["Tauri Tools<br/>shell / file_read / file_write"]
    end

    subgraph Manager["Manager 管理后台"]
        API["Hono HTTP API<br/>:8080"]
        AI["AI Service<br/>OpenAI / Anthropic / Google / DeepSeek"]
        TeamPool["Team 实例池<br/>每团队独立 WS 端口"]
    end

    subgraph Envoy["Envoy Framework"]
        WS["WebSocket Server"]
        Leader["Leader Client"]
        Member["Member Client"]
    end

    UI -->|"REST API"| API
    Agent -->|"POST /api/ai/agent/reason"| AI
    Agent -->|"invoke()"| Tools
    UI -->|"useTeamClient"| Leader
    UI -->|"useTeamClient"| Member
    Leader -->|"WebSocket"| WS
    Member -->|"WebSocket"| WS
    API --> TeamPool
    TeamPool --> WS
    API --> AI
```

---

## 2. 登录与连接流程

```mermaid
sequenceDiagram
    participant U as 用户
    participant RS as RoleSelect.vue
    participant M as Manager API
    participant TC as useTeamClient
    participant WS as Team WebSocket

    U->>RS: 输入用户名/密码/Manager URL
    RS->>M: GET /api/public-key
    M-->>RS: RSA 公钥
    RS->>RS: RSA-OAEP 加密密码
    RS->>M: POST /api/auth { encrypted password }
    M-->>RS: { role, token }
    RS->>RS: 保存 token / Tauri 持久化 / init_brains

    RS->>M: GET /api/teams
    M-->>RS: 团队列表 (含端口)
    U->>RS: 选择团队
    RS->>TC: useTeamClient(role, opts)
    TC->>WS: ws://{host}:{port}
    TC->>WS: team:join { role }
    WS-->>TC: team:members (成员列表广播)
    TC->>RS: 连接成功
    RS->>RS: router.push("/chat")
```

---

## 3. 聊天消息流程

```mermaid
sequenceDiagram
    participant A as 用户A
    participant CP as ChatPanel.vue
    participant M as Manager API
    participant S as Envoy Server
    participant B as 用户B Client

    A->>CP: 输入消息 + 附件
    CP->>M: POST /api/messages/attachments (图片)
    M-->>CP: { url, name, size }
    CP->>M: POST /api/messages { from, to, text, attachments }
    M->>M: insertMessage() → SQLite
    M->>S: team.innerServer.relay(from, to, "chat", payload)
    S->>B: WebSocket "message" { subtype: "chat" }
    B->>B: handleIncomingMessage() → 添加到会话 + 未读计数++
    M-->>CP: { id, seq } → 本地添加到会话

    Note over CP,B: AI 建议回复
    A->>CP: 点击 AI 建议
    CP->>M: POST /api/ai/chat/stream (SSE)
    M->>M: AI SDK streaming
    loop SSE events
        M-->>CP: event: text-delta { data }
    end
    M-->>CP: event: done
    A->>CP: 接受建议 → 填入输入框
```

---

## 4. 任务分派流程（手动 + AI 智能分派）

```mermaid
flowchart TD
    Start([Leader 输入任务描述]) --> Choice{分派方式?}

    Choice -->|手动选择成员| Manual[选择目标成员]
    Choice -->|AI 智能匹配| AI[POST /api/ai/task/dispatch]

    AI --> AIResult[AI 返回:<br/>subscribe: 成员ID列表<br/>content: 优化后描述]
    AIResult --> Preview[预览 AI 分派结果]
    Preview --> Confirm{Leader 确认?}
    Confirm -->|取消| Start
    Confirm -->|确认| Dispatch

    Manual --> Dispatch[POST /api/tasks<br/>{ from, content, subscribe, mode }]

    Dispatch --> Server[Team Server.submitFrom]
    Server --> TaskCreated[创建 Task → status: pending]
    TaskCreated --> Mode{TaskMode?}

    Mode -->|Serial| Serial[dispatch → subscribe 第1人]
    Mode -->|Parallel| Parallel[dispatch → 所有 subscribe]

    Serial --> MemberExec1[Member 执行完成]
    MemberExec1 --> SerialNext{还有下一个?}
    SerialNext -->|是| SerialNextDispatch[dispatch → 下一个 Member]
    SerialNextDispatch --> MemberExec1
    SerialNext -->|否| LeaderReview

    Parallel --> MemberExecN[所有 Member 并行执行]
    MemberExecN --> AllDone{全部完成?}
    AllDone -->|是| LeaderReview

    LeaderReview([Leader 审查])
    LeaderReview --> LeaderResult{审查结果?}
    LeaderResult -->|通过| Completed([Task 完成])
    LeaderResult -->|失败| Retry{重试次数 < 10?}
    Retry -->|是| Serial
    Retry -->|否| Failed([Task 失败])
```

---

## 5. AI 任务规划流程

```mermaid
sequenceDiagram
    participant L as Leader
    participant CP as ChatPanel.vue
    participant AI as Manager AI
    participant M as Manager Tasks API

    L->>CP: 输入任务描述 → 点击 AI 规划
    CP->>AI: POST /api/ai/task/generate { description, members }
    AI->>AI: generateObject() + Zod schema
    AI-->>CP: TaskPlan { summary, assignments: [{ memberId, description, commands }] }
    CP->>L: 展示分派计划预览

    L->>CP: 确认执行
    loop 每个 assignment
        CP->>M: POST /api/tasks { subscribe: [memberId], content: commands }
    end
    M-->>CP: 任务创建成功
```

---

## 6. Agent ReAct 执行循环

```mermaid
flowchart TD
    Start([Member 收到 dispatch]) --> Register[ClientTask 入队<br/>processNext]
    Register --> Mode{execution_mode?}

    Mode -->|Manual| ManualUI[返回永不 resolve 的 Promise<br/>TaskCard 显示手动控制按钮]
    Mode -->|Auto| AutoExec

    AutoExec[POST /api/tasks/id/start<br/>组装工具集] --> InitAgent[agent.runAgent<br/>初始化对话历史 + 系统 Prompt]

    InitAgent --> LoopStart[Step 1]
    LoopStart --> Reason[POST /api/ai/agent/reason<br/>发送 messages + tool schemas]
    Reason --> AIResponse{AI 返回?}

    AIResponse -->|纯文本，无工具调用| FinalResult[返回最终结果]
    AIResponse -->|工具调用| ToolCalls

    ToolCalls[执行工具调用] --> ToolType{工具类型?}
    ToolType -->|done| Done([调用完成<br/>POST /api/tasks/id/result])
    ToolType -->|shell / file_read / file_write| LocalTool[invoke Tauri command<br/>60s 超时]
    ToolType -->|upload/query/read_resource| RemoteTool[Manager REST API]

    LocalTool --> Truncate[截断输出<br/>stdout: 2000字符<br/>stderr: 1000字符]
    RemoteTool --> Truncate
    Truncate --> Append[追加到对话历史]
    Append --> Check{step < 20?}
    Check -->|是| LoopStart
    Check -->|否| MaxStep[达到最大步数<br/>返回当前结果]

    FinalResult --> Submit[提交结果]
    MaxStep --> Submit
    Submit --> Done2([任务结果已提交])

    ManualUI --> ManualBtn{用户操作?}
    ManualBtn -->|开始| AutoExec
    ManualBtn -->|完成| Submit2[POST /api/tasks/id/complete]
    ManualBtn -->|上传资源| Upload[POST /api/tasks/id/resources]
```

---

## 7. 任务状态生命周期

```mermaid
stateDiagram-v2
    [*] --> Pending : submitFrom() / handleSubmit()
    Pending --> Dispatched : dispatch to member
    Dispatched --> Running : Member 开始执行
    Running --> Completed : Leader 审查通过
    Running --> Failed : Member 执行失败
    Completed --> [*]

    Failed --> Dispatched : 重试 (retryCount < 10)
    Failed --> [*] : 重试耗尽

    Running --> Reviewing : 所有 Member 完成<br/>dispatch to Leader
    Reviewing --> Completed : Leader 审查通过
    Reviewing --> Dispatched : Leader 审查失败<br/>重新分派给所有 Member
```

---

## 8. 三层数据流全景

```mermaid
graph LR
    subgraph "Tauri 桌面端"
        direction TB
        VUI["Vue 3 UI<br/>ChatView / ChatPanel<br/>TaskCard / Sidebar"]
        VComp["Composables<br/>useTeamClient<br/>useAI / useMessages<br/>useTaskExecution"]
        VAgent["Agent<br/>react.ts / tools.ts<br/>useAgent"]
        VTauri["Tauri Backend<br/>shell_exec<br/>file_read / file_write<br/>save_message"]
    end

    subgraph "Manager 服务端"
        direction TB
        MAPI["HTTP Routes<br/>auth / messages / tasks<br/>ai / teams / dashboard"]
        MService["Services<br/>AI Provider<br/>Stream / Chat / Agent"]
        MEnvoy["Envoy Team<br/>Server + Leader/Member<br/>任务调度 + 消息中转"]
        MDB["Storage<br/>SQLite + JSON 文件<br/>~/.envoy/"]
    end

    subgraph "外部 AI"
        OpenAI["OpenAI"]
        Anthropic["Anthropic"]
        Google["Google"]
        DeepSeek["DeepSeek"]
    end

    VUI --> VComp
    VComp --> VAgent
    VAgent --> VTauri
    VComp -->|"REST API"| MAPI
    VAgent -->|"POST /ai/agent/reason"| MService
    VComp -->|"WebSocket"| MEnvoy

    MAPI --> MService
    MAPI --> MEnvoy
    MAPI --> MDB
    MEnvoy --> MDB
    MService --> OpenAI
    MService --> Anthropic
    MService --> Google
    MService --> DeepSeek
```

---

## 9. Envoy 框架消息协议

```mermaid
graph TD
    subgraph "MessageType 枚举 (9种)"
        M1["message — 聊天消息"]
        M2["dispatch — 任务分发"]
        M3["submit — 任务提交"]
        M4["result — 任务结果"]
        M5["notify — 通知 (members/join/leave)"]
        M6["heartbeat — 心跳"]
        M7["ack — 确认"]
        M8["error — 错误"]
        M9["custom — 自定义"]
    end

    subgraph "Client 发送"
        C1["team:join → 加入团队"]
        C2["message → 发送聊天"]
        C3["submit → 提交任务"]
        C4["result → 返回结果"]
        C5["heartbeat → 心跳"]
    end

    subgraph "Server 发送"
        S1["dispatch → 分发任务"]
        S2["message → 中转消息"]
        S3["team:members → 成员列表"]
        S4["task → 任务状态更新"]
        S5["ack → 确认"]
    end
```

---

## 10. 文件存储结构

```mermaid
graph LR
    Root["~/.envoy/"]

    Root --> History["history/"]
    History --> HP["{userId}/"]
    HP --> HF["{peerId}.json — 聊天记录"]

    Root --> Teams["teams/"]
    Teams --> TN["{teamName}/"]
    TN --> Meta["meta.json — 团队配置"]
    TN --> Tasks["tasks/"]
    Tasks --> TID["{taskId}/"]
    TID --> TaskJSON["task.json — 任务数据"]
    TID --> Resources["resources/ — 资源文件"]

    Root --> Users["users.json — 用户账号"]
    Root --> Keys["keys/ — RSA 密钥对"]
    Root --> Settings["settings.json — 客户端设置"]
    Root --> Manager["manager.json — Manager + AI 配置"]
    Root --> Brains["brains/"]
    Brains --> BN["{username}/ — Agent 记忆/技能"]
```
