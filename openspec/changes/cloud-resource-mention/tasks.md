## 1. 类型与 API 层

- [x] 1.1 在 `src/types.ts` 中定义 `CloudRef` 接口（name, path, type, size），在 `ChatMessage` 中新增 `cloudRefs?: CloudRef[]` 字段
- [x] 1.2 在 `src/api.ts` 中新增 `searchCloudFiles(team, query)` 函数，调用 `GET /api/cloud/search?q=...&team=...`
- [x] 1.3 在 `src/api.ts` 中新增 `validateCloudPaths(team, paths)` 函数，调用 `POST /api/cloud/validate`

## 2. Tiptap CloudReference 节点

- [x] 2.1 创建 `src/components/RichEditor/cloudReferenceNode.ts`，定义 Tiptap 自定义节点（inline atom，属性 name/path/type/size，渲染为 chip span）
- [x] 2.2 修改 `src/components/RichEditor/main.vue`，注册 CloudReference 节点扩展
- [x] 2.3 修改 `RichEditor` 的 `extractText()`，遇到 CloudReference 节点时输出 `{cloud:N}` 标记（按出现顺序索引）

## 3. useCloudMention Composable

- [x] 3.1 创建 `src/composables/useCloudMention.ts`，实现 `#` 触发检测（正则 `/#([\w.\-]*)$/`），管理 cloudPopupVisible / cloudQuery / currentCloudRefs 状态
- [x] 3.2 实现 `handleCloudSelect(item)` 方法：删除 `#query` 文本，插入 CloudReference Tiptap 节点，添加到 currentCloudRefs
- [x] 3.3 实现 `handleEditorKeydown` 拦截（弹窗可见时拦截 Arrow/Enter/Tab/Escape），合并或协调与现有 mention 的键盘拦截逻辑
- [x] 3.4 实现 `clearCloudRefs()` 方法（发送后清空状态）

## 4. CloudMentionPopup 组件

- [x] 4.1 创建 `src/components/CloudMentionPopup/main.vue`，接收 visible/query props，调用 searchCloudFiles API 获取结果列表
- [x] 4.2 实现搜索结果列表渲染（FileIcon + 文件名 + 路径），支持键盘导航（ArrowUp/Down/Enter/Tab/Escape）
- [x] 4.3 创建 `src/components/CloudMentionPopup/styles.css`，复用 MentionPopup 的 glass-morphism 风格
- [x] 4.4 处理空结果和无搜索结果状态显示

## 5. ChatPanel 接入

- [x] 5.1 修改 `src/components/ChatPanel/main.vue`，引入 useCloudMention composable，绑定 RichEditor 的 input 和 keydown 事件
- [x] 5.2 在模板中添加 CloudMentionPopup 组件（v-if 绑定 cloudPopupVisible，位置与 MentionPopup 一致）
- [x] 5.3 修改 `enterSendDisabled` 逻辑，同时覆盖 @ 提及弹窗和 # 云资源弹窗
- [x] 5.4 修改 `handleRichSend`，将 currentCloudRefs 传递给 sendChat 的 cloudRefs 参数
- [x] 5.5 发送后调用 clearCloudRefs()

## 6. sendChat 扩展

- [x] 6.1 修改 `src/composables/useMessages.ts` 的 `sendChat` 函数签名，接受可选 `cloudRefs` 参数
- [x] 6.2 sendChat 将 cloudRefs 包含在 POST /api/messages 请求 body 中
- [x] 6.3 sendChat 将 cloudRefs 包含在本地 ChatMessage 对象中（乐观更新）
- [x] 6.4 handleIncomingMessage 解析消息 payload 中的 cloudRefs 字段

## 7. BubbleContent 云资源卡片渲染

- [x] 7.1 修改 `src/components/BubbleContent/main.vue` 的 `renderedHtml`，在 markdown 渲染前检测 `{cloud:N}` 标记替换为占位符，markdown 渲染后替换为卡片 HTML
- [x] 7.2 实现文件卡片 HTML 渲染（FileIcon + 文件名 + 格式化大小 + 下载链接）
- [x] 7.3 实现目录卡片 HTML 渲染（文件夹图标 + 目录名 + "在云盘中打开"按钮）
- [x] 7.4 实现标记索引越界容错（保留原始文本）
- [x] 7.5 添加云资源卡片 CSS 样式（glass 风格，与附件卡片协调）

## 8. 过期校验

- [x] 8.1 BubbleContent `onMounted` 中收集消息所有 cloud ref 路径，调用 validateCloudPaths 批量校验
- [x] 8.2 校验结果存为响应式 Map（path → boolean）
- [x] 8.3 卡片根据校验结果显示"已过期"降级状态（灰色样式，移除下载/跳转按钮）
- [x] 8.4 校验请求失败时静默降级（卡片保持正常显示）

## 9. i18n 与收尾

- [x] 9.1 在 `src/i18n/zh-CN.json` 和 `src/i18n/en.json` 中添加云资源引用相关文案（已过期、无匹配文件、下载、在云盘中打开等）
- [ ] 9.2 端到端测试：输入 # → 搜索 → 选择 → 发送 → 接收方渲染卡片 → 下载/跳转 → 过期状态显示
