## 1. Envoy 子模块：Team 广播

- [x] 1.1 在 `Envoy/packages/teams/team.ts` 中添加 `broadcastMembers()` 私有方法，遍历所有在线客户端发送 `notify` 消息（subtype: "team:members"，payload: { members: [...] }）
- [x] 1.2 在 `handleJoin()` 中调用 `broadcastMembers()`，确保新成员加入后全员收到更新
- [x] 1.3 在 `setupHandlers()` 的 `client:offline` 事件中调用 `broadcastMembers()`，确保成员离开后全员收到更新

## 2. 前端基础设施

- [x] 2.1 安装 vue-router 依赖（npm install vue-router）
- [x] 2.2 创建 `src/router.ts`，配置 `/` → RoleSelect、`/chat` → ChatView 两条路由
- [x] 2.3 改造 `src/main.ts`，注册 router
- [x] 2.4 改造 `src/App.vue`，替换模板内容为 `<router-view />`
- [x] 2.5 创建 `src/types.ts`，定义前端消息类型（ChatMessage、TaskMessage、MemberInfo）

## 3. useTeamClient composable

- [x] 3.1 创建 `src/composables/useTeamClient.ts`，接收 role 和 ClientOptions，内部根据 role 创建 Leader 或 Member 实例
- [x] 3.2 暴露统一的 status、connect、disconnect、submit、doing、sendTo 接口
- [x] 3.3 监听 notify 事件中 subtype 为 "team:members" 的消息，维护 members ref
- [x] 3.4 维护 messages ref，收集所有 chat 和 task 类型消息到统一时间线
- [x] 3.5 暴露 sendChat(targetId, text) 便捷方法，封装 sendTo(targetId, "chat", { text })
- [x] 3.6 暴露 dispatchTask(targetId, content) 便捷方法，封装 submit({ content, subscribe: [targetId], mode: "serial" })
- [x] 3.7 删除旧的 `useLeader.ts` 和 `useMember.ts`

## 4. RoleSelect 页面

- [x] 4.1 创建 `src/views/RoleSelect.vue`，包含角色单选（Leader/Member）、Client ID 输入、Server URL 输入、Connect 按钮
- [x] 4.2 实现输入验证：ID 非空、URL 以 ws:// 或 wss:// 开头
- [x] 4.3 实现 Connect 逻辑：调用 useTeamClient 的 connect，成功后 router.push('/chat')
- [x] 4.4 实现 loading 状态和错误反馈

## 5. ChatView 页面

- [x] 5.1 创建 `src/views/ChatView.vue`，微信风格两栏布局（左 Sidebar + 右 ChatPanel）
- [x] 5.2 通过 provide/inject 获取 useTeamClient 实例和 role 信息

## 6. MemberSidebar 组件

- [x] 6.1 创建 `src/components/MemberSidebar.vue`，显示成员列表（ID + 角色标签）
- [x] 6.2 实现成员点击选中，通过 v-model 或 emit 通知 ChatView 切换聊天对象
- [x] 6.3 显示未读消息标记（当收到非当前选中成员的消息时）

## 7. ChatPanel 组件

- [x] 7.1 创建 `src/components/ChatPanel.vue`，包含消息列表区域和底部输入区
- [x] 7.2 消息列表自动滚动到底部（新消息到达时）
- [x] 7.3 输入框支持 Enter 发送，调用 sendChat

## 8. MessageBubble 组件

- [x] 8.1 创建 `src/components/MessageBubble.vue`，渲染聊天消息气泡（区分自己发送/他人发送）
- [x] 8.2 显示发送者 ID、消息文本、时间戳

## 9. TaskCard 组件

- [x] 9.1 创建 `src/components/TaskCard.vue`，渲染任务卡片（任务内容、被分派人、状态）
- [x] 9.2 根据任务状态显示不同样式（pending/running/completed/failed）

## 10. 任务分派交互

- [x] 10.1 在 ChatPanel 输入区旁添加"分派任务"按钮（仅 role === "leader" 时显示）
- [x] 10.2 点击按钮弹出任务内容输入框，确认后调用 dispatchTask
