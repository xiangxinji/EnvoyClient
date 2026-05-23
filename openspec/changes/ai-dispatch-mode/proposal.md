## Why

任务派发底层引擎已完整支持串行（serial）和并行（parallel）两种模式，但前端所有派发路径（直接派发 + AI 智能派发）都硬编码 `mode: "serial"`。AI dispatch prompt 完全不知道有 mode 字段，导致本应并行执行的任务（如"分别调研三个方向"）被迫串行，浪费时间。

## What Changes

- AI dispatch endpoint `/api/ai/task/dispatch` 的 Zod schema 和 prompt 增加 `mode` 字段，AI 根据任务描述自动判断串行或并行，串行模式下 `subscribe` 数组顺序代表执行顺序
- TaskDispatchPanel 预览卡片增加模式显示和下拉选择器，用户可在确认前查看和修改 AI 推荐的模式
- `TaskService.dispatch()` 接受 `mode` 参数传递给 `POST /api/tasks`，不再硬编码 `"serial"`
- TaskDetailPanel 的 mode badge 从 `task.mode` 读取，不再写死 `'serial'`

## Capabilities

### New Capabilities

（无新增能力）

### Modified Capabilities

- `ai-smart-dispatch`: AI dispatch 返回结果增加 `mode` 字段（`"serial" | "parallel"`），确认派发时传递用户选择（或 AI 推荐）的 mode 而非硬编码 `"serial"`
- `task-dispatch`: 前端派发接口支持 mode 参数，TaskDetailPanel 正确显示任务模式

## Impact

- **后端 API**: `manager/server/services/ai/dispatch.ts` — Zod schema 和 prompt 增加 mode
- **前端服务**: `src/services/TaskService.ts` — dispatch 方法增加 mode 参数
- **前端组件**: `TaskDispatchPanel` — 增加模式选择器 UI；`TaskDetailPanel` — 修复 mode 显示
- **无破坏性变更**: 默认值仍为 `"serial"`，ChatPanel 直接派发行为不变
