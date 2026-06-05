# EnvoyClient Tauri UI 设计审计报告

> **审计日期：** 2026-06-05
> **审计框架：** Taste Skill (Anti-Slop Frontend) + CLAUDE.md 项目规范
> **审计范围：** `src/styles/`、`src/components/`、`src/composables/`、`src/views/`

---

## 0. Design Read

**定位：** Desktop collaboration/chat application (Tauri + Vue 3)，面向团队协作的即时通讯 + 任务管理应用。

**设计语言：** Glassmorphism（毛玻璃），自定义 CSS 变量体系 + Vue Composables + `@vueuse/motion`。

**Dial Settings：**

| 旋钮 | 值 | 理由 |
|---|---|---|
| `DESIGN_VARIANCE` | 5 | 生产力工具，结构化优先，不需要艺术化不对称 |
| `MOTION_INTENSITY` | 5 | 适度反馈，不追求电影级动效，但也不能完全静态 |
| `VISUAL_DENSITY` | 6 | 聊天 + 任务管理 = 数据密度偏高，但非 cockpit 级 |

---

## 1. 做得好的部分

| 领域 | 评价 | 证据 |
|---|---|---|
| 毛玻璃 Token 体系 | 优秀 | 14 个 glass CSS 变量，6 档 blur 层级（40/24/20/16/8/6px），3 档透明度（light/normal/heavy），全组件零硬编码 backdrop-filter |
| 暗色模式覆盖 | 优秀 | `html.dark` 覆盖 100% `:root` 变量；3 套色彩主题（green/blue/purple）完备 |
| Composable 合规 | 优秀 | `useToast`/`useConfirm` 100% 使用率，零手动状态管理绕过 |
| 图标体系 | 优秀 | 98 个 SVG 图标通过 `import.meta.glob` 自动注册，零内联 `<svg>` 违规 |
| 按钮交互一致性 | 优秀 | 全局 `:active { scale(0.96) }` 统一，GlassButton + `useMouseGradient` 质量高 |
| 文件选择器 | 优秀 | 全部通过 `pickFiles` 统一，零散落 `createElement("input")` |
| 面板切换系统 | 优秀 | ChatView 3 套方向感知过渡（fade/slide-left/slide-right），`mode="out-in"` 正确使用 |
| 事件监听器清理 | 优秀 | 所有 `document.addEventListener` 均有 `onUnmounted` 清理 |
| 共享子组件提取 | 良好 | TaskActionButtons/TaskFileList/TaskReviewList/TaskTraceBlock 已完成跨组件复用 |
| CSS 变量辐射范围 | 良好 | 约 100 个自定义属性覆盖颜色/间距/圆角/阴影/状态/聊天气泡/Markdown 渲染 |

---

## 2. 严重问题 (Critical)

### C1. `motionPresets.ts` 从未被导入

**文件：** `src/styles/motion-presets.ts`

定义了 7 个动效预设（`fadeUp`/`scaleIn`/`slideLeft`/`slideRight`/`slideUp`/`popIn`/`pressScale`），但 **0 个组件 import 了它**。

仅有的 3 个 `v-motion` 使用全部内联了 magic number：

| 组件 | 内联值 | 应使用预设 |
|---|---|---|
| `CloudMentionPopup` | `{ opacity:0, y:8, scale:0.96 }` | `slideUp` |
| `CloudResourcesPanel` | `{ opacity:0, scale:0.95 }` | `scaleIn` |
| `MentionPopup` | `{ opacity:0, y:8, scale:0.96 }` | `slideUp` |

**违反规范：** CLAUDE.md > 交互动效规范 > "所有动效必须引用预设，禁止在组件中内联 magic number"

**修复方案：** 3 个组件改为 `v-motion="motionPresets.slideUp"` / `v-motion="motionPresets.scaleIn"`。

---

### C2. `@keyframes` 泛滥（30 处）vs 规范要求 `@vueuse/motion`

