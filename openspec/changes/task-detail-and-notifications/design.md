## Context

当前客户端的任务信息全部展示在 TaskCard 组件中，该组件已膨胀到 ~960 行。任务状态变更通过 WebSocket 静默推送到 UI，没有桌面级通知，用户必须主动查看任务中心。Envoy core 的 Resource 类型没有 timestamp 字段，无法构建事件时间线。

## Goals / Non-Goals

**Goals:**
- 提供独立的任务详情 slide-over 面板，从任何内容面板均可打开
- 为 Resource 添加 timestamp 字段，构建基本事件时间线
- 集成 Tauri notification 插件，在关键状态变更时推送桌面通知
- TaskCard 精简为摘要卡片，详情由 TaskDetailPanel 承载

**Non-Goals:**
- 不实现通知中心（历史通知列表）
- 不实现浏览器端 Web Notifications 降级
- 不实现 Agent 步骤级别的 timestamp（仅资源级别）
- 不改变 Envoy 的任务调度逻辑

## Decisions

### D1: Slide-over 面板而非替换内容区
- **选择**: position: absolute 右侧滑入，480px 宽
- **备选**: 替换当前面板内容（会丢失上下文）
- **理由**: 用户可以在查看任务详情的同时保持当前面板上下文

### D2: 新增 selectedTaskId ref 独立于 selectedPeer
- **选择**: ChatView 维护独立的 `selectedTaskId` ref
- **理由**: 不影响现有的面板切换逻辑，任何面板下都能打开任务详情

### D3: Resource timestamp 由 Server 端填充
- **选择**: `addResource()` 自动设置 `timestamp: Date.now()`
- **备选**: 客户端提交时携带时间戳
- **理由**: 服务端时间是权威的，避免客户端时钟不一致

### D4: 通知仅在 Tauri 环境触发
- **选择**: 使用 safeInvoke 模式检测环境，非 Tauri 静默跳过
- **理由**: 用户明确表示不需要浏览器端通知

### D5: 通知触发点
- dispatched → 通知被分派的成员（新任务到达）
- completed → 通知创建者 + 所有订阅者
- failed → 通知创建者 + 所有订阅者
- reviewing → 通知创建者（Leader 需要审核）

## Risks / Trade-offs

- [Resource timestamp 回填] 旧数据无 timestamp，时间线可能不完整 → 前端对缺失 timestamp 做降级显示
- [通知频率] 高频任务可能造成通知轰炸 → 初期不做节流，后续可按需添加
