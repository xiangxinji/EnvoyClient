## Why

项目已实现云资源功能（CloudResourcesPanel），用户可以上传和管理团队共享文件。但在聊天对话中，用户无法直接引用云资源来告知对方"我在说哪个文件"，只能在消息中手动输入文件名，对方也无法直接下载或跳转。需要一个与 @ 提及类似的快速引用机制，让云资源在对话中成为可交互的一等公民。

## What Changes

- 聊天编辑器支持 `#` 触发云文件/目录搜索弹出面板（DM + 频道均可用）
- 新增 Tiptap 自定义节点 `CloudReference`，在编辑器中以 chip 形式渲染被引用的文件/目录
- 消息格式新增 `cloudRefs` 字段，携带引用的云资源元数据
- 消息渲染端识别 `{cloud:name}` 标记，渲染为可交互卡片（文件显示信息+下载按钮，目录显示信息+跳转按钮）
- 后端新增云资源搜索接口 `GET /api/cloud/search`
- 后端新增云资源校验接口 `POST /api/cloud/validate`，支持批量检查路径是否仍然存在
- 消息渲染时调用校验接口，已删除资源显示"已过期"状态

## Capabilities

### New Capabilities
- `cloud-resource-mention`: 在聊天编辑器中通过 `#` 触发云资源搜索、选择并引用文件/目录，接收方在消息中查看文件信息和下载/跳转

### Modified Capabilities
- `client-rest-messaging`: POST /api/messages 请求体新增 `cloudRefs` 字段
- `markdown-rendering`: renderedHtml 管道中新增云资源标记检测与卡片渲染

## Impact

### 前端
- **新建文件**: `composables/useCloudMention.ts`, `components/CloudMentionPopup/`
- **修改文件**: `RichEditor/main.vue`（Tiptap 节点）, `ChatPanel/main.vue`（接入 composable）, `BubbleContent/main.vue`（卡片渲染）, `api.ts`（搜索+校验 API）, `types.ts`（ChatMessage 类型）, `composables/useMessages.ts`（sendChat 参数）
- **新增 i18n 条目**: cloud mention 相关文本

### 后端
- 新增 `GET /api/cloud/search?q=keyword&team=xxx` 搜索接口
- 新增 `POST /api/cloud/validate` 批量路径校验接口
- 消息存储 schema 增加 `cloudRefs` 字段
- 消息 relay 时携带 `cloudRefs`
