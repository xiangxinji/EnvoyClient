# EnvoyClient 项目规范

## Composable 使用规范

### useToast — Toast 提示

**文件**: `src/composables/useToast.ts`

所有需要 Toast 提示的组件必须使用 `useToast` composable，禁止手动管理 `toastVisible/toastMessage/toastType` 状态。

```ts
import { useToast } from "../../composables/useToast";

const { toastVisible, toastMessage, toastType, showToast, hideToast } = useToast();
```

**模板用法**:
```vue
<Toast :visible="toastVisible" :message="toastMessage" :type="toastType" @done="hideToast" />
```

**调用方式**:
```ts
showToast("操作成功", "success");
showToast("操作失败", "error");
showToast("提示信息", "info");
```

**设置保存操作必须使用 Toast 提示**:
所有设置类面板（SettingsProfile、SettingsPanel、SettingsGeneral 等）中的保存操作，成功后必须调用 `showToast(t('common.saved'), "success")` 提示用户，失败时调用 `showToast(t('common.operationFailed'), "error")`。禁止使用按钮文字切换（如 "保存" → "已保存"）的方式代替 Toast。

### useConfirm — 确认对话框

**文件**: `src/composables/useConfirm.ts`

所有需要确认对话框的组件必须使用 `useConfirm` composable，禁止手动管理 `confirmVisible/confirmTitle/confirmMessage/confirmDanger/pendingAction` 状态。

```ts
import { useConfirm } from "../../composables/useConfirm";

const { confirmVisible, confirmTitle, confirmMessage, confirmDanger, showConfirm, handleConfirm, handleCancel } = useConfirm();
```

**模板用法**:
```vue
<ConfirmDialog
  :visible="confirmVisible"
  :title="confirmTitle"
  :message="confirmMessage"
  :danger="confirmDanger"
  @confirm="handleConfirm"
  @cancel="handleCancel"
/>
```

**调用方式**:
```ts
// 普通确认
showConfirm("确认标题", "确认消息", () => {
  // 确认后执行的操作
});

// 危险操作确认（红色按钮）
showConfirm("删除确认", "确定要删除吗？", () => {
  // 删除操作
}, true);
```

## 代码结构原则

1. **禁止重复状态管理**: 如果多个组件存在相同的状态管理模式（如 Toast、Confirm），必须提取为 composable 复用
2. **Composable 命名**: 以 `use` 前缀命名，文件放在 `src/composables/` 目录
3. **组件职责单一**: 组件中不应包含可提取的通用逻辑，如 Toast 显示、确认弹窗等
4. **先写测试再写功能**: 所有后端（`manager/server/`）新增功能或修改已有功能时，必须先编写单元测试，再编写实现代码。测试必须覆盖核心业务逻辑（CRUD、状态流转、错误处理）和授权拦截（无 token → 401），使用内存数据库（`:memory:` SQLite）隔离，禁止依赖文件系统或网络
5. **所有接口必须有授权**: 后端新增 API 端点时，必须首先确定授权策略（`adminAuth` / `clientAuth` / `dualAuth`），然后添加中间件并编写授权测试。仅登录、公钥、健康检查等公开端点可豁免。详见 `manager/CLAUDE.md` 的「授权规范」章节

## 组件拆分规范

### 文件大小阈值

- 单文件组件（`main.vue`）script + template 超过 **250 行**时应考虑拆分
- 超过 **350 行**时必须拆分

### 拆分策略

1. **重复业务逻辑 → composable**: 多个组件共享的操作逻辑（如任务操作、文件下载）必须提取为 composable，禁止复制粘贴
2. **重复模板片段 → 子组件**: 模板中相同结构出现 2 次以上时，必须提取为子组件
3. **大段 CSS 变量 → 独立样式文件**: 全局 CSS 变量（如主题色）应放在 `src/styles/` 目录，不在组件中定义
4. **内嵌对话框/浮层 → 独立组件**: 组件内的 Teleport 弹窗（如全屏图片查看器、转发对话框）应提取为独立组件

### 弹框组件规范

所有弹框（Dialog/Modal）组件必须遵循以下规范：

1. **遵循毛玻璃设计规范**: 弹框背景使用 `--glass-bg-heavy`，边框使用 `--glass-border`，阴影使用 `--glass-shadow-heavy`，模糊使用 `--glass-blur`。遮罩层使用半透明背景（`rgba(0,0,0,0.4)` 亮色 / `rgba(0,0,0,0.6)` 暗色）。禁止硬编码背景色。

