## Why

EnvoyClient 作为一个功能丰富的团队 AI Agent 协作桌面客户端，目前缺乏一个面向外部的展示窗口。需要一个官方站点来传达产品定位、核心功能、技术架构，并提供完整的中文/英文文档，帮助潜在用户和开发者快速了解和上手。

## What Changes

- 新增 `website/` 目录，包含完整的 Nuxt 3 SSG 静态站点项目
- 实现 Landing Page（Hero + 波浪粒子特效 + Features + How it Works + Tech Stack + CTA）
- 实现文档站（侧边栏导航 + Markdown 渲染 + 搜索），内容从 CLAUDE.md 架构描述转化
- 实现下载页（安装指南 + 平台支持 + 更新日志）
- 实现中英双语支持（@nuxtjs/i18n，/zh/ /en/ 路由，浏览器语言自动检测）
- 延续客户端毛玻璃设计体系，暗色主题为主，更大气的视觉呈现
- Hero Banner 使用 Canvas 2D 高性能波浪粒子特效（多层正弦叠加 + 鼠标交互 + 尾迹 + prefers-reduced-motion 降级）
- 复用现有 `src/assets/logo.png`

## Capabilities

### New Capabilities

- `landing-page`: 官网首页 — Hero Banner（Canvas 2D 波浪粒子特效）+ 核心特性展示 + 工作流演示 + 技术栈展示 + CTA 行动号召区域
- `docs-site`: 文档站 — 侧边栏导航 + Markdown 内容渲染 + 搜索功能，包含快速开始、架构概览、AI 场景、Agent 系统、任务工作流、Manager 指南、API 参考等章节
- `i18n-system`: 国际化系统 — 中英双语路由（/zh/ /en/）、浏览器语言自动检测、右上角语言切换器、UI 文案与文档内容双语
- `glass-design-web`: 官网毛玻璃设计体系 — 从客户端 Glass Design 延伸，更大气的视觉层级（更柔和 blur、更通透 opacity、更充足留白），暗色主题为主 + 亮色可切换
- `download-page`: 下载页 — 安装指南（npm run tauri:dev 快速体验）、平台支持说明、构建命令参考

### Modified Capabilities

（无现有 capability 需要修改）

## Impact

- **新增依赖**: website/ 目录独立 package.json，依赖 Nuxt 3、@nuxt/content、@nuxtjs/i18n 等
- **不影响现有代码**: 官网为完全独立的项目，不修改客户端或 Manager 任何代码
- **复用资源**: 复制 `src/assets/logo.png` 到 website 项目中（不产生运行时耦合）
- **构建独立**: website 有自己的 dev/build 命令，不影响主项目 `npm run tauri:dev` 等现有命令
- **部署目标**: 生成纯静态文件，可部署到 GitHub Pages / Vercel / 任意静态托管
