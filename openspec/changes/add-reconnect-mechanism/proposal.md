---
name: add-reconnect-mechanism
status: proposed
created: 2026-05-18
---

## Problem

当 WebSocket 连接断开时（网络波动、服务器重启等），用户没有任何视觉反馈。底层 `BrowserTransport` 有自动重连逻辑（指数退避，最多 10 次），但：

1. **无 UI 反馈** — `status` ref 存在但无组件渲染它
2. **心跳不会恢复** — transport 重连后 `Client.connect()` 不会重新执行，心跳停了就没了
3. **10 次失败后静默挂住** — `reconnect_failed` 事件无人监听
4. **无手动重连入口** — 用户无法返回登录页或手动触发重连
5. **重连后数据不同步** — 服务器可能已清理 client 状态，不会重新 join team

## Proposed Solution

在 ChatView 中添加全局遮罩层，连接断开时阻塞所有交互，显示重连状态。重连成功后自动同步数据。

### 核心流程

```
WebSocket 断开 → 遮罩出现（"正在重连... (3/10)"）
                → 10 次失败后降频持续重试 + 显示"返回登录"按钮
                → 重连成功 → rejoin + 同步消息 + 刷新任务 → 遮罩消失
                → 用户点"返回登录" → 清理 client → 跳转 /
```

### 改动范围

| 改动 | 文件 | 说明 |
|------|------|------|
| 修复心跳 bug | `envoy/packages/client/client.ts` | transport 重连后重启心跳 |
| 暴露 reconnect_failed | `envoy/packages/client/client.ts` | ClientEvents 加类型，setupTransport 转发事件 |
| 持续重试 | `src/envoy/BrowserTransport.ts` | 10 次失败后不停止，降频到 30s 无限重试 |
| status 扩展 | `src/composables/useConnection.ts` | 监听 reconnect_failed，新增对应状态 |
| 重连后数据恢复 | `src/composables/useTeamClient.ts` | connected 时 rejoin + 同步消息 + 刷新任务 |
| 全局遮罩组件 | `src/components/ReconnectOverlay.vue` | 新建，毛玻璃遮罩 + 状态文字 + 返回登录按钮 |
| 集成遮罩 | `src/views/ChatView.vue` | 读取 ctx.status，非 connected 时显示遮罩 |
| 登出清理 | `src/composables/useTeamClient.ts` | 返回登录时清理 client + 路由跳转 |

## Non-goals

- 不改变现有的 transport 重连策略（指数退避），只在 10 次后增加降频持续重试
- 不添加网络质量检测（延迟、带宽等），只关注 WebSocket 连接状态
- 不处理 Manager HTTP API 的断线情况（仅 WebSocket）
- 不做断线期间的本地消息队列（消息发送失败直接提示用户）
