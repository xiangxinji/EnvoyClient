## Context

EnvoyClient 的 Member 客户端在多窗口调试时无法区分身份，消息列表全量渲染导致性能问题，Manager 管理后台缺乏任务执行的可视化。三个独立但相关的 UX 改进需要在不同模块中实现。

当前状态：
- TitleBar.vue 无 props，固定显示 "Envoy"
- ChatPanel.vue 通过 `getConversation()` 加载全部消息，使用 `watch` 自动滚动到底部
- Dashboard.vue 只展示任务数量统计，无执行详情
- Envoy Task 模型有 `resources[]`（含 `by` 和 `data`），但缺少 `startedAt`/`completedAt` 时间戳

## Goals / Non-Goals

**Goals:**
- 多窗口调试时通过标题栏快速识别当前登录用户
- 聊天面板支持大数据量场景，默认 50 条 + 滚动加载
- Manager 管理者能看到任务执行全貌：谁执行了、多久、结果

**Non-Goals:**
- 不改造 Envoy 框架核心的 Task 模型（保持 `resources[]` 结构）
- 不做虚拟滚动（DOM 节点数在可接受范围内）
- 不做消息搜索功能

## Decisions

### 1. 标题栏用户名传递方式：通过 teamClientContext

**选择**: 在 `teamClientContext` 中传递 `myId`，TitleBar 通过 inject 获取。

**原因**: myId 已在 context 中存在，不需要新增 prop drilling。TitleBar 直接 inject 即可，与现有架构一致。

**备选**: 给 TitleBar 加 `username` prop — 需要在 App.vue 和 ChatView.vue 中逐层传递，改动更大。

### 2. 消息分页：前端切片 + 滚动加载

**选择**: `ChatPanel` 内部维护 `displayCount` 状态，初始为 50。`getConversation()` 仍返回全量数据，渲染时用 `slice(-displayCount)` 截取。滚动到顶部时 `displayCount += 50`。

**原因**: 消息数据已在内存中（从 Rust history 加载），不需要后端分页 API。纯前端切片实现简单，性能足够。

**备选**: 在 Rust 端实现分页读取 — 过度工程化，当前消息量不需要。

### 3. 任务执行详情：从现有 resources 中提取

**选择**: 不修改 Envoy Task 模型。从 `resources[]` 中提取信息：
- 执行人: `resources.find(r => r.type === "client-result")?.by`
- 结果: `resources.find(r => r.type === "client-result")?.data`
- 执行时间: 使用 `createdAt`（任务创建时间）和资源添加时间推算

同时在 Member 的 `client.doing()` 返回中增加 `startedAt`/`completedAt` 字段，由 Manager 后端记录。

**原因**: 最小化对 Envoy 框架的改动，复用现有数据结构。

## Risks / Trade-offs

- **消息切片性能**: 全量数据仍在内存中，只是减少 DOM 节点。如果单对话超过数千条，内存可能成为问题 → 当前场景可接受，后续可考虑虚拟滚动
- **任务时间精度**: 没有精确的 `startedAt`/`completedAt` → 显示为粗略时长或只显示创建时间 + 状态
- **Manager API 变更**: 需要修改 dashboard 和 teams 路由返回更多字段 → 向后兼容，只是增加字段
