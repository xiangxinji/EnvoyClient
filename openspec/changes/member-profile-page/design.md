## Context

当前项目的成员信息展示分为两层：
1. **MemberSidebar** — 侧边栏列表，显示头像、昵称、角色、在线状态、未读数
2. **MemberHoverCard** — hover 浮层，显示头像、昵称、角色、在线状态、职责、能力

两个入口都缺少"查看完整详情"的跳转能力。面板导航使用 `selectedPeer` ref + 特殊 ID 前缀模式（如 `__settings_profile__`），已有成熟的 `detailReturnPeer` 返回机制。

任务数据已在后端完整存在，每个任务有 `status`（pending/running/reviewing/completed/failed）和 `from`/`subscribe` 字段标识关联成员。可通过现有 API 按成员聚合任务计数。

## Goals / Non-Goals

**Goals:**
- 从 HoverCard 头像点击进入成员详情面板
- 详情面板展示：头像、昵称、角色、在线状态、任务统计、职责、能力
- 支持"发消息"跳转到 DM 聊天
- 入口覆盖侧边栏成员列表和群聊消息头像两个位置

**Non-Goals:**
- 编辑他人资料（仅查看）
- 手动设置执行状态（纯自动，基于任务状态聚合）
- DM 消息中的入口（DM 不显示头像）
- 后端新增 API（复用现有接口）

## Decisions

### D1: 面板路由使用 `__profile__{username}__` 模式

复用现有 `selectedPeer` 特殊 ID 模式。在 ChatView 中通过 `startsWith("__profile__")` 匹配，提取 username。

**理由**: 与 `__settings_profile__`、`__cloud__` 等现有模式一致，无需引入新的路由机制。

**替代方案**: Vue Router 嵌套路由 — 过重，现有面板切换全靠 `selectedPeer`，引入 router 会造成两套路由并存。

### D2: HoverCard 头像添加点击而非整体可点击

只在 HoverCard 的头像区域响应点击，卡片其余区域保持纯展示。

**理由**: 避免误触。HoverCard 在鼠标移出时自动消失，整体可点击会导致用户想查看信息时意外导航。

### D3: 任务统计数据来源

打开详情面板时，通过 API 获取该成员的任务计数。不依赖 WebSocket 实时推送任务计数变化。

**理由**: 任务计数是快照式数据，面板打开时拉取一次即可。用户不会长时间停留在别人的详情页上盯数据变化。减少 WebSocket 事件复杂度。

**替代方案**: WS 广播 `task_count_changed` — 增加后端复杂度，收益低。

### D4: MemberProfilePanel 作为独立组件

新建 `src/components/MemberProfilePanel/` 目录，遵循项目组件结构规范（main.vue + styles.css）。

**理由**: 详情面板有独立的布局和交互逻辑，不适合内联到 ChatView 中。

### D5: view-profile 事件通过 emit 传递

HoverCard emit `view-profile` 事件 → 父组件（MemberSidebar / MessageBubble）接收 → 调用 `emit('select', '__profile__{username}__')` 传递到 ChatView。

**理由**: 保持单向数据流，HoverCard 不直接操作路由状态。

## Risks / Trade-offs

- **[HoverCard 消失时机]** 点击头像后 HoverCard 需要立即隐藏，同时触发面板切换。→ 点击时先隐藏 HoverCard 再 emit 事件，顺序执行避免闪烁。
- **[自己的详情页]** 点击自己的 HoverCard 头像也应进入详情页（只读视图），与 SettingsProfile（编辑视图）共存。不造成冲突，因为一个是只读面板，一个是编辑面板，路由不同。
- **[任务统计 API]** 需确认后端是否已有按成员聚合任务计数的接口。如果没有，需要新增一个轻量端点。→ 实现时优先查找现有 API，必要时新增。
