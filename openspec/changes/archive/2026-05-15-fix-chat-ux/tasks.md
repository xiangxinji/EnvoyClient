## 1. 依赖安装

- [x] 1.1 安装 `marked` 和 `dompurify` npm 包，安装 `@types/dompurify` 类型定义

## 2. 未读计数逻辑重构

- [x] 2.1 在 `useTeamClient.ts` 中将 `syncUnread` 替换为 `incrementUnread(peerId)` 和 `markRead(peerId)` 两个方法
- [x] 2.2 在 `on("message")` 回调中，对非当前选中 peer 的聊天消息调用 `incrementUnread`
- [x] 2.3 在 `handleTaskUpdate` 中，对非当前选中 peer 的任务通知调用 `incrementUnread`
- [x] 2.4 更新返回对象，暴露 `incrementUnread` 和 `markRead`，移除 `syncUnread`

## 3. 未读 badge 显示修复

- [x] 3.1 更新 `MemberSidebar.vue`：导入 `markRead` 替代 `syncUnread`，点击成员时调用 `markRead(peerId)` 清零
- [x] 3.2 更新 `ChatPanel.vue`：切换 peer 时调用 `markRead(newPeer)` 清零
- [x] 3.3 更新 badge 显示逻辑：1-99 显示数字，>99 显示 "99+"

## 4. Markdown 渲染实现

- [x] 4.1 在 `MessageBubble.vue` 中引入 `marked` 和 `dompurify`，创建 computed 将 `message.text` 解析为安全 HTML
- [x] 4.2 将 `{{ message.text }}` 替换为 `v-html` 绑定 computed 结果
- [x] 4.3 配置 `marked` 选项：链接 `target="_blank"`、GFM 支持

## 5. Markdown 样式（dark/light 双主题）

- [x] 5.1 在 `App.vue` 的 `:root` 和 `html.dark` 中添加 Markdown 相关 CSS 变量（代码块背景、行内代码背景、链接颜色、引用边框等）
- [x] 5.2 在 `MessageBubble.vue` 的 scoped样式中添加 `.bubble .content` 下的 Markdown 元素样式（p, code, pre, a, ul, ol, blockquote, strong, em），全部使用 CSS 变量