2. **默认聚焦首个输入框**: 弹框内部包含 `<input>`、`<textarea>` 或 `GlassInput` 等输入控件时，打开后必须自动聚焦第一个输入框。使用 `nextTick` + `focus()` 实现：
   ```ts
   watch(visible, (val) => {
     if (val) {
       nextTick(() => {
         firstInputRef.value?.focus();
       });
     }
   });
   ```

3. **必须有唤起动效**: 弹框出现时必须使用 `scaleIn` 动效（缩放 + 淡入），遮罩层使用淡入。使用 `@vueuse/motion` 实现，禁止使用 CSS `@keyframes`：
   ```vue
   <!-- 遮罩层 -->
   <Transition name="fade">
     <div v-if="visible" class="overlay" />
   </Transition>
   <!-- 弹框主体 -->
   <div v-if="visible"
        v-motion:initial="{ opacity: 0, scale: 0.95 }"
        v-motion:enter="{ opacity: 1, scale: 1, transition: { type: 'spring', stiffness: 300, damping: 25 } }"
        class="dialog">
   </div>
   ```

4. **支持 ESC 关闭**: 弹框打开时必须监听 `Escape` 键关闭弹框，使用 `@vueuse/core` 的 `onKeyStroke` 或 `useEventListener` 实现，确保在组件卸载时自动清理：
   ```ts
   import { useEventListener } from "@vueuse/core";

   useEventListener("keydown", (e) => {
     if (e.key === "Escape" && visible.value) {
       visible.value = false;
     }
   });
   ```

5. **点击遮罩层不关闭弹框**: 遮罩层的 `click` 事件不得触发关闭操作。弹框仅通过明确操作（关闭按钮、确认/取消按钮、ESC 键）关闭，防止用户误触丢失已填写内容。

## 通用工具函数规范

### 平台判断 — `src/utils/platform.ts`

**禁止内联 `"__TAURI_INTERNALS__" in window`**，必须从 `platform.ts` 导入。

```ts
import { isTauri, safeInvoke } from "../utils/platform";

// isTauri — 运行时判断是否在 Tauri 环境
if (isTauri) { ... }

// safeInvoke — 安全调用 Tauri invoke，非 Tauri 环境返回 null
const result = await safeInvoke<Settings>("get_settings");
```

### 错误消息提取 — `src/utils/error.ts`

**禁止内联 `e instanceof Error ? e.message : String(e)`**，必须使用 `getErrorMessage`。

```ts
import { getErrorMessage } from "../utils/error";

catch (e: unknown) {
  console.error("操作失败:", getErrorMessage(e));
}
```

### 文件大小格式化 — `src/utils/taskFormatters.ts`

`formatFileSize` 的唯一实现在 `taskFormatters.ts`，禁止在其他文件重复定义。

```ts
import { formatFileSize } from "../../utils/taskFormatters";
```

### 任务状态标签 — `src/utils/taskFormatters.ts`

`getStatusLabels(t)` 返回 `Record<TaskMessage["status"], string>`，禁止在组件内重复定义 `statusLabels` 映射。

```ts
import { getStatusLabels } from "../../utils/taskFormatters";
const statusLabels = getStatusLabels(t);
```

### POST 请求 — `managerPost`

所有 POST JSON 请求必须使用 `managerPost`，禁止手动构造 `method: "POST"` + `Content-Type` + `JSON.stringify`。

```ts
import { managerPost } from "../../api";

const res = await managerPost("/api/path", { key: "value" });
```

仅 SSE 流式请求（需读取 `response.body`）可使用 `managerFetch` 手动构造。

### 头像初始字母 — `getInitial`

**禁止内联 `.charAt(0).toUpperCase()`**，必须使用 `useUserProfile` 的 `getInitial`。

```ts
const { getInitial } = useUserProfile();
{{ getInitial(username) }}
```

### 文件选择器 — `pickFiles`

**禁止内联 `document.createElement("input")` 文件选择器**，必须使用 `pickFiles` 工具函数。

```ts
import { pickFiles } from "../utils/filePicker";

const files = await pickFiles({ accept: "image/*", multiple: true });
```

### 任务映射 — `apiTaskToTaskMessage`

**禁止内联 API task → TaskMessage 映射**，必须使用 `taskFormatters.ts` 的 `apiTaskToTaskMessage`。

```ts
import { apiTaskToTaskMessage, type ApiTask } from "../../utils/taskFormatters";
const taskMsg = apiTaskToTaskMessage(apiTask);
```

### 资源类型安全 — `TypedTaskResource`

`useTaskResources` 返回的 `leaderReviews` 和 `fileResources` 已是 `TypedTaskResource<LeaderReviewData>` 和 `TypedTaskResource<FileResourceData>` 类型，**禁止 `as any` 或 `as Record<string, unknown>` 类型转换**，直接访问 `review.data.success`、`res.data.filename` 等属性。

