## Why

侧边栏成员列表空间有限，只显示名字和角色标签。成员的职责（responsibilities）和能力（capabilities）信息被截断或完全隐藏。用户需要悬停查看成员完整信息，以便快速了解团队成员的分工和技能，辅助任务分派决策。

## What Changes

- 在侧边栏成员头像上新增悬浮毛玻璃卡片，展示成员完整信息（名字、角色、在线状态、职责、能力）
- Leader 成员展示固定信息（名字、Leader 角色、在线状态），无职责/能力字段
- 使用 `<Teleport to="body">` + `position: fixed` 定位，避免被 `overflow-y: auto` 裁切
- 鼠标悬停时显示，移出时隐藏

## Capabilities

### New Capabilities

- `member-hover-card`: 侧边栏成员悬浮信息卡片——Teleport 定位、毛玻璃样式、成员完整信息展示

### Modified Capabilities

（无——仅新增 UI 展示，不改变现有数据流或行为）

## Impact

- **前端组件**: `MemberSidebar.vue`（新增 hover 交互 + Teleport 渲染）
- **新增组件**: `MemberHoverCard.vue`（悬浮卡片组件）
- **无后端改动**: 使用已有 `MemberInfo` 数据，不涉及 API 变更
- **无破坏性变更**: 纯增量 UI 功能
