## 阶段一：补全 CSS 变量基座

- [ ] 1.1 在 `variables.css` 的 `:root` 中新增 `--glass-blur-light: 8px`、`--glass-blur-dialog: 20px`、`--glass-overlay-blur: 6px`、`--glass-toolbar-blur: 16px`
- [ ] 1.2 在 `html.dark` 中补充对应暗色值
- [ ] 1.3 在 `[data-theme="purple"]` 中补充对应值

## 阶段二：blur() 硬编码替换（12 处）

- [ ] 2.1 ConfirmDialog/styles.css — `blur(6px)` → `blur(var(--glass-overlay-blur))`
- [ ] 2.2 CloseConfirmDialog/styles.css — `blur(6px)` → `blur(var(--glass-overlay-blur))`
- [ ] 2.3 ForwardDialog/styles.css — `blur(6px)` → `blur(var(--glass-overlay-blur))`
- [ ] 2.4 ForwardedDialog/styles.css — `blur(6px)` → `blur(var(--glass-overlay-blur))`（2 处）
- [ ] 2.5 CloudDirDialog/main.vue — `blur(6px)` → `blur(var(--glass-overlay-blur))`
- [ ] 2.6 SettingsPanel/styles.css — `blur(6px)` → `blur(var(--glass-overlay-blur))`
- [ ] 2.7 ReconnectOverlay/styles.css — `blur(8px)` → `blur(var(--glass-blur-light))`
- [ ] 2.8 AttachmentList/main.vue — `blur(12px)` → `blur(var(--glass-blur-dialog))`，`blur(16px)` → `blur(var(--glass-toolbar-blur))`
- [ ] 2.9 LockScreen/main.vue — `blur(24px)` → `blur(var(--glass-blur))`

## 阶段三：`<style scoped>` 外提为 styles.css

### 第一批（50+ 行）

- [ ] 3.1 LockScreen/main.vue (177 行) → LockScreen/styles.css
- [ ] 3.2 SettingsKnowledge/main.vue (68 行) → SettingsKnowledge/styles.css
- [ ] 3.3 SyncIndicator/main.vue (54 行) → SyncIndicator/styles.css

### 第二批（30-50 行）

- [ ] 3.4 CloudDirDialog/main.vue (37 行) → CloudDirDialog/styles.css
- [ ] 3.5 AttachmentList/main.vue (37 行) → AttachmentList/styles.css
- [ ] 3.6 SettingsProfile/main.vue (33 行) → SettingsProfile/styles.css

### 第三批（10-30 行，约 30 个组件）

- [ ] 3.7 ActivityBar/main.vue → ActivityBar/styles.css
- [ ] 3.8 BackButton/main.vue → BackButton/styles.css
- [ ] 3.9 BubbleContent/main.vue → BubbleContent/styles.css
- [ ] 3.10 ChatPanel/main.vue → ChatPanel/styles.css
- [ ] 3.11 CloudMentionPopup/main.vue → CloudMentionPopup/styles.css
- [ ] 3.12 CloudRefCard/main.vue → CloudRefCard/styles.css
- [ ] 3.13 CloudResourcesPanel/main.vue → CloudResourcesPanel/styles.css
- [ ] 3.14 ConfirmDialog/main.vue → ConfirmDialog/styles.css（已有，合并）
- [ ] 3.15 CloseConfirmDialog/main.vue → CloseConfirmDialog/styles.css（已有，合并）
- [ ] 3.16 ExecutionNotifier/main.vue → ExecutionNotifier/styles.css
- [ ] 3.17 ExecutionPanel/main.vue → ExecutionPanel/styles.css
- [ ] 3.18 FileIcon/main.vue → FileIcon/styles.css
- [ ] 3.19 FloatingBadge/main.vue → FloatingBadge/styles.css
- [ ] 3.20 ForwardDialog/main.vue → ForwardDialog/styles.css（已有，合并）
- [ ] 3.21 ForwardedDialog/main.vue → ForwardedDialog/styles.css（已有，合并）
- [ ] 3.22 GlassButton/main.vue → GlassButton/styles.css
- [ ] 3.23 GlassCheckbox/main.vue → GlassCheckbox/styles.css
- [ ] 3.24 GlassInput/main.vue → GlassInput/styles.css
- [ ] 3.25 GlassSelect/main.vue → GlassSelect/styles.css
- [ ] 3.26 LockScreen/main.vue → 已在 3.1 处理
- [ ] 3.27 MemberHoverCard/main.vue → MemberHoverCard/styles.css
- [ ] 3.28 MemberProfilePanel/main.vue → MemberProfilePanel/styles.css
- [ ] 3.29 MemberSidebar/main.vue → MemberSidebar/styles.css（已有，合并）
- [ ] 3.30 MentionPopup/main.vue → MentionPopup/styles.css
- [ ] 3.31 MessageBubble/main.vue → MessageBubble/styles.css（已有，合并）
- [ ] 3.32 QuickSettingsPanel/main.vue → QuickSettingsPanel/styles.css
- [ ] 3.33 QuoteCard/main.vue → QuoteCard/styles.css
- [ ] 3.34 ReconnectOverlay/main.vue → ReconnectOverlay/styles.css（已有，合并）
- [ ] 3.35 RichEditor/main.vue → RichEditor/styles.css
- [ ] 3.36 SettingsAI/main.vue → SettingsAI/styles.css
- [ ] 3.37 SettingsGeneral/main.vue → SettingsGeneral/styles.css
- [ ] 3.38 SettingsTask/main.vue → SettingsTask/styles.css
- [ ] 3.39 StickerImage/main.vue → StickerImage/styles.css
- [ ] 3.40 StickerPanel/main.vue → StickerPanel/styles.css
- [ ] 3.41 SvgIcon/main.vue → SvgIcon/styles.css
- [ ] 3.42 SyncIndicator/main.vue → 已在 3.3 处理

## 阶段四：弹框组件合规检查

- [ ] 4.1 ConfirmDialog — 检查 scaleIn 动效、ESC 关闭、遮罩不可点
- [ ] 4.2 CloseConfirmDialog — 同上
- [ ] 4.3 ForwardDialog — 同上
- [ ] 4.4 ForwardedDialog — 同上
- [ ] 4.5 CloudDirDialog — 检查 scaleIn 动效、遮罩不可点（ESC 已有）

## 阶段五：硬编码颜色提取

- [ ] 5.1 BubbleContent/styles.css — `rgba(255,255,255,0.85)` → `var(--bubble-mine-link)` 和 `#fff` → `var(--bubble-mine-text)`
- [ ] 5.2 MessageBubble/styles.css — `rgba(255,255,255,0.35)` → `var(--bubble-mine-selection)`
- [ ] 5.3 TitleBar/styles.css — `rgba(255,255,255,0.1)` → `var(--titlebar-shadow)` 和 `rgba(0,0,0,0.5)` → `var(--titlebar-inactive-text)`
- [ ] 5.4 TaskCenterView/styles.css — `#fff` → `var(--text-on-accent)` (2 处)

## 验证

- [ ] 6.1 全量 TypeScript 编译检查无错误
- [ ] 6.2 亮色/暗色/紫色主题切换，确认无视觉回归
- [ ] 6.3 弹框组件逐一打开，确认动效和 ESC 关闭正常
- [ ] 6.4 `grep -rn "blur(" src/ --include="*.vue" --include="*.css"` 确认无遗漏硬编码 blur 值