## SVG 图标使用规范

### 禁止内联 SVG

**所有组件中禁止使用内联 `<svg>` 标签**，必须通过 `SvgIcon` 组件引用图标文件。

**文件结构**:
- 图标组件: `src/components/SvgIcon/main.vue`
- 图标注册: `src/assets/icons/index.ts`
- 图标文件: `src/assets/icons/*.svg`

### 添加新图标

1. 在 `src/assets/icons/` 目录下创建 `.svg` 文件（文件名即图标名）
2. SVG 文件需包含 `xmlns`、`viewBox`、`fill="none"`、`stroke="currentColor"`、`stroke-width="2"` 等标准属性
3. 无需手动注册，`index.ts` 通过 `import.meta.glob` 自动加载

### 使用方式

```vue
<script setup lang="ts">
import SvgIcon from "../SvgIcon";
</script>

<template>
  <SvgIcon name="check-circle" :size="16" />
  <SvgIcon name="close" size="12" />
</template>
```

### 现有图标列表

cloud, tasks, lightning, search, keyboard, chat, settings, plus, close, check, check-circle, check-square, more-vertical, forward, reply, delete-back, paperclip, smile, chevron-right, zoom-out, zoom-in, rotate-ccw, rotate-cw, refresh, download, file, trash, camera, log-out

## AI 功能架构

系统 AI 功能分为三个独立层：聊天建议、任务管理、Agent 执行。每层有独立的 composable 和 API 端点，错误状态互不干扰。

### useAIChat — 聊天建议

**文件**: `src/composables/useAIChat.ts`

SSE 流式生成聊天回复建议。通过 `/api/ai/chat/stream` 端点获取流式文本，内含通用 SSE 解析器 `consumeSSE`。

```ts
import { useAIChat } from "../../composables/useAIChat";

const { suggestion, isStreaming, aiError, aiAvailable, suggestReply, acceptSuggestion, clearSuggestion } = useAIChat();
```

- `suggestReply(messages, context?)` — 取最近 N 条消息（N 由 `ai_suggestion_history_count` 控制），SSE 流式生成建议
- `acceptSuggestion()` — 返回建议文本并清空
- `clearSuggestion()` — 清空建议和错误状态
- `aiAvailable` — 通过 `/api/ai/health` 健康检查判断 AI 是否可用
- **使用方**: `ChatPanel/main.vue`（闪电按钮触发）

### useAITask — 任务 AI 管理

**文件**: `src/composables/useAITask.ts`

任务生命周期中的 AI 辅助操作。全部通过 `managerPost` 发送 POST 请求。

```ts
import { useAITask } from "../../composables/useAITask";

const { aiAvailable, aiError, planTask, dispatchTask, analyzeTaskResult, reviewTaskResult } = useAITask();
```

| 方法 | API 端点 | 用途 |
|---|---|---|
| `planTask(description, members)` | `/api/ai/task/generate` | 根据描述和成员生成任务计划 |
| `dispatchTask(description, members)` | `/api/ai/task/dispatch` | AI 调度任务到指定成员，返回 `{ subscribe, content }` |
| `analyzeTaskResult(desc, results)` | `/api/ai/task/analyze` | 分析任务执行结果 |
| `reviewTaskResult(content, resources)` | `/api/ai/task/review` | Leader AI 评审成员结果，返回 `{ success, summary }` |

- **使用方**: `TaskDispatchPanel/main.vue`（AI 调度）、`useTaskExecution.ts`（Leader 评审）

### useAutoReply — 自动回复

**文件**: `src/composables/useAutoReply.ts`

收到消息后自动生成并发送 AI 回复。每个 peer 维护独立 5 秒防抖定时器。

```ts
import { useAutoReply } from "../../composables/useAutoReply";

const autoReply = useAutoReply({
  myId, teamName, role,
  getConversation: (peerId) => conversations[peerId],
  sendChat: (targetId, text, { source: "ai-auto" }) => { ... },
});
```

- `trigger(peerId, historyCount)` — 触发防抖定时器，5 秒后调用 `/api/ai/auto-reply/generate` 生成回复并自动发送
- `dispose()` — 清理所有定时器
- **触发条件**: `useTeamClient` 收到消息时检查 `ai_auto_reply` 设置，开启时调用 `trigger`
- **跳过条件**: 频道消息（`channel` 类型）不触发自动回复

### useTaskExecution — Agent 任务执行

**文件**: `src/composables/useTaskExecution.ts`

编排 Agent 自动执行任务，由 `task_execution_mode` 设置控制。

```ts
import { useTaskExecution } from "../../composables/useTaskExecution";

const { agent, registerHandler } = useTaskExecution({ role: "member", myId, teamName });
```

