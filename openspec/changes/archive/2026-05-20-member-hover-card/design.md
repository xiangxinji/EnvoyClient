## Context

MemberSidebar 的成员列表 (`<ul>`) 设置了 `overflow-y: auto` 用于滚动，这会裁切任何绝对定位的子元素。因此悬浮卡片不能作为 `<li>` 的子元素渲染，需要用 `<Teleport>` 渲染到 body 层级。

Leader 在 `useConnection.ts` 中加载时没有 responsibilities/capabilities 字段（API 不返回），卡片只需展示固定信息：名字、角色、在线状态。

## Goals / Non-Goals

**Goals:**

- 鼠标悬停成员头像/条目时显示毛玻璃信息卡片
- 卡片展示：头像、名字、角色、在线状态、职责（如有）、能力（如有）
- Leader 条目展示固定信息（无职责/能力）
- 卡片定位在成员条目右侧，跟随滚动
- 毛玻璃样式，符合设计系统

**Non-Goals:**

- 不做点击交互（纯 hover）
- 不做编辑功能（只读展示）
- 不改后端 API

## Decisions

### 1. Teleport + fixed 定位

**选择**: 使用 `<Teleport to="body">` 将卡片渲染到 body 层级，通过 `getBoundingClientRect()` 获取触发元素位置，用 `position: fixed` 定位卡片到成员条目右侧。

**理由**: 成员列表 `<ul>` 有 `overflow-y: auto`，绝对定位子元素会被裁切。Teleport 绕过这个问题，且 `fixed` 定位天然跟随滚动。

**替代方案**: 将 `<ul>` 的 `overflow` 改为 `visible` — 但这会破坏成员列表的滚动行为。

### 2. 组件结构

**选择**: 新增 `MemberHoverCard.vue` 独立组件，接收 `member: MemberInfo` 和 `rect: DOMRect` props。MemberSidebar 管理 hover 状态（`hoveredMemberId` + `triggerRect`），通过 Teleport 渲染卡片。

**理由**: 卡片逻辑和样式独立，不增加 MemberSidebar 的模板复杂度。卡片接收位置信息作为 prop，定位逻辑解耦。

### 3. 卡片位置策略

**选择**: 卡片左侧对齐成员条目的右边缘（`left = rect.right + 4px`），垂直居中对齐条目（`top = rect.top + rect.height/2`，通过 `translateY(-50%)` 居中）。如果右侧空间不足（靠近窗口右边缘），则改为左侧弹出（`left = rect.left - cardWidth - 4px`）。

### 4. 文件结构

```
src/components/MemberHoverCard.vue   ← 新增：悬浮卡片组件
src/components/MemberSidebar.vue     ← 修改：添加 hover 状态管理 + Teleport 渲染
```

## Risks / Trade-offs

- **hover 延迟** → 加 150ms 延迟避免鼠标划过时频繁触发/隐藏
- **快速移动鼠标导致卡片闪烁** → 用延迟隐藏（mouseleave 后 100ms 才隐藏），鼠标移入卡片时取消隐藏
- **窗口 resize 时位置可能错位** → 用 `fixed` 定位自然跟随，但 resize 不更新；可接受，因为 hover 是短暂交互
