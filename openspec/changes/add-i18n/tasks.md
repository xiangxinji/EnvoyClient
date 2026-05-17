## 1. Infrastructure

- [x] 1.1 安装 vue-i18n 依赖（`npm install vue-i18n`）
- [x] 1.2 创建 `src/i18n/index.ts`：createI18n 实例 + useLocale composable（locale ref、switchLocale、availableLocales、localStorage 持久化）
- [x] 1.3 在 `src/main.ts` 中注册 i18n 插件（`.use(i18n)`）
- [x] 1.4 创建 `src/i18n/zh-CN.json` 翻译文件骨架，包含所有功能域的 key（common, role, chat, task, settings, notification, sidebar, titlebar）
- [x] 1.5 创建 `src/i18n/en.json` 翻译文件，结构与 zh-CN.json 完全一致

## 2. Login Page (RoleSelect)

- [x] 2.1 提取 `src/views/RoleSelect.vue` 中所有硬编码中文到翻译文件（标题、副标题、表单标签、按钮、错误提示、loading 状态）
- [x] 2.2 将模板中的硬编码文本替换为 `$t('role.*')` 调用

## 3. TitleBar

- [x] 3.1 提取 `src/components/TitleBar.vue` 中的中文（tooltip："浅色模式"/"深色模式"）到翻译文件
- [x] 3.2 替换为 `t('titlebar.*')` 调用

## 4. MemberSidebar

- [x] 4.1 提取 `src/components/MemberSidebar.vue` 中的中文（"任务中心"、"分派任务"、"成员"、"在线"、"离线"、"设置"等）到翻译文件
- [x] 4.2 替换为 `t('sidebar.*')` 调用

## 5. ChatPanel & MessageBubble

- [x] 5.1 提取 `src/components/ChatPanel.vue` 中的中文（"选择一位成员开始聊天"、"AI 建议"、"采纳"、"忽略"、输入框占位符等）到翻译文件
- [x] 5.2 替换 ChatPanel 模板和脚本中的硬编码文本为 `t('chat.*')` 调用
- [x] 5.3 提取 `src/components/MessageBubble.vue` 中的中文（"已撤回"、时间格式、AI auto reply 徽章等）到翻译文件
- [x] 5.4 替换 MessageBubble 中的硬编码文本为 `t('chat.*')` 调用

## 6. Task Center & Task Cards

- [x] 6.1 提取 `src/views/TaskCenterView.vue` 中的中文（状态分组标题："执行中"、"等待中"、"审查中"、"已完成"、"失败"、空状态文本）到翻译文件
- [x] 6.2 替换 TaskCenterView 中的硬编码文本为 `t('task.*')` 调用
- [x] 6.3 提取 `src/components/TaskCard.vue` 中的中文（状态标签、资源标签、时间标签）到翻译文件
- [x] 6.4 替换 TaskCard 中的硬编码文本为 `t('task.*')` 调用，统一使用 `task.status.*` key

## 7. Task Detail & Dispatch

- [x] 7.1 提取 `src/components/TaskDetailPanel.vue` 中的中文（状态标签、操作按钮、确认弹窗文本、timeline 标签、资源下载等）到翻译文件
- [x] 7.2 替换 TaskDetailPanel 中的硬编码文本为 `t('task.*')` 调用
- [x] 7.3 提取 `src/views/TaskDispatchPanel.vue` 中的中文（面板标题、表单标签、AI 匹配相关文本、按钮等）到翻译文件
- [x] 7.4 替换 TaskDispatchPanel 中的硬编码文本为 `t('task.*')` 调用

## 8. Settings Panel

- [x] 8.1 提取 `src/components/SettingsPanel.vue` 中的中文（"设置"、所有设置标签和提示、"手动"/"自动接管"、"退出登录"、确认弹窗等）到翻译文件
- [x] 8.2 替换 SettingsPanel 中的硬编码文本为 `t('settings.*')` 调用
- [x] 8.3 在 SettingsPanel 中新增语言切换设置项（GlassSelect + useLocale），标签使用原生语言显示

## 9. Dialogs & Misc Components

- [x] 9.1 提取 `src/components/CloseConfirmDialog.vue` 中的中文到翻译文件并替换为 `t()` 调用
- [x] 9.2 提取其他组件中的中文（BackButton, GlassSelect, RichEditor, ConfirmDialog, LoginSettings, QuickSettingsPanel）

## 10. Composables (notification text)

- [x] 10.1 提取 `src/composables/useTeamClient.ts` 中的桌面通知文本（"新任务"、"任务完成"、"任务失败"、"任务待审核"）到翻译文件
- [x] 10.2 替换为 `t('notification.*')` 调用
- [x] 10.3 提取 `src/composables/useGlobalShortcuts.ts` 中的通知文本到翻译文件并替换
- [x] 10.4 提取 `src/utils/notification.ts` 中的中文（"下载失败"等）到翻译文件并替换

## 11. Verification

- [x] 11.1 全局搜索 `src/` 中剩余的中文字符（排除 `tools.ts`、翻译文件、注释），确认无遗漏
- [ ] 11.2 启动应用测试：切换语言后所有界面文本正确切换，默认为简体中文
- [ ] 11.3 验证 localStorage 持久化：切换为英文后重启应用仍为英文