**执行流程**:
1. `registerHandler(client)` — 注册 `client.doing` 回调
2. 收到任务时检查 `task_execution_mode`，`manual` 模式返回 `SKIP_RESULT`
3. **Leader 评审路径** (`role=leader`, `status=reviewing`): 调用 `reviewTaskResult` 评审
4. **Member 执行路径**: 标记任务 running → 加载技能目录 → 调用 `agent.runAgent` → 上报结果
5. 非 Tauri 环境降级为 browser mode（无 Agent 工具）

### useAgent — Agent 运行器

**文件**: `src/composables/useAgent.ts`

封装 ReAct 循环调用。`reactLoop` 定义在 `src/agent/react.ts`。

```ts
const { isRunning, currentStep, error, runAgent } = useAgent();
const result = await runAgent(taskContent, tools, workspacePath, skillCatalog);
// result: { result: string, trace: AgentStep[] }
```

- 最多 20 步（`MAX_STEPS`）
- 每步调用 `/api/ai/agent/reason` 获取推理 + 工具调用
- 工具执行超时 60 秒，推理超时 120 秒
- 输出截断：stdout > 2000 字符、stderr > 1000 字符

### Agent Tools — 工具集

**文件**: `src/agent/tools.ts`（内置工具）+ `src/agent/resourceTools.ts`（资源工具）

| 工具名 | 文件 | 用途 | 环境要求 |
|---|---|---|---|
| `shell` | tools.ts | 执行 shell 命令 | Tauri |
| `file_read` | tools.ts | 读取本地文件 | Tauri |
| `file_write` | tools.ts | 写入本地文件 | Tauri |
| `done` | tools.ts | 声明任务完成，终止 ReAct 循环 | - |
| `upload_resource` | resourceTools.ts | 上传文件到 Manager 作为任务资源 | Tauri |
| `query_resources` | resourceTools.ts | 查询任务的资源文件列表 | - |
| `read_resource` | resourceTools.ts | 读取任务资源文件内容 | - |
| `read_skill` | resourceTools.ts | 读取 `~/.envoy/brains/{user}/skills/` 下的技能文件 | Tauri |
| `cloud_list` | tools.ts | 列出团队云资源目录 | - |
| `cloud_upload` | tools.ts | 上传文件内容到团队云资源 | - |

### AI 相关类型

**文件**: `src/types.ts`

| 类型 | 用途 |
|---|---|
| `AIHealthResponse` | AI 健康检查响应 `{ configured, provider?, model? }` |
| `AgentResult` | Agent 运行结果 `{ result, trace }` |
| `AgentStep` | 单步执行记录 `{ index, reasoning, toolCalls, toolResults }` |
| `AgentToolCall` | 工具调用 `{ id, name, args }` |
| `AgentReasonResponse` | 推理响应 `{ text, toolCalls }` |
| `SkillCatalogResponse` | 技能目录 `{ skills: [{ name, description, filename }] }` |

### AI 相关设置

以下设置通过 `useMemberSettings` 管理，存储在 settings.yml 的 `users.{username}` 下：

| 字段 | 类型 | 默认值 | 用途 |
|---|---|---|---|
| `ai_auto_reply` | boolean | `false` | 是否自动回复 |
| `ai_suggestion_history_count` | number | `5` | AI 建议/自动回复的上下文消息条数 |
| `task_execution_mode` | `"auto" \| "manual"` | `"auto"` | Agent 自动执行模式 |
| `working_directory` | string | `""` | Agent 工作目录，空则用 `~/.envoy/workspace/{username}` |
| `shortcut_auto_reply` | string | `""` | 切换自动回复的快捷键 |

## 设计规范

### 毛玻璃效果规范

所有使用毛玻璃效果的组件必须通过 CSS 变量引用，禁止硬编码 `backdrop-filter` 和 `background` 值。

**CSS 变量定义** (`src/styles/variables.css`):

| 变量 | 亮色模式 | 暗色模式 | 用途 |
|---|---|---|---|
| `--glass-bg` | `rgba(255,255,255,0.35)` | `rgba(28,28,30,0.35)` | 普通毛玻璃背景 |
| `--glass-bg-heavy` | `rgba(255,255,255,0.5)` | `rgba(28,28,30,0.5)` | 对话框/面板等重背景 |
| `--glass-bg-light` | `rgba(255,255,255,0.25)` | `rgba(28,28,30,0.25)` | 轻量卡片/标签背景 |
| `--glass-border` | `rgba(255,255,255,0.5)` | `rgba(255,255,255,0.15)` | 毛玻璃边框 |
| `--glass-blur` | `40px` | `40px` | 毛玻璃模糊强度 |
| `--glass-shadow` | `0 4px 24px rgba(0,0,0,0.06)` | `0 4px 24px rgba(0,0,0,0.3)` | 普通阴影 |
| `--glass-shadow-heavy` | `0 8px 40px rgba(0,0,0,0.12)` | `0 8px 40px rgba(0,0,0,0.5)` | 重阴影 |

