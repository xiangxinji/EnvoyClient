# EnvoyClient Landing Page Design

## Overview

为 EnvoyClient 创建一个产品官网，展示 AI Agent 团队协作桌面客户端的核心能力和技术架构。单页长滚动，中英双语，暗色毛玻璃风格。

## Tech Stack

- **Framework**: Nuxt 3（SSR 开发 + `nuxt generate` 纯静态输出）
- **i18n**: `@nuxtjs/i18n` 模块，JSON 文件驱动
- **Styling**: 纯 CSS，复用主项目的 CSS 变量系统
- **Location**: `website/` 独立子目录，独立 package.json

## Project Structure

```
website/
├── nuxt.config.ts
├── package.json
├── app.vue
├── components/
│   ├── landing/
│   │   ├── HeroSection.vue
│   │   ├── FeatureGrid.vue
│   │   ├── ArchitectureSection.vue
│   │   ├── WorkflowSection.vue
│   │   ├── TechStackSection.vue
│   │   └── FooterSection.vue
│   ├── common/
│   │   ├── GlassCard.vue
│   │   ├── AnimatedOrbs.vue
│   │   └── Navbar.vue
│   └── LanguageSwitch.vue
├── pages/
│   └── index.vue
├── assets/
│   └── css/
│       └── variables.css
├── i18n/
│   ├── zh.json
│   └── en.json
└── public/
    └── favicon.ico
```

## Page Sections

### 1. Hero Section

- 渐变大标题 + 副标题
- AnimatedOrbs 背景（3-4 个半透明绿色光球，CSS keyframe 浮动）
- CTA 按钮：「立即体验」→ GitHub 仓库 / 下载
- 右侧：模拟产品 UI 的玻璃态卡片叠放预览

### 2. Feature Grid

3x2 网格，6 个 GlassCard：

| Feature | Description |
|---------|-------------|
| AI Agent 协作 | 本地 ReAct 循环 + Manager AI 推理 |
| 智能任务分派 | AI 自动匹配成员 + 职责分析 |
| 实时通信 | Envoy WebSocket 框架 |
| 多角色协作 | Leader/Member 角色系统 |
| 任务审批流 | Reviewing 工作流 + AI 自动审批 |
| 多 AI Provider | OpenAI/Anthropic/Google/DeepSeek |

移动端变为 1 列。

### 3. Architecture Section

- CSS 绘制的三层架构图：Manager → Envoy → Client
- 层叠玻璃卡片 + 渐变连线
- 每层 hover 展开简要说明

### 4. Workflow Section

- 水平时间轴：任务创建 → AI 分派 → Agent 执行 → 结果审批 → 完成
- 每步图标 + 简短描述
- IntersectionObserver 滚动触发动画
- 移动端变为垂直时间轴

### 5. Tech Stack Section

- 图标网格：Tauri 2 / Vue 3 / TypeScript / Vite / WebSocket / SQLite / Vercel AI SDK
- 一行说明文字

### 6. Footer

- 导航链接、GitHub 地址、版权信息

## Visual Style

### Colors

- Accent: `#3dd9a5` (dark) / `#2fb38b` (light)
- Background: `#141416` + 径向渐变光晕
- Glass: `rgba(28, 28, 30, 0.6)` + `backdrop-filter: blur(20px)` + `rgba(255,255,255,0.08)` border
- Text primary: `#f5f5f7`, secondary: `#98989d`
- Headings: 渐变色（绿到青）

### Typography

- Font stack: `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`
- H1: 48-64px, weight 700
- H2: 32-40px, weight 600
- Body: 16-18px, weight 400

### Animations

- **Hero orbs**: 3-4 半透明球体，`@keyframes float` 慢速浮动（6-12s cycle）
- **Scroll reveal**: IntersectionObserver, `opacity 0->1` + `translateY 30px->0`, 0.6s ease-out
- **Card hover**: `translateY(-4px)` + shadow increase
- **Architecture hover**: 层高亮 + 说明展开

### Responsive Breakpoints

- Desktop: 1200px+（默认）
- Tablet: 768px-1199px（Feature Grid 2 列）
- Mobile: <768px（单列布局，时间轴垂直）

## i18n

- 使用 `@nuxtjs/i18n`
- 语言文件：`i18n/zh.json` + `i18n/en.json`
- URL 策略：prefix（`/zh` / `/en`）
- 切换组件：Navbar 右侧按钮

## Build & Deploy

```bash
cd website
npm install
npm run dev          # 开发模式
npm run generate     # 生成静态文件到 .output/public/
```

- 生产输出纯静态 HTML，可部署到任意静态托管（Vercel / Netlify / GitHub Pages）
- 主项目 package.json 添加 `"website:dev"` 和 `"website:build"` 脚本
