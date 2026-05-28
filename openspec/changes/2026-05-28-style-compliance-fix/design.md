## 设计思路

本修复以 **最小变更量 + 最大覆盖面** 为原则，分四个阶段。每个阶段独立可提交，互不阻塞。

### 阶段一：补全 CSS 变量基座

现有 `--glass-blur` 仅有一个值 `40px`，但组件实际使用了 `6px`、`8px`、`12px`、`16px`、`24px` 等多种模糊强度。需在 `variables.css` 的 `:root`、`html.dark`、`[data-theme="purple"]` 三处补全：

```
新增变量:
  --glass-blur-light: 8px       ← 遮罩层、轻微模糊
  --glass-blur-dialog: 20px     ← 弹框/对话框
  --glass-blur-heavy: 40px      ← 已有 --glass-blur，保持别名

  --glass-overlay-blur: 6px     ← 弹框遮罩层专用
  --glass-toolbar-blur: 16px    ← 全屏图片工具栏专用
```

### 阶段二：blur() 硬编码替换

逐文件替换，映射关系：

| 当前值 | 替换为 | 涉及组件 |
|--------|--------|----------|
| `blur(6px)` 遮罩 | `blur(var(--glass-overlay-blur))` | ConfirmDialog, CloseConfirmDialog, ForwardDialog, ForwardedDialog, CloudDirDialog, SettingsPanel |
| `blur(8px)` | `blur(var(--glass-blur-light))` | ReconnectOverlay |
| `blur(12px)` 全屏遮罩 | `blur(var(--glass-blur-dialog))` | AttachmentList, ForwardedDialog |
| `blur(16px)` 工具栏 | `blur(var(--glass-toolbar-blur))` | AttachmentList, ForwardedDialog |
| `blur(24px)` | `blur(var(--glass-blur-heavy))` | LockScreen |

### 阶段三：`<style scoped>` 外提

将 `<style scoped>` 内联样式超过 10 行的组件外提为独立 `styles.css`。分批处理：

**第一批（50+ 行，优先级最高）**:
- LockScreen/main.vue (177 行)
- SettingsKnowledge/main.vue (68 行)
- SyncIndicator/main.vue (54 行)

**第二批（30-50 行）**:
- CloudDirDialog/main.vue (37 行)
- AttachmentList/main.vue (37 行)
- SettingsProfile/main.vue (33 行)
- TaskActionButtons/main.vue (31 行) ← 刚改过，已外提，跳过

**第三批（10-30 行，共 ~30 个组件）**: 逐个检查，将有效样式外提。

### 阶段四：弹框组件合规

逐个检查以下弹框组件，补齐缺失项：

| 组件 | scaleIn 动效 | ESC 关闭 | 遮罩不可点关闭 |
|------|-------------|----------|---------------|
| ConfirmDialog | 检查 | 检查 | 检查 |
| CloseConfirmDialog | 检查 | 检查 | 检查 |
| ForwardDialog | 检查 | 检查 | 检查 |
| ForwardedDialog | 检查 | 检查 | 检查 |
| CloudDirDialog | 检查 | 已有 | 检查 |
| LockScreen | 不适用 | 不适用 | 不适用 |

### 不处理的项目

以下经评估后决定保留现状：

1. **FileIcon 硬编码颜色** — 文件类型语义色，不随主题变化，保持合理
2. **TitleBar 红绿灯按钮颜色** — macOS 原生模拟，固定色值合理
3. **Loading spinner @keyframes** — 纯视觉循环动画，不适合用 @vueuse/motion
4. **动态 inline style**（进度条、拖拽位置、上下文菜单） — 必须绑定 JS 状态，无法外提
5. **document/window.addEventListener** — 虽然应优先用 useEventListener，但现有代码都有正确清理，影响不大，单独处理