**标准用法**:
```css
.glass-panel {
  background: var(--glass-bg);
  backdrop-filter: blur(var(--glass-blur));
  -webkit-backdrop-filter: blur(var(--glass-blur));
  border: 1px solid var(--glass-border);
  box-shadow: var(--glass-shadow);
}
```

### 组件样式规范

**CSS 必须写在 `styles.css` 中**，禁止在 `.vue` 文件的 `<style scoped>` 内联样式（除非只有 1-2 行）。

```
src/components/ComponentName/
├── main.vue      → <style scoped>@import './styles.css';</style>
└── styles.css    → 所有样式定义
```

### 卡片组件统一风格

文件卡片、云资源卡片、引用卡片等所有卡片组件必须保持一致的毛玻璃卡片风格：

```css
.card {
  display: flex; align-items: center; gap: var(--space-sm);
  padding: var(--space-sm) var(--space-md);
  background: var(--glass-bg-light);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  transition: border-color 0.15s, background 0.15s;
  width: fit-content; min-width: 160px; max-width: 280px;
}
.card:hover { border-color: var(--accent); background: var(--glass-bg); }
```

### 交互动效规范

项目使用 `@vueuse/motion` 作为交互动效库，禁止使用其他动画方案。

**安装**: `npm install @vueuse/motion`
**注册**: 在 `main.ts` 中 `createApp(App).use(MotionPlugin)`

#### 动效预设 — `src/styles/motion-presets.ts`

所有动效必须引用预设，禁止在组件中内联 magic number：

```ts
export const motionPresets = {
  // ── 入场 ──
  fadeUp: {
    initial: { opacity: 0, y: 20 },
    enter: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 200, damping: 20 } },
  },
  scaleIn: {
    initial: { opacity: 0, scale: 0.92 },
    enter: { opacity: 1, scale: 1, transition: { type: "spring", stiffness: 300, damping: 25 } },
  },
  slideLeft: {
    initial: { opacity: 0, x: -30 },
    enter: { opacity: 1, x: 0, transition: { type: "spring", stiffness: 200, damping: 22 } },
  },
  slideRight: {
    initial: { opacity: 0, x: 30 },
    enter: { opacity: 1, x: 0, transition: { type: "spring", stiffness: 200, damping: 22 } },
  },
  slideUp: {
    initial: { opacity: 0, y: 10 },
    enter: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 25 } },
  },
  popIn: {
    initial: { opacity: 0, scale: 0.6 },
    enter: { opacity: 1, scale: 1, transition: { type: "spring", stiffness: 400, damping: 15 } },
  },
  // ── 交互反馈 ──
  pressScale: {
    initial: { scale: 1 },
    enter: { scale: 1 },
    tapped: { scale: 0.96, transition: { type: "spring", stiffness: 400, damping: 17 } },
  },
};
```

#### 一、侧边栏动效

##### 选中指示器滑动

侧边栏选中项的左侧高亮条必须实现平滑滑动动画，禁止瞬间跳转。使用 CSS `transition: top 0.3s cubic-bezier(0.16, 1, 0.3, 1)` 或绝对定位 + transform 驱动。

```css
.sidebar-indicator {
  position: absolute;
  left: 0;
  width: 3px;
  height: 36px;
  background: var(--accent);
  border-radius: 0 2px 2px 0;
  transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}
```

通过计算选中项的 `offsetTop` 设置 `transform: translateY(Npx)`，避免为每个列表项维护独立的高亮 DOM。

##### 未读徽章弹入

未读数字/圆点出现时使用 `popIn` 预设（scale 0.6 → 1 的弹性动画），消失时使用 `scale: 0` + `opacity: 0` 的快速淡出（150ms）。

##### 在线状态变化

成员在线/离线状态切换时，头像状态指示点使用 200ms 的 `background-color` 渐变 + 微妙的 `scale(1.2) → scale(1)` 脉冲。

##### 搜索框展开/收起

搜索框宽度使用 `transition: width 0.25s cubic-bezier(0.16, 1, 0.3, 1)`，展开时伴随 `opacity` 淡入。

#### 二、面板切换动效

右侧内容区（聊天、任务中心、任务详情、云盘、设置）之间的切换必须带方向感过渡。

**方向规则**:

