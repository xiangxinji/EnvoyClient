# EnvoyClient 客户端优化清单

> 审计日期：2026-06-05

## 优先级说明

| 级别 | 含义 |
|---|---|
| **P0** | 投入产出比极高，立即修复 |
| **P1** | 高价值，近期修复 |
| **P2** | 有价值，排期修复 |
| **🔵 已规划** | OpenSpec 中已有 proposal |

---

## P0 — 立即修复 ✅

### P0-1: 路由懒加载 ✅

**文件**: `src/router.ts`

当前三个 View 全部 eagerly import，`ChatView` 拉入了整个聊天子树，首屏 bundle 达 902 kB。改为动态 import 可减小首屏 30-40%。

```ts
// 改前
import ChatView from "./views/ChatView";
// 改后
{ path: "/chat", component: () => import("./views/ChatView") }
```

### P0-2: 关键静默错误修复 ✅

用户操作失败但无任何反馈的场景：

| 场景 | 文件 | 现状 | 修复 |
|---|---|---|---|
| 头像上传失败 | `SettingsProfile/main.vue` | `catch {} // silently fail` | 加 toast 提示 |
| 任务列表加载失败 | `TaskCenterView/main.vue` | `catch {}` 空捕获 | 加 toast 提示 |
| 历史消息加载失败 | `useMessages.ts` | 仅 `console.error` | 加 toast 提示 |
| 任务结果提交失败 | `useTaskExecution.ts` | 仅 `console.error` | 加 toast 提示 |

### P0-3: TaskCenterView loading 状态不可见 ✅

**文件**: `src/views/TaskCenterView/main.vue`

`let loading = false` 是 plain 变量，模板绑定不上，用户永远看不到加载态。改为 `ref`。

---

## P1 — 近期修复 ✅

### P1-1: QuickSettingsPanel 大量重复模板 ✅

**文件**: `src/components/QuickSettingsPanel/main.vue` (311 行)

模板中 5 个完全相同的快捷键卡片（约 150 行重复代码）。提取 `ShortcutRow` 子组件，用 `v-for` 渲染。

### P1-2: 组件直接调用 managerFetch（违反架构规范） ✅

| 组件 | 应改为 |
|---|---|
| `TaskCenterView/main.vue` | `TaskService.listTasks()` |
| `LockScreen/main.vue` | 新建 `AuthService.verify()` |
| `MemberProfilePanel/main.vue` | 补到 `TaskService` 或 `UserProfileService` |

### P1-3: 重复代码提取 ✅

| 重复项 | 出现位置 | 提取目标 |
|---|---|---|
| `formatBadge()` | `ActivityBar` + `MemberSidebar` | `src/utils/formatting.ts` |
| `updateIndicator()` | `ActivityBar` + `MemberSidebar` | `useNavIndicator` composable |
| RSA+public-key fetch | `RoleSelect` + `LockScreen` | `src/utils/auth.ts` |

### P1-4: 移除冗余任务轮询 ✅

**文件**: `src/views/TaskCenterView/main.vue`

`setInterval(fetchTasks, 30000)` 完全冗余 — 已有 WebSocket `client.on("task", onTaskUpdate)` 实时接收更新。

---

## P2 — 排期修复 ✅

### P2-1: MessageBubble 加 v-memo ✅

**文件**: `src/components/MessageBubble/main.vue`

50 条消息 = 50 个实例，每次新消息导致全量重渲染。加 `v-memo="[message.id, message.text, selected]"` 阻断不必要的更新。

### P2-2: 大文件拆分（超过 250 行阈值） ✅

| 文件 | 改前行数 | 改后行数 | 拆分方案 |
|---|---|---|---|
| `SettingsKnowledge/main.vue` | 313 | 200 | → `useKnowledgeSettings` composable |
| `ChatPanel/main.vue` | 304 | 274 | → `useChatNewMessageTracker` composable |
| `RoleSelect/main.vue` | 269 | 103 | → `useAuth` composable |
| `useTeamClient.ts` | 260 | 177 | → `useTeamClientNotifications` + `useTeamClientMessageRouter` |
| `TaskCenterView/main.vue` | 277 | 124 | → `useTaskCenterData` composable |
| `CloudResourcesPanel/main.vue` | 283 | 155 | → `useCloudFiles` composable |
| `useMessages.ts` | 292 | 244 | `sendChat` → `useChatSend` |
| `reflectionMemory.ts` | 332 | 103 | → `reflection/` 子模块 (paths/sanitize/textUtils/summarize/markdown) |

### P2-3: taskCount 优化 ✅

**文件**: `src/components/ActivityBar/main.vue`

`taskCount` computed 遍历所有会话所有消息数任务 ID。改为专用计数器。

---

## 🔵 已规划（OpenSpec）

| 名称 | 内容 |
|---|---|
| style-compliance | 统一 CSS 变量，40+ 组件消除硬编码 |
| color-themes | 多主题色切换（蓝/紫） |
| agent-task-reflection | Agent 任务复盘自动写入知识库 |
| task-parallel-mode | AI 派发支持并行模式 |
