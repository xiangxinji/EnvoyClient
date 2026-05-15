## Context

当前 Leader 手动选择成员并分派任务，需要 Leader 了解每个成员的能力。系统已有 `planTask()` 生成命令级别方案，但没有根据成员职责自动匹配的能力。用户数据存储在 `~/.envoy/users.json`，团队在线成员通过 Envoy `getOnlineClients()` 获取。任务通过 `Leader.submit({ content, subscribe, mode })` 提交。

## Goals / Non-Goals

**Goals:**
- 创建用户时能填写职责描述，AI 据此匹配任务
- Leader 只需输入任务描述，AI 自动选人
- 任务中心集中管理所有任务
- TaskCard 展示多成员执行状态

**Non-Goals:**
- 不做任务自动拆解（一个任务描述整体分派）
- 不做成员能力学习/画像（纯靠手动填写的职责）
- 不做任务依赖/工作流编排
- 不改 Member 端 ReAct Agent 逻辑

## Decisions

### 1. 职责存储：users.json 加字段

**选择**: 在 `UserRecord` 中加 `responsibilities: string` 字段，跟随用户记录存储。

**原因**: 最简单，不需要新文件。users.json 本身就存了用户信息，加一个字段零成本。

### 2. 职责传递：members API 查 users.json

**选择**: `GET /api/teams/:name/members` 返回时，用成员 ID 查 users.json 获取 responsibilities。

**原因**: 在 Manager 层面做数据聚合，客户端不需要额外请求。members API 本身就返回成员列表，附带职责自然。

### 3. AI 分派接口：新增 `POST /api/ai/task/dispatch`

**选择**: 新建独立接口，输入 `{ description, members: [{ id, responsibilities }] }`，输出 `{ subscribe: string[], content: string }`。

**原因**: 与现有 `/api/ai/task/generate`（生成命令）职责不同。dispatch 做的是"选人"，generate 做的是"生成命令"。分离关注点。

### 4. 前端任务输入：去 peerId 依赖

**选择**: 任务输入区域改为全局入口（不依赖选中 peer）。AI 返回后展示预览面板，确认后 submit。

**原因**: 任务可能分给多人，不应绑定在单人对话中。独立输入 + 预览确认是更自然的流程。

### 5. 任务中心：侧边栏入口 + 独立视图

**选择**: 在 MemberSidebar 顶部加"任务中心"固定入口，点击切换到 TaskCenterView。TaskCenterView 从所有对话中聚合 TaskMessage。

**原因**: 利用已有的 `messages` Map 遍历所有对话提取任务，不需要新的数据源。

## Risks / Trade-offs

- **职责描述质量影响匹配精度** → 引导用户在 textarea 中用关键词风格描述，不是自然语言
- **AI 可能选错人** → 预览确认环节给 Leader 纠正机会
- **离线成员不应被选中** → API 只传在线成员给 AI
- **任务中心数据来源是内存中的 messages** → 刷新后需要重新加载 history，大量任务时可能有性能问题，当前规模可接受
