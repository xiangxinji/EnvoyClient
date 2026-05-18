## 1. MemberHoverCard 组件

- [x] 1.1 创建 `src/components/MemberHoverCard.vue`：接收 `member: MemberInfo` 和 `visible: boolean` props，Teleport 到 body，fixed 定位；展示头像首字母、名字、角色徽章、在线状态、职责（如有）、能力（如有）；毛玻璃 standard 层级样式 + heavy shadow；空字段不渲染对应区块

## 2. MemberSidebar 集成

- [x] 2.1 在 MemberSidebar 添加 hover 状态管理：`hoveredMemberId` ref、`triggerRect` ref、`showDelay` / `hideDelay` 定时器（150ms 显示延迟、100ms 隐藏延迟）；鼠标移入卡片时取消隐藏
- [x] 2.2 在成员 `<li>` 上绑定 `@mouseenter` / `@mouseleave` 事件触发 hover 状态，通过 `MemberHoverCard` 组件 Teleport 到 body 渲染，传入 hoveredMember 数据和位置
