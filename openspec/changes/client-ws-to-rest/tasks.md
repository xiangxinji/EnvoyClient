## 1. Envoy Server 暴露公开方法

- [ ] 1.1 在 `envoy/packages/server/server.ts` 新增 `relay(fromId, toId, subtype, payload)` 公开方法
- [ ] 1.2 在 `envoy/packages/server/server.ts` 新增 `submitFrom(fromId, options)` 公开方法

## 2. Manager REST 路由

- [ ] 2.1 新建 `manager/server/routes/messages.ts`，实现 `POST /api/messages` 和 `POST /api/tasks`
- [ ] 2.2 在 `manager/server/index.ts` 中挂载新路由，传入 `teamInstances`

## 3. 客户端改造

- [ ] 3.1 在 `src/composables/useTeamClient.ts` 中封装 `apiRequest` 工具函数（处理 base URL + team header）
- [ ] 3.2 将 `sendChat` 从 `client.sendTo()` 改为 `POST /api/messages`
- [ ] 3.3 将 `dispatchTask` 从 `client.submit()` 改为 `POST /api/tasks`