CLAUDE.md 明确要求弹框动效用 `@vueuse/motion` 实现，禁止 CSS `@keyframes`。但代码库有 **30 个 `@keyframes`**：

| 类别 | 数量 | 关键帧名称 |
|---|---|---|
| 旋转/加载 | 13 | `spin`(x8), `glass-spin`, `notifier-spin`, `sync-spin`, `ai-spin` |
| 消息动画 | 2 | `message-pop`, `message-pop-dark` |
| 任务卡片反馈 | 4 | `task-flash`, `task-bounce`, `task-shake`, `tag-breathe` |
| 聊天反馈 | 3 | `blink`(x2), `quote-highlight-pulse` |
| 设置/复选框 | 2 | `pulse-border`, `checkbox-bounce` |
| 登录/装饰 | 5 | `float1`, `float2`, `breathe-1/2/3` |
| 其他 | 1 | `shake` (LockScreen) |

**问题：**
- 8 个不同的 `spin` 动画分散在 13 个组件中，应统一为 1 个
- 消息入场 `message-pop` 应使用 `v-motion` + stagger，而非 CSS keyframe
- 只有 3 个组件使用 `v-motion`，与规范要求严重不符

**修复方案：** 将入场类动效（pop/bounce/slide）迁移到 `motionPresets`；`spin` 类统一为 1 个 keyframe 或 `motionPresets` 变体。

---

### C3. `v-motion` 绕过 `prefers-reduced-motion`

**现状：** CSS 全局规则 `animation-duration: 0.01ms !important` 对 `@vueuse/motion` 的 JS 弹簧动画 **完全无效**。

3 个 `v-motion` 组件在 `prefers-reduced-motion: reduce` 下仍会播放弹簧动画。

**修复方案：** 在使用 `v-motion` 的组件中引入 `useReducedMotion()`：

```ts
import { useReducedMotion } from "@vueuse/core";
const prefersReduced = useReducedMotion();

// 在模板中条件渲染
const motionProps = prefersReduced.value
  ? {} // 无动画
  : motionPresets.slideUp;
```

---

### C4. ChatPanel 超过 350 行硬限制

**文件：** `src/components/ChatPanel/main.vue` = **366 行**

CLAUDE.md 规定超过 350 行必须拆分。另有 3 个组件超过 250 行警戒线：

| 组件 | 行数 | 状态 | 建议拆分策略 |
|---|---|---|---|
| **ChatPanel** | **366** | **必须拆分** | 提取 `useChatSend` composable（图片上传、文件上传、引用快照、发送） |
| SettingsKnowledge | 313 | 应考虑拆分 | 提取知识库列表/编辑子组件 |
| QuickSettingsPanel | 311 | 应考虑拆分 | 提取快捷设置分组子组件 |
| CloudResourcesPanel | 275 | 应考虑拆分 | 提取 `useCloudFiles` composable |

---

## 3. 中等问题 (Medium)

### M1. 缺少 `--danger` 等 CSS 变量

**文件：** `src/views/TaskCenterView/styles.css` 使用 `var(--danger, #e74c3c)` **6 处**，但 `--danger` 在 `variables.css` 中从未定义。

现有 `--error: #ff3b30`，`--danger` 的 fallback `#e74c3c` 与之色调不一致。

同样问题：
- `MemberProfilePanel/styles.css` 使用了 3 个未定义变量：`--status-warning`、`--status-success`、`--status-error`
- 这些变量总是使用 Tailwind 风格的 fallback 颜色（`#f59e0b`/`#10b981`/`#ef4444`）

**修复方案：** 在 `variables.css` 的 `:root` 和 `html.dark` 中定义这些变量：

```css
:root {
  --danger: #ff3b30;
  --status-warning: #f59e0b;
  --status-success: #34c759;
  --status-error: #ff3b30;
}
```

---

### M2. 缺少 `prefers-reduced-transparency` 支持