| 从 → 到 | 方向 | 预设 |
|---|---|---|
| 聊天/列表 → 详情/设置 | 向左滑出，新面板从右侧滑入 | `slideLeft` / `slideRight` |
| 详情/设置 → 聊天/列表 | 向右滑出，面板从左侧滑入 | `slideRight` / `slideLeft` |
| 同级切换（频道 ↔ 私聊） | 淡入淡出 | `fadeUp` |
| 设置子面板切换 | 淡入淡出 | `fadeUp` |

**实现方式**: 在 `ChatView` 中为右侧内容区包裹 `<Transition>` 组件，根据切换前后的面板类型动态选择过渡方向。使用 `mode="out-in"` 确保旧面板先离开。

```vue
<Transition :name="panelTransition" mode="out-in">
  <ChatPanel v-if="isChat" key="chat" />
  <TaskDetailPanel v-else-if="isTaskDetail" key="task-detail" />
  <CloudResourcesPanel v-else-if="isCloud" key="cloud" />
  <!-- ... -->
</Transition>
```

过渡 CSS 使用 `slide-left`、`slide-right`、`fade-up` 三套 class。

#### 三、消息动效

##### 消息入场

新到达的消息（底部追加）使用现有的 `message-pop` keyframe，保持不变。

首次进入对话或加载历史消息时，消息列表使用 **staggered 入场**：前 20 条消息从上到下依次淡入，每条间隔 30ms。使用 `@vueuse/motion` 的 `:delay` 参数：

```vue
<div v-for="(msg, i) in messages" :key="msg.id"
     v-motion:initial="{ opacity: 0, y: 10 }"
     v-motion:enter="{ opacity: 1, y: 0, transition: { delay: i * 30, duration: 200 } }">
```

超过 20 条的早期消息不执行入场动画，直接显示。

##### 打字指示器

对方正在输入时显示三点跳动指示器，使用 CSS `@keyframes` 实现交错弹跳：

```css
.typing-dot:nth-child(1) { animation: typing-bounce 1.4s ease-in-out infinite; }
.typing-dot:nth-child(2) { animation: typing-bounce 1.4s ease-in-out 0.2s infinite; }
.typing-dot:nth-child(3) { animation: typing-bounce 1.4s ease-in-out 0.4s infinite; }
```

指示器容器使用 `slideUp` 预设入场。

##### 消息发送反馈

点击发送后，输入框内容清空时使用 `scale(0.98) → scale(1)` 的微弹效果，给出"消息已发出"的触感。

#### 四、任务卡片动效

##### 状态变化视觉反馈

任务状态流转时，卡片必须给出即时视觉反馈：

| 状态变化 | 动效 |
|---|---|
| 任意 → `running` | 边框闪烁 accent 色（`box-shadow` 脉冲一次），然后左侧出现持续流动的渐变光带 |
| 任意 → `completed` | 卡片 `scale(1.02) → scale(1)` 弹跳 + 勾选图标 `popIn` 入场 |
| 任意 → `failed` | 卡片水平 `shake`（左右抖动 2 次） |
| 任意 → `reviewing` | 边框变为 accent 色的脉冲呼吸（`box-shadow` 重复明暗） |

**Running 状态光带**:

```css
.task-card--running::before {
  content: "";
  position: absolute;
  left: 0; top: 0; bottom: 0;
  width: 3px;
  background: linear-gradient(180deg, transparent, var(--accent), transparent);
  background-size: 100% 200%;
  animation: task-running-flow 2s ease-in-out infinite;
}
@keyframes task-running-flow {
  0%, 100% { background-position: 0% 0%; }
  50% { background-position: 0% 100%; }
}
```

##### 卡片入场

任务卡片首次渲染时使用 `fadeUp` 预设，列表中多张卡片使用 stagger（间隔 50ms）。

#### 五、弹出面板动效

所有弹出式面板（MentionPopup、CloudMentionPopup、StickerPanel）必须使用 `slideUp` 预设入场（从触发源方向向上弹出），离开时使用反向动画。

```vue
<div v-if="showPopup"
     v-motion:initial="{ opacity: 0, y: 8, scale: 0.96 }"
     v-motion:enter="{ opacity: 1, y: 0, scale: 1, transition: { type: 'spring', stiffness: 300, damping: 25 } }"
     class="popup">
</div>
```

#### 六、微交互规范

##### 按钮点击反馈

所有可点击元素（`GlassButton`、侧边栏项、卡片等）在 `:active` 状态下必须应用 `scale(0.96)` 缩放 + 轻微阴影收缩，使用 `transition: transform 0.1s, box-shadow 0.1s`。

```css
.glass-button:active {
  transform: scale(0.96);
  box-shadow: var(--glass-shadow); /* 收缩阴影 */
}
```

