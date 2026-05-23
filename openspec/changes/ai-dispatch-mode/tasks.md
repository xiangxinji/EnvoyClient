## 1. 后端 — AI dispatch 增加 mode

- [x] 1.1 `manager/server/services/ai/dispatch.ts` — Zod schema 增加 `mode: z.enum(["serial", "parallel"])` 字段
- [x] 1.2 `manager/server/services/ai/prompts/dispatch.ts` — system prompt 增加模式判断规则：多人任务步骤有依赖→serial，多人可独立执行→parallel，单人→serial；串行模式下 subscribe 顺序为执行顺序

## 2. 前端服务 — TaskService 传递 mode

- [x] 2.1 `src/services/TaskService.ts` — `dispatch()` 方法增加可选 `mode` 参数，类型 `"serial" | "parallel"`，默认 `"serial"`，传给 POST body 的 mode 字段
- [x] 2.2 `src/composables/useTeamClient.ts` — `dispatchTask(targetIds, content)` 签名增加可选 `mode` 参数，透传给 TaskService

## 3. 前端 UI — TaskDispatchPanel 模式选择器

- [x] 3.1 `src/views/TaskDispatchPanel/main.vue` — dispatch preview 增加模式下拉选择器（GlassSelect），初始值来自 AI 返回的 mode，选项为串行/并行
- [x] 3.2 `src/views/TaskDispatchPanel/main.vue` — 确认按钮调用 `dispatchTask(subscribe, content, selectedMode)` 传递用户选择的 mode

## 4. 前端 UI — TaskDetailPanel 修复 mode 显示

- [x] 4.1 `src/components/TaskDetailPanel/main.vue` — 将硬编码的 `'serial'` 替换为 `task.mode`，使用 `modeLabels[task.mode]` 显示