项目 30+ 组件使用 `backdrop-filter` 毛玻璃效果，但 **零处** 实现了 `prefers-reduced-transparency` 检测。

Windows 11 和 macOS 均提供系统级"减少透明度"设置，用户开启后应用应提供实色背景 fallback。

**修复方案：** 在 `src/styles/variables.css` 底部添加：

```css
@media (prefers-reduced-transparency: reduce) {
  :root {
    --glass-bg: rgba(255, 255, 255, 0.95);
    --glass-bg-heavy: rgba(255, 255, 255, 0.98);
    --glass-bg-light: rgba(255, 255, 255, 0.92);
  }
  html.dark {
    --glass-bg: rgba(28, 28, 30, 0.95);
    --glass-bg-heavy: rgba(28, 28, 30, 0.98);
    --glass-bg-light: rgba(28, 28, 30, 0.92);
  }
}
```

---

### M3. TaskCard 硬编码阴影不适配暗色模式

**文件：** `src/components/TaskCard/styles.css`

5 处硬编码 `rgba(0,0,0,0.06-0.1)` 阴影和 `rgba(255,255,255,0.4)` inset 高光。

暗色模式下：
- 浅阴影在深色背景上几乎不可见，失去层次感
- 白色 inset 高光在深色卡片上产生不自然的亮边

**修复方案：** 改用 `var(--glass-shadow)` / `var(--shadow-sm)` 变量，或在 `html.dark` 中覆盖 TaskCard 专属阴影变量。

---

### M4. 等宽字体未 Token 化

两套不同的等宽字体硬编码在组件中，未使用 CSS 变量：

| 文件 | 字体栈 |
|---|---|
| `BubbleContent/styles.css` | `"SF Mono", Menlo, Consolas, monospace` |
| `TaskTraceBlock/styles.css` / `TaskDetailPanel/styles.css` | `"Cascadia Code", "Fira Code", Consolas, monospace` |

**修复方案：** 在 `variables.css` 中添加：

```css
:root {
  --font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  --font-mono: "SF Mono", "Cascadia Code", "Fira Code", Menlo, Consolas, monospace;
}
```

---

### M5. CLAUDE.md 图标列表严重过时

文档列出 29 个图标名称，实际 `src/assets/icons/` 已注册 **98 个**。缺少 69 个新增图标（如 `chevron-down/up`、`terminal`、`spinner`、`upload`、`download`、`search` 等）。

这会导致开发者以为图标不存在而创建重复 SVG 或使用内联 `<svg>`。

**修复方案：** 更新 CLAUDE.md 的"现有图标列表"章节，列出全部 98 个图标名。

---

## 4. 低级问题 (Low)

| 编号 | 问题 | 文件 | 说明 |
|---|---|---|---|
| L1 | FileIcon 颜色非主题感知 | `FileIcon/styles.css` | 8 个硬编码 hex 用于文件类型图标，其中 `#2daa82` 与 `--accent` 重复 |
| L2 | TaskActionButtons 硬编码紫色 | `TaskActionButtons/styles.css` | 使用 `#8b5cf6` 和 `#fff` 替代 CSS 变量 |
| L3 | ForwardedDialog/CloudDirDialog 监听器泄露风险 | 两个 Dialog 组件 | `watch` 管理的 `addEventListener` 缺少 `onUnmounted` 安全网 |
| L4 | blue 主题暗色模式脆弱 | `variables.css` | `:root[data-theme="blue"].dark` 只覆盖 accent token，依赖 `html.dark` 提供其余值 |
| L5 | 装饰 blur 未 Token 化 | `RoleSelect/styles.css`、`LoginSettings/styles.css` | 使用 `filter: blur(60px)` 硬编码 |
| L6 | TitleBar traffic light 颜色 | `TitleBar/styles.css` | `#ff5f57`/`#febc2e`/`#28c840` 硬编码，但属于 macOS 平台标准色，可接受 |

---