##### 列表项删除动画

所有列表（消息列表、任务列表、文件列表、成员列表）中的删除/移除操作必须使用 `<TransitionGroup>` 包裹，删除项使用 `opacity: 0 + scale(0.95)` 淡出（200ms），剩余项使用 `transition: transform 0.3s` 平滑上移填补空位。

```vue
<TransitionGroup name="list" tag="div">
  <div v-for="item in items" :key="item.id">...</div>
</TransitionGroup>
```

```css
.list-leave-active { transition: opacity 0.2s, transform 0.2s; position: absolute; }
.list-leave-to { opacity: 0; transform: scale(0.95); }
.list-move { transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
```

##### 列表项新增动画

`<TransitionGroup>` 中新增项使用 `fadeUp` 效果入场（opacity 0 → 1, translateY 10px → 0, 250ms）。

```css
.list-enter-active { transition: opacity 0.25s, transform 0.25s; }
.list-enter-from { opacity: 0; transform: translateY(10px); }
```

##### 开关切换动画

设置面板中的 toggle/checkbox 状态切换必须使用滑动 + 颜色渐变过渡，禁止瞬间切换。圆形滑块使用 `transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)`，背景色使用 `transition: background-color 0.2s`。

##### 图标状态切换

复制按钮、收藏按钮等双态图标切换时使用 `scale(0.8) → scale(1.1) → scale(1)` 的弹跳效果，图标本身通过 `transition: opacity 0.15s` 淡入淡出切换。

#### 七、Toast 通知增强

Toast 出现时保持现有 `translateY + scale + blur` 动画。多条 Toast 堆叠时，新 Toast 将旧 Toast 向上推移，使用 `transition: transform 0.3s` 平滑上移。

#### 八、无障碍 — 减弱动效

所有动效必须在 `prefers-reduced-motion: reduce` 媒体查询下降级为纯 opacity 淡入淡出（最大 200ms），取消所有位移、缩放、弹簧效果：

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

此规则放在 `src/styles/variables.css` 底部作为全局降级。

#### 九、实施优先级

按投入产出比排序，实施顺序：

| 优先级 | 动效 | 涉及组件 | 依赖 |
|---|---|---|---|
| P0 | 安装 @vueuse/motion，创建 motion-presets.ts | 全局 | npm install |
| P0 | 按钮点击反馈 (active scale) | GlassButton 及所有可点击元素 | 无 |
| P0 | prefers-reduced-motion 全局降级 | variables.css | 无 |
| P1 | 侧边栏选中指示器滑动 | MemberSidebar | 无 |
| P1 | 面板切换方向感过渡 | ChatView | 无 |
| P1 | 弹出面板 scaleIn/slideUp | MentionPopup, StickerPanel, CloudMentionPopup | P0 |
| P1 | 未读徽章 popIn | MemberSidebar | P0 |
| P2 | 消息 staggered 入场 | ChatPanel | P0 |
| P2 | 列表项 TransitionGroup（新增/删除） | ChatPanel, TaskCenterView, CloudResourcesPanel | P0 |
| P2 | 任务状态变化动画 | TaskCard, TaskDetailPanel | P0 |
| P2 | 在线状态变化脉冲 | MemberSidebar | 无 |
| P3 | 打字指示器三点跳动 | ChatPanel | 后端支持 |
| P3 | 开关切换滑动动画 | 各设置面板 | P0 |
| P3 | 图标双态弹跳切换 | CopyButton 等 | P0 |
| P3 | 搜索框展开/收起动画 | MemberSidebar | 无 |
| P3 | Toast 堆叠推移 | Toast | P0 |
| P3 | 消息发送输入框反馈 | ChatPanel | P0 |

## 高内聚低耦合重构指南

### 待提取的共享子组件（TaskCard 与 TaskDetailPanel 重复模板）

以下模板片段在 `TaskCard/main.vue` 和 `TaskDetailPanel/main.vue` 中高度重复，必须提取为共享子组件：

| 子组件名 | 用途 | 来源行数 | 去向 |
|---|---|---|---|
| `TaskActionButtons` | 开始/上传/完成/审批按钮组 | ~25 行/文件 | `src/components/TaskActionButtons/` |
| `TaskFileList` | 文件资源列表（文件名+大小+下载） | ~15 行/文件 | `src/components/TaskFileList/` |
| `TaskReviewList` | Leader 评审结果列表 | ~12 行/文件 | `src/components/TaskReviewList/` |
| `TaskTraceBlock` | 执行步骤/工具调用嵌套渲染 | ~25 行/文件 | `src/components/TaskTraceBlock/` |

### 待提取的 Composable

#### `useTaskLiveData(taskId)` — 任务实时数据

