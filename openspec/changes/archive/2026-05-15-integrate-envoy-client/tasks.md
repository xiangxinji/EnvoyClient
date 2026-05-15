## 1. 构建配置

- [x] 1.1 在 `vite.config.ts` 中配置 `@envoy/core`、`@envoy/client`、`@envoy/teams` 三个 alias 指向 Envoy 子模块源码
- [x] 1.2 在 `vite.config.ts` 中配置 alias 将 `Envoy/packages/client/transport` 指向 `src/envoy/BrowserTransport.ts`
- [x] 1.3 在 `tsconfig.json` 中配置 `paths` 与 Vite alias 保持一致
- [x] 1.4 验证 Vite 构建成功，bundle 中不包含 `ws` 模块

## 2. BrowserTransport 实现

- [x] 2.1 创建 `src/envoy/BrowserTransport.ts`，使用浏览器原生 `WebSocket` API 实现 `ClientTransport` 相同接口
- [x] 2.2 实现 `connect()` 方法，返回 Promise，处理 open/error 事件
- [x] 2.3 实现 `send()` 方法，使用 `serializeMessage` 序列化后发送
- [x] 2.4 实现 `disconnect()` 方法，清除重连定时器并关闭连接
- [x] 2.5 实现自动重连逻辑，递增延迟策略，触发 `reconnecting` 和 `reconnect_failed` 事件
- [x] 2.6 验证 BrowserTransport 与 Client 类集成正常（类型检查通过）

## 3. Vue Composable

- [x] 3.1 创建 `src/composables/useLeader.ts`，封装 Leader 实例的创建、连接、断开
- [x] 3.2 创建 `src/composables/useMember.ts`，封装 Member 实例的创建、连接、断开
- [x] 3.3 在 composable 中提供响应式状态：`status`、`currentTask`、`queueLength`
- [x] 3.4 代理 `submit()`、`doing()` 方法
- [x] 3.5 通过 `onTask` 回调暴露任务状态变更事件
- [x] 3.6 组件卸载时自动调用 `disconnect()` 清理资源

## 4. 验证

- [x] 4.1 启动 `npm run tauri dev`，确认应用正常编译运行
- [x] 4.2 在 Vue 组件中测试 useLeader/useMember 的创建和连接流程（可连接本地 Envoy Server 验证）