## 5. 缺失动效清单 (Missing Motion)

以下是 CLAUDE.md 动效规范明确要求但 **尚未实现** 的条目：

| 优先级 | 动效 | 涉及组件 | 规范要求 | 当前状态 |
|---|---|---|---|---|
| **P1** | 未读徽章 `popIn` 弹入 | MemberSidebar | `scale(0.6) → 1` 弹性动画 | **缺失** - 静态渲染 |
| **P1** | 弹出面板 `slideUp` 入场 | StickerPanel | `v-motion` 从触发源方向弹出 | **缺失** - 无动画 |
| **P2** | 消息 staggered 入场 | ChatPanel | 前 20 条消息间隔 30ms 依次淡入 | **缺失** - 仅 CSS keyframe 无 stagger |
| **P2** | 消息列表 `<TransitionGroup>` | ChatPanel | 列表项新增/删除/重排动画 | **缺失** |
| **P2** | 任务卡片 staggered `fadeUp` | TaskCenterView | 多张卡片间隔 50ms 入场 | **缺失** |
| **P2** | 在线状态变化脉冲 | MemberSidebar | `scale(1.2) → 1` + 背景色渐变 200ms | **缺失** |
| **P3** | 打字指示器三点跳动 | ChatPanel | CSS 交错弹跳 1.4s | **缺失** |
| **P3** | 搜索框展开/收起 | MemberSidebar | `transition: width 0.25s` | **缺失** |
| **P3** | 开关切换滑动动画 | 设置面板 | 圆形滑块 `transition: transform 0.2s` | **缺失** - 仅有 bounce 无滑动 |
| **P3** | 图标双态弹跳 | 多组件 | `scale(0.8) → 1.1 → 1` | **缺失** |
| **P3** | Toast 堆叠推移 | Toast | 新 Toast 推移旧 Toast | **缺失** - 手动 CSS class 切换 |
| **P3** | 消息发送输入框反馈 | ChatPanel | `scale(0.98) → 1` 微弹 | **缺失** |

**动效完成率：** CLAUDE.md 列出 18 项动效要求，已实现约 6 项（侧边栏指示器滑动、面板切换方向感、按钮 pressScale、任务状态变化动画、任务列表 TransitionGroup、弹框 CSS transition），**完成率约 33%**。

---

## 6. Pre-Flight 评估矩阵

将 Taste Skill 设计原则投射到桌面应用场景：

| 检查项 | 状态 | 说明 |
|---|---|---|
| 颜色一致性锁 (Color Consistency Lock) | ⚠️ | 1 个 accent 色，但 `--danger`/`--status-*` 缺失导致 fallback 色不一致 |
| 形状一致性锁 (Shape Consistency Lock) | ✅ | 统一使用 `--radius-sm/md/lg/xl` 四级梯度 |
| 按钮对比度 (Button Contrast) | ✅ | GlassButton primary/default 在明暗模式下均可读 |
| 暗色模式完整性 | ⚠️ | 整体完备（100% 变量覆盖），但 TaskCard 阴影硬编码不适配 |
| `prefers-reduced-motion` | ⚠️ | CSS 层完备（全局 catch-all + TaskCard + TaskActionButtons + App），JS 动画层缺失 |
| `prefers-reduced-transparency` | ❌ | 完全缺失，对重度毛玻璃应用影响较大 |
| 无 AI 视觉污染 | ✅ | 无 AI-purple 渐变、无假精确数字、无空泛营销文案 |
| 字体选择合理 | ⚠️ | 系统字体栈合理，但等宽字体未 Token 化且存在两套不同栈 |
| 一致动效语言 | ❌ | `motionPresets` 定义但未使用；3 种动画机制混用（CSS keyframes / v-motion / Vue Transition） |
| 组件大小合规 | ⚠️ | 1 个超过 350 行硬限制，3 个超过 250 行警戒线 |
| Composable 合规 | ✅ | `useToast`/`useConfirm`/`useConfirm` 全覆盖 |
| 图标规范 | ✅ | 98 个图标通过 SvgIcon 组件统一渲染，零违规 |

