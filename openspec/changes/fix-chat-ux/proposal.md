## Why

聊天消息使用纯文本插值（`{{ message.text }}`），不支持 Markdown 格式，代码块、加粗、链接等内容无法正确呈现。同时，侧边栏已有未读 badge UI，但 `syncUnread` 逻辑断裂——收消息时不增加计数、选成员时不清零——导致红点永远不显示。这两个交互缺陷严重影响日常使用体验。

## What Changes

- MessageBubble.vue 引入 Markdown 渲染，将 `{{ message.text }}` 替换为 `marked` 解析 + `v-html` 渲染，同时做 XSS 安全处理
- 为渲染后的 Markdown 元素（代码块、链接、列表、引用等）添加 dark/light 双主题 CSS 样式
- 重构 useTeamClient.ts 的未读计数逻辑：将 `syncUnread` 拆分为 `incrementUnread(peerId)` 和 `markRead(peerId)` 两个清晰方法
- 在 `on("message")` 回调中，对非当前选中 peer 调用 `incrementUnread`
- 在选成员时调用 `markRead` 清零，并更新 MemberSidebar badge 显示为微信风格（1-99 显示数字，>99 显示 "99+"）

## Capabilities

### New Capabilities
- `markdown-rendering`: 聊天消息气泡的 Markdown 解析与安全渲染，含双主题样式
- `unread-badge`: 未读消息计数与微信风格红点提醒，含增量/清零/显示逻辑

### Modified Capabilities
<!-- 无现有 spec 需要修改 -->

## Impact

- **前端依赖**: 新增 `marked` + `dompurify` npm 包
- **组件变更**: MessageBubble.vue（渲染逻辑 + 样式）、MemberSidebar.vue（badge 显示逻辑）
- **Composable 变更**: useTeamClient.ts（未读计数 API 重构）
- **样式变更**: App.vue 可能需要新增 Markdown 渲染相关的 CSS 变量
- **不影响**: Rust 后端、Manager 后端、envoy 子模块、AI 层
