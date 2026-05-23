## Context

当前任务派发系统在底层 `envoy/packages/server/server.ts` 已完整实现串行（`dispatchSerial`）和并行（`dispatchParallel`）两种模式。`Task` 类型包含 `mode: TaskMode` 字段，DB 中 `tasks` 表有 `mode TEXT NOT NULL DEFAULT 'serial'` 列。

但前端所有派发路径都硬编码 `mode: "serial"`：
- `TaskService.dispatch()` 第 16 行直接写死
- AI dispatch prompt 只返回 `{ subscribe, content }`，不含 mode
- TaskDetailPanel 显示 mode badge 时写死 `'serial'`

需要打通 AI → UI → API 的 mode 传递链路。

## Goals / Non-Goals

**Goals:**
- AI dispatch 根据任务描述自动判断串行/并行模式
- 用户在 TaskDispatchPanel 确认前可查看和修改 AI 推荐的模式
- `TaskService.dispatch()` 正确传递 mode 到后端
- TaskDetailPanel 正确显示任务的实际模式

**Non-Goals:**
- 不增加混合模式（串行+并行组合），只支持 serial/parallel 二选一
- 不修改 ChatPanel 直接派发的 UI（保持默认 serial 行为）
- 不修改底层 envoy engine 的串行/并行执行逻辑

## Decisions

### 1. AI dispatch schema 增加 mode 字段

在 `dispatch.ts` 的 Zod schema 中增加 `mode: z.enum(["serial", "parallel"])` 字段。AI 根据 `subscribe` 数组长度和任务描述内容判断模式：
- 多人且任务步骤有依赖关系（如"先翻译再校对"）→ serial
- 多人且任务可独立执行（如"分别调研三个方向"）→ parallel
- 单人 → serial（并行无意义）

串行模式下 `subscribe` 数组顺序即为执行顺序，这个语义与底层 `dispatchSerial` 一致。

### 2. TaskDispatchPanel 增加模式选择器

AI 派发结果预览中增加 `GlassSelect` 下拉框，初始值来自 AI 返回的 mode，用户可修改为 serial/parallel。

确认按钮调用 `TaskService.dispatch(subscribe, content, mode)` 时传递用户最终选择的 mode。

### 3. TaskService.dispatch 签名扩展

`dispatch(targetIds, content, mode?)` 增加可选 `mode` 参数，默认 `"serial"`。这样 ChatPanel 的直接派发调用无需改动。

### 4. TaskDetailPanel 读取 task.mode

将硬编码的 `'serial'` 替换为 `task.mode`，使用 `modeLabels[task.mode]` 显示。

## Risks / Trade-offs

- **AI 模式判断可能不准确** → 用户可以手动修改，不阻断流程
- **串行模式成员顺序语义** → UI 中串行模式下显示成员执行顺序箭头（A → B → C），并行模式下平铺显示，减少歧义