---

## 7. 建议修复优先级

### P0 - 立即修复（影响规范合规性 + 无障碍）

| 序号 | 任务 | 涉及文件 | 工作量 |
|---|---|---|---|
| 1 | 3 个 `v-motion` 组件改用 `motionPresets` | `MentionPopup`、`CloudMentionPopup`、`CloudResourcesPanel` | 小 |
| 2 | 为 `v-motion` 添加 `useReducedMotion()` 检测 | 同上 3 个组件 | 小 |
| 3 | 定义缺失的 CSS 变量（`--danger`、`--status-warning/success/error`） | `src/styles/variables.css` | 小 |

### P1 - 本周修复（影响设计一致性）

| 序号 | 任务 | 涉及文件 | 工作量 |
|---|---|---|---|
| 4 | 添加 `prefers-reduced-transparency` 实色 fallback | `src/styles/variables.css` | 小 |
| 5 | 拆分 ChatPanel（提取 `useChatSend` composable） | `ChatPanel`、新建 composable | 中 |
| 6 | TaskCard 阴影改用 CSS 变量 | `TaskCard/styles.css` | 小 |
| 7 | 提取 `--font-mono` CSS 变量 | `variables.css`、`BubbleContent`、`TaskTraceBlock`、`TaskDetailPanel` | 小 |

### P2 - 下个迭代（补齐功能缺失）

| 序号 | 任务 | 涉及文件 | 工作量 |
|---|---|---|---|
| 8 | 补齐 P1 优先级缺失动效（徽章 popIn、StickerPanel slideUp） | `MemberSidebar`、`StickerPanel` | 中 |
| 9 | 统一 `spin` keyframe 为 1 个，迁移入场类动效到 motion presets | 13 个组件 | 中 |
| 10 | 更新 CLAUDE.md 图标列表（29 → 98） | `CLAUDE.md` | 小 |

### P3 - 持续改进（锦上添花）

| 序号 | 任务 | 涉及文件 | 工作量 |
|---|---|---|---|
| 11 | 补齐 P2/P3 缺失动效（消息 stagger、在线状态脉冲等） | `ChatPanel`、`MemberSidebar` 等 | 大 |
| 12 | 统一所有弹框动效为 `v-motion` + presets | 所有 Dialog 组件 | 中 |
| 13 | ForwardedDialog/CloudDirDialog 添加 `onUnmounted` 安全网 | 2 个组件 | 小 |
| 14 | FileIcon/TaskActionButtons 颜色改用 CSS 变量 | 2 个组件 | 小 |
| 15 | blue 主题暗色模式补全非 accent 变量 | `variables.css` | 小 |

---

## 8. 总结

### 核心优势

- **毛玻璃 Token 体系** 是项目的最大设计资产：14 个 glass 变量、6 档 blur、3 档透明度、100% 组件覆盖
- **Composable 架构** 成熟：Toast/Confirm/Toast/Theme/MouseGradient 等复用率高
- **面板过渡系统** 设计精良：方向感知 + `out-in` 模式 + 3 套过渡曲线

### 核心债务

- **动效层**：`motionPresets.ts` 形同虚设，30 个 `@keyframes` 与规范矛盾，JS 动画绕过无障碍设置
- **CSS 变量缺口**：缺少 `--danger`/`--status-*`/`--font-mono` 变量，以及 `prefers-reduced-transparency` 支持
- **组件体积**：ChatPanel 超过硬限制，4 个组件需要拆分

### 建议策略

按照 **P0 → P3** 顺序逐步收敛。P0 项工作量小但合规影响大；P1 项提升设计一致性；P2/P3 补齐功能缺失。总体上项目的设计基础扎实，主要是在 **一致性收口** 和 **规范执行** 层面需要投入。
