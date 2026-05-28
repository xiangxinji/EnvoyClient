## Why

客户端存在大量样式规范违规：硬编码 `backdrop-filter: blur()` 值（12 处）、硬编码颜色（15+ 处）、`<style scoped>` 未外提 `styles.css`（40+ 组件）、弹框组件未遵循毛玻璃设计规范。这些问题导致主题切换时视觉不一致，且增加了维护成本。

## What Changes

- 在 `variables.css` 中补充缺失的 CSS 变量（`--glass-blur-light`、`--glass-blur-heavy` 等）
- 将所有硬编码 `blur()` 值替换为对应 CSS 变量
- 将硬编码颜色提取为语义化 CSS 变量
- 将大块 `<style scoped>` 内联样式外提到 `styles.css`
- 补齐弹框组件的 scaleIn 动效和 ESC 关闭

## Capabilities

### New Capabilities

（无新增能力）

### Modified Capabilities

- `style-compliance`: 全局样式合规性修复，统一 CSS 变量引用，消除断裂的硬编码值

## Impact

- `src/styles/variables.css` — 新增 6 个 CSS 变量
- 40+ 组件文件 — `<style scoped>` 外提为 `styles.css`
- 12 个文件 — `blur()` 硬编码替换为变量
- 10+ 个文件 — 颜色硬编码替换为变量
- 6 个弹框组件 — 补齐动效和 ESC 关闭
