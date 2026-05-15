## Why

当前 EnvoyClient 是一个空白的 Tauri 模板应用，尚未接入 Envoy 框架的实际功能。需要在 Tauri 桌面端实现 Leader/Member 角色区分和团队协作聊天界面，使应用具备基本的可用性——用户可以选择角色、连接到 Team 服务器、与其他成员实时聊天，Leader 还能向成员分派任务。

## What Changes

- 新增角色选择启动页：用户在首页选择 Leader 或 Member 身份，填写 Client ID 和服务器地址后连接
- 新增微信风格聊天主界面：左侧成员列表、右侧消息面板+输入区
- 新增任务分派功能（Leader 专属）：Leader 可以向指定成员提交任务，任务卡片与聊天消息混排在时间线中
- 扩展 Envoy Team 模块：成员上线/下线时向所有客户端广播成员列表变动
- 合并 `useLeader.ts` 和 `useMember.ts` 为统一的 `useTeamClient` composable

## Capabilities

### New Capabilities
- `role-selection`: 角色选择与连接配置页面，用户选择 Leader/Member 身份并输入连接参数
- `team-chat`: 微信风格的团队聊天界面，包含成员列表、消息面板、输入区
- `task-dispatch`: Leader 向成员分派任务的能力，任务卡片嵌入聊天流中展示状态
- `team-notify`: Team 服务端成员变动广播机制，客户端实时感知成员上下线

### Modified Capabilities
<!-- 无已有 spec 需要修改 -->

## Impact

- **Envoy 子模块**：`packages/teams/team.ts` 需扩展广播逻辑
- **前端新增依赖**：vue-router
- **前端文件变动**：新增约 10 个文件（views/components/composables/types/router），改造 App.vue 和 main.ts
- **可删除文件**：`composables/useLeader.ts`、`composables/useMember.ts`（被 useTeamClient 替代）
