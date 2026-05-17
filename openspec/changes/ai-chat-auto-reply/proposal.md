## Why

团队协作场景中，成员可能暂时无法回复消息但仍希望保持沟通连贯性。需要 AI 自动接管聊天回复能力——当用户开启设置后，收到的消息由 AI 以用户口吻自动生成回复，确保消息不遗漏、协作不中断。

## What Changes

- 新增 `ai_auto_reply` 用户级设置开关，控制是否启用聊天 AI 自动接管
- 扩展 `ChatMessage` 类型，新增 `source` 字段（`"human" | "ai-auto"`），标记消息来源
- 后端消息存储、relay、同步全链路透传 `source` 字段（SQLite 新增列 + API 请求/响应）
- 新增 `useAutoReply` composable，实现 per-peer 5 秒防抖合并 + 非流式 AI 调用 + 自动发送回复
- 新增专用系统提示词 `auto-reply`（独立 prompt 文件 + 新 scene），以用户口吻代替回复，不暴露 AI 身份
- `MessageBubble` 组件根据 `source === "ai-auto"` 渲染 AI 生成标记 badge，发送方和接收方均可见
- `SettingsPanel` 新增 AI 自动回复开关 UI

## Capabilities

### New Capabilities
- `ai-chat-auto-reply`: AI 聊天自动回复——收到消息后 AI 自动生成回复，包括防抖合并逻辑、专用提示词、设置开关、消息来源标记与 UI 渲染

### Modified Capabilities
- `team-chat`: 消息类型扩展 `source` 字段，后端全链路透传
- `member-settings`: 新增 `ai_auto_reply` 设置项
- `scene-model-mapping`: 新增 `auto-reply` scene 类型

## Impact

- **前端类型**: `src/types.ts` ChatMessage 接口扩展
- **前端 composable**: `src/composables/useAutoReply.ts`（新建）、`useMessages.ts`（接入触发点）
- **前端组件**: `SettingsPanel.vue`（新增开关）、`MessageBubble.vue`（AI 标记 badge）
- **后端消息路由**: `manager/server/routes/messages.ts`（接受/存储/透传 source 字段）
- **后端数据库**: messages 表新增 `source` 列
- **后端 AI 服务**: 新增 `prompts/auto-reply.ts` prompt 文件
- **后端 AI 设置**: 新增 `auto-reply` scene 注册
- **共享类型**: `shared/types/ai.ts` SceneType 扩展
