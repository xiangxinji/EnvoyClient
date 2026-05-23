## 1. MemberHoverCard 交互改造

- [x] 1.1 MemberHoverCard 头像区域添加 `@click` 事件，点击后 emit `view-profile` 事件并携带 `member.id`，同时立即隐藏 HoverCard
- [x] 1.2 MemberHoverCard 非头像区域保持不可点击，不触发导航

## 2. 事件传递链路

- [x] 2.1 MemberSidebar 监听 HoverCard 的 `view-profile` 事件，调用 `emit('select', '__profile__{memberId}__')` 传递到 ChatView
- [x] 2.2 MessageBubble 中群聊消息的 HoverCard 监听 `view-profile` 事件，通过 `emit('view-profile', memberId)` 向上传递
- [x] 2.3 ChatPanel 接收 MessageBubble 的 `view-profile` 事件，传递到 ChatView
- [x] 2.4 ChatView 接收 `view-profile` 事件，设置 `selectedPeer` 为 `__profile__{memberId}__`

## 3. ChatView 路由扩展

- [x] 3.1 ChatView 的 `handleSelectPeer` 中增加 `__profile__*` 模式匹配，提取 username，保存 `detailReturnPeer`
- [x] 3.2 ChatView 模板中增加 MemberProfilePanel 的渲染分支（条件：`selectedPeer.startsWith('__profile__')`）
- [x] 3.3 面板切换过渡动画分类：profile 归为 `detail` 类别，使用 slideLeft/slideRight

## 4. MemberProfilePanel 组件

- [x] 4.1 创建 `src/components/MemberProfilePanel/` 目录结构（main.vue + styles.css）
- [x] 4.2 实现 props 接收 `username`（从 selectedPeer 解析），通过 `useUserProfile` 加载个人资料
- [x] 4.3 实现头部区块：大头像（72px）+ 昵称 + 角色标签 + 在线状态指示
- [x] 4.4 实现个人信息区块：职责、能力（有值时显示）
- [x] 4.5 实现任务统计区块：执行中、待处理、已完成、失败计数（调用后端 API 获取）
- [x] 4.6 实现返回按钮（emit 事件恢复 detailReturnPeer）
- [x] 4.7 实现"发消息"按钮（emit 事件设置 selectedPeer 为成员 ID）
- [x] 4.8 遵循毛玻璃设计规范：背景使用 `--glass-bg-heavy`，边框 `--glass-border`，动效使用 `scaleIn` 预设入场

## 5. 测试验证

- [ ] 5.1 验证侧边栏 HoverCard 头像点击可进入详情面板
- [ ] 5.2 验证群聊消息 HoverCard 头像点击可进入详情面板
- [ ] 5.3 验证返回按钮正确恢复之前的面板
- [ ] 5.4 验证"发消息"按钮正确跳转到 DM 聊天
- [ ] 5.5 验证自己的详情页可正常查看（只读）
- [ ] 5.6 验证无职责/能力的成员不显示空区块