从 `TaskDetailPanel/main.vue` 和 `TaskCenterView/main.vue` 提取。两个文件存在几乎相同的基础设施代码：注入 `TeamClientKey`、`managerFetch` 拉取、WebSocket `on("task", ...)` 订阅/取消。

```ts
// src/composables/useTaskLiveData.ts
export function useTaskLiveData(taskId: Ref<string>) {
  const liveTask = ref<TaskMessage | null>(null);
  // 内部处理：inject TeamClientKey、fetchTask、WS 订阅
  return { liveTask, refresh };
}
```

#### `useTaskTimeline(resources, timestamp)` — 任务时间线

从 `TaskDetailPanel/main.vue` 提取约 52 行的 `TimelineEvent` 接口定义和 `timelineEvents`/`duration` 计算属性。

#### `useCloudFiles(teamName, myId)` — 云文件操作

从 `CloudResourcesPanel/main.vue` 提取约 75 行内联业务逻辑（加载、导航、上传、创建目录、删除、下载、选择模式）。

#### ~~`useAIChat` 与 `useAITask` — 已完成~~

已拆分为 `useAIChat.ts`（聊天建议 + SSE）和 `useAITask.ts`（任务管理），错误状态各自独立。详见上方 "AI 功能架构" 章节。

#### `useChatSend` — 消息发送流水线

从 `ChatPanel/main.vue` 的 `handleRichSend`（25 行）提取：图片上传、文件上传、引用快照构造、云资源引用提取、最终 `sendChat` 调用。

### 共享逻辑统一

#### AutoReply 切换逻辑（3 处重复）

`MemberSidebar/main.vue`、`SettingsPanel/main.vue`、`useGlobalShortcuts.ts` 三处存在相同的 autoReply 切换逻辑（计算 next boolean → saveSettings → 调用 autoReplyDispose）。必须在 `useMemberSettings` 中添加统一的 `toggleAutoReply` 方法。

#### Peer ID 解析（3 处重复）

`useMessages.ts` 中 `channel ? "__team__" : (from === myId ? to : from)` 出现 3 次。提取为 `resolvePeerId` 工具函数到 `src/utils/messageMapper.ts`。

#### ChatMessage 构造（3 处重复）

`useMessages.ts` 中 `ChatMessage` 对象字面量在 `handleIncomingMessage` 和 `sendChat` 中构造了 3 次。提取为 `buildChatMessage` 工厂函数。

### 状态管理规范

#### 禁止设置面板的影子状态

`SettingsPanel/main.vue` 和 `QuickSettingsPanel/main.vue` 在调用 `loadSettings` 后将字段复制到本地 ref，造成与 `useMemberSettings` 内部 `_settings` 的双源真相。必须改用 computed getter/setter 绑定到共享 settings ref。

```ts
// 正确做法
const executionMode = computed({
  get: () => settings.value.execution_mode ?? "local",
  set: (val) => saveSettings(myId, { execution_mode: val }),
});
```

#### 禁止组件直接依赖 API 层

UI 组件（如 `TaskDetailPanel`）不应直接 import `managerFetch` 或 envoy core 类型（如 `Task`）。数据获取和类型转换必须封装在 composable 中。

#### CloudResourcesPanel 必须使用 useConfirm

`CloudResourcesPanel/main.vue` 当前手写了删除确认对话框状态（`deleteConfirm` ref），违反了 "所有确认对话框必须使用 `useConfirm`" 的规范。必须替换为 `showConfirm(...)` 调用。

### 全局单例 vs provide/inject 统一

项目当前同时使用两种状态分发机制：
1. Vue provide/inject（`TeamClientKey` 在 `ChatView` 提供）
2. 模块级单例（`teamClientContext.ts` 的 `_instance` shallowRef）

建议统一为模块级单例，因为应用同时只存在一个 TeamClient。这消除了组件因移动位置而丢失 inject 的风险。

### 全屏图片查看器单例化

`BubbleContent/main.vue` 为每个消息气泡创建独立的 `useFullscreenViewer` 实例和 `Teleport`。50 条消息 = 50 个查看器实例。必须提升为 `ChatPanel` 或 `App` 层单例，`BubbleContent` 仅 emit `open-fullscreen` 事件。

### document 级事件监听器规范

`MessageBubble` 和 `BubbleContent` 在 `<script setup>` 顶层直接调用 `document.addEventListener("keydown", ...)`。N 条消息 = 2N 个 keydown 监听器。必须：
1. 使用 `onMounted` 注册、`onUnmounted` 清理（而非 setup 顶层）
2. 优先将监听器提升到父级组件（ChatPanel）统一处理
3. 或使用单例 composable 管理
