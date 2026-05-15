## Context

EnvoyClient 是一个 Tauri 2 + Vue 3 桌面应用，使用 Envoy 框架（TypeScript WebSocket 通信库）进行团队协作。当前状态：

- Tauri 后端（Rust）仅有模板代码
- Envoy 子模块提供完整的 Server/Client/Team 通信框架
- 已有 `useLeader.ts` 和 `useMember.ts` 两个 Vue composable，但未接入 UI
- 前端仍为默认模板页面

约束：
- 纯前端实现，Rust 后端不参与角色逻辑
- Envoy 子模块可扩展但需保持向后兼容
- 调试阶段，不需要持久化和认证

## Goals / Non-Goals

**Goals:**
- 用户能在启动页选择 Leader 或 Member 身份并连接到 Team 服务器
- 微信风格聊天界面：成员列表 + 消息面板 + 输入区
- Leader 能向指定成员分派任务，任务状态实时展示
- 成员上线/下线实时反映在成员列表中

**Non-Goals:**
- 用户认证（账号密码）— 后续迭代
- 消息持久化 / 离线消息
- 文件传输 / 多媒体消息
- 群组聊天（当前仅支持一对一和全员广播）
- Rust 后端角色逻辑

## Decisions

### D1: 合并 useLeader/useMember 为统一 useTeamClient

**选择**：单一 composable，内部根据 role 参数创建 Leader 或 Member 实例。

**替代方案**：保持两个独立 composable。

**理由**：Leader 和 Member 的 API 完全一致（都继承自 Client），UI 组件不需要条件分支来选择调用哪个 composable。统一入口减少重复代码，角色差异仅在 `connect()` 时的 role 声明。

### D2: provide/inject 而非 Pinia

**选择**：使用 Vue 的 provide/inject 传递 team client 实例和成员列表。

**替代方案**：Pinia store。

**理由**：调试阶段，数据流简单。团队状态（成员列表、消息）的生命周期与 ChatView 组件绑定，不需要跨路由持久化。后续如需复杂状态管理再迁移到 Pinia。

### D3: Team 服务端广播成员变动（方案 A）

**选择**：成员 connect/disconnect 时，Team 通过 `server.notify()` 向所有在线客户端推送 `team:members` 通知。

**替代方案**：客户端主动请求成员列表。

**理由**：聊天场景需要实时感知成员状态变化。广播模式保证所有客户端视图一致，且复用现有 `notify` 消息类型，不引入新协议。

### D4: 消息时间线混排

**选择**：聊天消息和任务卡片共享同一个时间线数组，通过消息类型（subtype）区分渲染组件。

**理由**：真实工作流中对话和任务是交织的，用户不需要在两个面板间切换。MessageBubble 处理 `chat` 类型，TaskCard 处理 `task:*` 类型。

### D5: Vue Router 最小路由

**选择**：两个路由：`/` (RoleSelect) 和 `/chat` (ChatView)。连接成功后程序化导航到 `/chat`。

**理由**：当前只有两个页面，不需要嵌套路由或路由守卫。后续增加更多视图时可扩展。

## Risks / Trade-offs

- **Envoy 子模块改动** → 改动限制在 `team.ts` 的成员变动广播，不影响现有 Server/Client 协议。改动向后兼容，不连接 Team 的普通 Client 不受影响。
- **provide/inject 无持久化** → 页面刷新丢失消息历史。当前可接受，后续可通过 localStorage 或 IndexedDB 缓解。
- **无认证** → 任何人可以声明任何角色。调试阶段可接受，生产环境需要增加认证层。
