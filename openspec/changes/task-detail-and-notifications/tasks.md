## 1. Envoy Core: Resource timestamp

- [ ] 1.1 `envoy/packages/core/task.ts`: Resource 接口添加可选 `timestamp?: number` 字段
- [ ] 1.2 `envoy/packages/server/server.ts`: `addResource()` 自动填充 `timestamp: Date.now()`

## 2. Client Types

- [ ] 2.1 `src/types.ts`: TaskResource 接口添加可选 `timestamp?: number` 字段

## 3. Tauri Notification Plugin

- [ ] 3.1 `src-tauri/Cargo.toml`: 添加 `tauri-plugin-notification = "2"` 依赖
- [ ] 3.2 `src-tauri/src/lib.rs`: 注册 `.plugin(tauri_plugin_notification::init())`
- [ ] 3.3 `src-tauri/capabilities/default.json`: 添加 `"notification:default"` 权限
- [ ] 3.4 `package.json`: 安装 `@tauri-apps/plugin-notification`

## 4. TaskDetailPanel 组件

- [ ] 4.1 创建 `src/components/TaskDetailPanel.vue`: slide-over 面板，position absolute right 0，480px，slide transition
- [ ] 4.2 实现基本信息区：内容、状态徽章、模式、创建者、创建时间、尝试次数
- [ ] 4.3 实现事件时间线：基于 Resource timestamp 排序，显示创建/执行完成/审核事件，缺失 timestamp 降级处理
- [ ] 4.4 实现成员结果区：按成员分组的 client-result + execution-trace 展示
- [ ] 4.5 实现资源文件区：file-resource 列表 + 下载链接
- [ ] 4.6 实现操作按钮：根据角色/状态显示 开始/上传/完成/通过/驳回，含 ConfirmDialog
- [ ] 4.7 样式：遵循毛玻璃设计系统 (Standard glass)，CSS 变量双色逻辑

## 5. ChatView 集成

- [ ] 5.1 `ChatView.vue`: 新增 `selectedTaskId` ref，渲染 TaskDetailPanel（条件渲染 + absolute 定位）
- [ ] 5.2 `TaskCenterView.vue`: 监听 TaskCard 的 `select-task` 事件，emit 到 ChatView
- [ ] 5.3 `TaskCard.vue`: 卡片主体区域添加点击事件，emit `select-task`
- [ ] 5.4 TaskDetailPanel 操作完成后自动刷新任务数据

## 6. 桌面通知触发

- [ ] 6.1 创建通知工具函数 `src/utils/notification.ts`: 封装 sendNotification + Tauri 环境检测
- [ ] 6.2 `useTeamClient.ts` task 事件回调中：检测状态变更，触发 dispatched/completed/failed/reviewing 通知
- [ ] 6.3 实现通知去重：不向触发操作的用户自身发送通知
