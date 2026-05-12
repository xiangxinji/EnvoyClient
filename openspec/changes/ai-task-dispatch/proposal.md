## Why

Leader 手动指定成员分派任务效率低，且需要 Leader 了解每个成员的能力。通过 AI 自动匹配成员职责与任务描述，实现智能调度。同时在创建用户时增加职责描述字段，作为 AI 匹配的依据。新增任务中心集中展示所有任务，解决多成员任务分散在各对话中不便管理的问题。

## What Changes

- **用户职责字段**: 创建用户时新增 `responsibilities` textarea，描述成员能力职责
- **AI 智能分派**: 新增 `/api/ai/task/dispatch` 接口，Leader 输入任务描述，AI 根据在线成员的职责自动匹配并返回 `subscribe` + `content`
- **任务输入改造**: ChatPanel 任务输入不再依赖选中的 peer，改为独立输入 + AI 预览确认
- **TaskCard 多成员展示**: 任务卡片展示多个被分派成员及其各自执行状态
- **任务中心**: 侧边栏新增"任务中心"入口，集中展示所有任务，按状态分组

## Capabilities

### New Capabilities

- `user-responsibilities`: 用户创建时填写职责描述，存储在 users.json，通过 API 传递给客户端
- `ai-smart-dispatch`: AI 根据任务描述 + 成员职责自动匹配最优成员，返回分派方案
- `task-center`: 侧边栏任务中心入口，集中展示所有任务及执行状态

### Modified Capabilities

## Impact

- **Manager 后端**: user-registry 加字段，teams 路由返回职责信息，新增 AI dispatch 接口
- **Manager 后台 UI**: Users.vue 创建表单加 textarea
- **Tauri 前端**: ChatPanel 任务输入区域改造，TaskCard 多成员展示，MemberSidebar 加入口，新增 TaskCenterView
- **AI 服务**: 新增 task dispatch prompt + handler
