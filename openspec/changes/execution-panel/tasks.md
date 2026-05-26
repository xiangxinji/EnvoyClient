## 1. 事件流数据层

- [x] 1.1 定义 `ExecutionEvent` 和 `ExecutionEntry` 类型到 `src/types.ts`
- [x] 1.2 改造 `reactLoop` 增加可选 `onEvent` 回调参数，在推理完成、工具调用前、工具返回后 emit 事件
- [x] 1.3 改造 `defineAgent` 的 `run` 方法接受可选 `onEvent`，透传给 `reactLoop` 并注入 `agent` 字段
- [x] 1.4 改造 `definePipeline` 接受可选 `onEvent`，在 pipeline:start、stage:start、stage:end、pipeline:end 时机 emit，并透传给 agent.run()

## 2. ExecutionMonitor 单例

- [x] 2.1 新建 `src/composables/useExecutionMonitor.ts`，实现模块级单例 reactive 状态（status、taskInfo、currentStage、entries）
- [x] 2.2 实现 `startExecution(taskId, taskContent)` 和 `clearExecution()` 方法
- [x] 2.3 实现 `emit(event)` 方法，将事件追加到 entries 并更新 currentStage/status

## 3. 接入执行流程

- [x] 3.1 改造 `src/agent/pipelines/taskPipeline.ts`，`createTaskPipeline` 接受可选 `onEvent` 并透传给 `definePipeline`
- [x] 3.2 改造 `src/composables/useTaskExecution.ts` 的 `handleMemberExecution`，创建 ExecutionMonitor 事件回调并传入 pipeline.run()

## 4. 侧边栏集成

- [x] 4.1 修改 `src/composables/useSidebarSearch.ts`，在 `allTools` 中添加 `{ id: "__execution__", label: t("sidebar.executionPanel") }`
- [x] 4.2 修改 `src/components/MemberSidebar/main.vue`，在 `toolDescMap` 和 `toolIconMap` 中添加 `__execution__` 映射（图标: terminal）
- [x] 4.3 修改 `src/components/MemberSidebar/main.vue`，ToolHoverCard 的条件渲染支持 `__execution__`

## 5. ExecutionPanel 面板组件

- [x] 5.1 新建 `src/components/ExecutionPanel/main.vue` 和 `styles.css`
- [x] 5.2 实现面板头部（标题 + 返回按钮）
- [x] 5.3 实现空状态展示（status 为 idle 时显示提示文字）
- [x] 5.4 实现任务信息区域（taskId + taskContent）
- [x] 5.5 实现按 stage 分组的执行输出展示（Planner / Executor / Reviewer），包含完整 reasoning 文本和工具调用详情
- [x] 5.6 实现自动滚动到底部（新事件追加时）

## 6. 右上角通知

- [x] 6.1 新建 `src/components/ExecutionNotifier/main.vue` 和 `styles.css`
- [x] 6.2 实现 status === "running" 时 scaleIn 弹入，非 running 时淡出
- [x] 6.3 实现点击通知切换 selectedPeer 到 `__execution__`

## 7. ChatView 集成

- [x] 7.1 修改 `src/views/ChatView/main.vue`，在 v-else-if 链中添加 `ExecutionPanel`（selectedPeer === "__execution__"）
- [x] 7.2 在 ChatView 中添加 `ExecutionNotifier` 组件（fixed 定位右上角）

## 8. 国际化

- [x] 8.1 添加 `sidebar.executionPanel` 和 `sidebar.executionPanelDesc` 翻译
- [x] 8.2 添加 `execution.*` 相关翻译（空状态、阶段名称、工具调用标签等）
