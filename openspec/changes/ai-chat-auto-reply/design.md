## Context

当前 EnvoyClient 的 AI 聊天能力仅限于"建议回复"——用户点击 AI 按钮生成建议，审核后才发送。自动回复功能将 AI 直接介入消息回复流程，无需用户操作。

现有架构：
- 消息收发通过 WebSocket relay（Manager 中转）
- AI 聊天通过 `/api/ai/chat/stream`（SSE 流式）和 `/api/ai/chat/generate`（单次 JSON）两个端点
- 用户设置按 `settings.yml` 中 `users.{username}` 路径存储
- `ChatMessage` 类型定义在 `src/types.ts`，后端消息存储在 SQLite

## Goals / Non-Goals

**Goals:**
- 用户可通过设置开关控制 AI 自动回复的启用/禁用
- 开启后，收到聊天消息时 AI 自动以用户口吻生成并发送回复
- 多条连续消息通过 per-peer 5 秒防抖合并为一次回复
- 回复消息带有 `source: "ai-auto"` 标记，双方均可见
- Manager 后端可独立配置自动回复的模型和参数（新 scene）

**Non-Goals:**
- 不处理用户手动回复时取消自动回复的场景
- 不实现流式回复（自动回复使用非流式 generate）
- 不支持群聊自动回复（仅 1:1）
- 不支持用户自定义自动回复提示词
- 不增加"正在输入"或打字状态指示

## Decisions

### Decision 1: 自动回复使用非流式 API

**选择**: `POST /api/ai/chat/generate`（单次 JSON 返回）
**替代方案**: SSE 流式 `POST /api/ai/chat/stream`
**理由**: 自动回复是后台行为，无需流式展示。非流式调用更简单、更易错误处理、减少资源占用。

### Decision 2: 防抖逻辑在前端 composable 实现

**选择**: 新建 `useAutoReply.ts` composable，per-peer Timer 管理防抖
**替代方案**: 后端队列 + 延迟触发
**理由**: 前端已经拥有消息状态和 AI 调用能力，无需后端新增队列逻辑。前端防抖可随组件销毁自动清理。

### Decision 3: 消息来源标记使用 `source` 枚举字段

**选择**: `source?: "human" | "ai-auto"`
**替代方案**: 简单 `aiGenerated: boolean`
**理由**: 枚举值扩展性更好，未来可加入 `"ai-suggest"`、`"system"` 等类型，无需改字段名。

### Decision 4: 独立 scene + 独立 prompt

**选择**: 新增 `auto-reply` scene 和 `prompts/auto-reply.ts` 提示词文件
**替代方案**: 复用现有 `chat` scene 和 prompt
**理由**: 自动回复的 AI 角色是"代替用户说话"而非"助手建议"，系统提示词内容不同。独立 scene 允许管理员配置不同的模型/温度。

### Decision 5: 防抖定时器不因用户手动回复而取消

**选择**: 用户手动发消息时不影响自动回复定时器
**替代方案**: 检测到用户手动发送后取消定时器
**理由**: 按需求不处理此场景，简化逻辑。

## Risks / Trade-offs

- **[AI 回复质量不可控]** → 独立 scene 允许管理员调优模型和温度，`source` 标记让接收方知晓
- **[5 秒防抖可能导致响应延迟]** → 这是可接受的 trade-off，避免多条消息各触发一次回复
- **[并发 AI 调用可能增加 Manager 负载]** → 非流式调用比流式更轻量，且受 Manager 现有连接管理约束
- **[SQLite schema 变更需要迁移]** → 新增列 `source` 带 DEFAULT 'human'，无数据丢失风险
