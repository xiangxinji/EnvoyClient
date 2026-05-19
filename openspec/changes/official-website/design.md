## Context

EnvoyClient 是一个 Tauri 2 + Vue 3 的团队 AI Agent 协作桌面客户端。客户端采用暗色毛玻璃设计体系（Glass Design），以 `#3dd9a5`（accent 绿）为主色调，`#0d0d0f` 为深色背景，blur 20px 的毛玻璃效果。Logo 为蓝紫渐变的 "E" 字图标（`src/assets/logo.png`）。

官网需要作为独立项目放在 `website/` 目录下，与主项目零耦合，共享设计语言但不共享代码。

## Goals / Non-Goals

**Goals:**
- 建立产品品牌形象，传达"AI Agent 团队协作"的核心定位
- 提供完整的中英双语文档，帮助用户快速了解架构和上手
- 视觉上延续客户端毛玻璃风格，但更大气、更通透
- Hero Banner 实现高性能 Canvas 2D 波浪粒子特效，支持鼠标交互
- 纯静态生成（SSG），可部署到任意静态托管

**Non-Goals:**
- 不实现用户系统、登录、后台管理等动态功能
- 不实现搜索索引服务（文档搜索基于页面内内容，不需外部服务）
- 不实现博客或 CMS 功能
- 不与客户端/Manager 产生运行时代码依赖

## Decisions

### 1. 技术栈：Nuxt 3 (SSG) + @nuxt/content + @nuxtjs/i18n

**选择**: Nuxt 3 模式设为 `static`（`nuxt generate`）

**备选方案**:
- VitePress: 更轻量但定制性差，难以实现复杂粒子特效和自定义布局
- Astro: 不错但 Vue 生态统一性更好，团队已熟悉 Vue

**理由**:
- 与主项目同为 Vue 生态，心智模型统一
- `@nuxt/content` 天然支持 Markdown 文档 + 代码高亮
- `@nuxtjs/i18n` 提供成熟的路由级国际化（`/zh/` `/en/`）
- SSG 模式生成纯静态文件，部署灵活

### 2. 波浪粒子特效：Canvas 2D

**选择**: 原生 Canvas 2D API，零外部依赖

**备选方案**:
- Three.js: 功能强大但 ~600KB 包体积，粒子效果杀鸡用牛刀
- WebGL 原生: 性能最好但开发成本高
- CSS 动画: 无法实现复杂粒子行为

**实现要点**:
```
ParticleWave.vue (Canvas 组件)
├── 多层波浪 (3-4 层)
│   ├── 每层: 不同频率 / 振幅 / 速度 / 颜色
│   └── y = baseY + A * sin(frequency * x + phase + time * speed)
├── 粒子系统 (500-800 个粒子)
│   ├── 沿波浪路径运动
│   ├── 带尾迹 (存储前 N 帧位置, 逐渐降低透明度)
│   └── 大小/透明度随机分布
├── 鼠标交互
│   ├── 计算粒子与鼠标距离
│   └── 距离 < 阈值时施加排斥力 (flee force)
├── 性能保障
│   ├── requestAnimationFrame 驱动
│   ├── 离屏时停止渲染 (visibilitychange)
│   └── 固定时间步长 (deltaTime clamp)
└── 无障碍降级
    └── prefers-reduced-motion → 纯 CSS 渐变背景替代
```

### 3. 毛玻璃设计体系扩展

从客户端的变量体系延伸，官网使用更大气的参数：

| 属性 | 客户端 | 官网 |
|------|--------|------|
| `--glass-blur` | 20px | 40px |
| `--glass-bg` opacity | 60% | 45% |
| `--glass-bg-heavy` opacity | 75% | 60% |
| 卡片圆角 | 10-16px | 16-24px |
| 内边距 | 12-24px | 24-48px |
| 最大宽度 | 800px 窗口 | 1200px 内容区 |

官网特有的视觉元素：
- **Orb 背景球**: 复用客户端 `--orb-*` 变量，放大为全屏装饰性光晕
- **渐变背景**: `--app-gradient` 从纯色升级为多层渐变（径向 + 线性叠加）
- **滚动动画**: `IntersectionObserver` 触发 fade-in / slide-up 动画

### 4. 国际化架构

**路由策略**: `prefix_except_root` — 默认语言（zh）无前缀，en 使用 `/en/` 前缀

```
路由映射:
/                  → 中文首页
/en/               → 英文首页
/docs/...          → 中文文档
/en/docs/...       → 英文文档
/download          → 中文下载页
/en/download       → 英文下载页

SEO:
每个页面生成正确的 hreflang 标签
og:title / og:description 按语言输出
```

**内容分离**:
- UI 文案 → `i18n/zh.json` / `i18n/en.json`（按钮、导航、标签等）
- 文档内容 → `content/zh/docs/*.md` / `content/en/docs/*.md`（@nuxt/content 按语言目录）
- 下载页内容 → 页面组件内使用 `$t()` 翻译

### 5. 文档内容规划

从 CLAUDE.md 架构描述转化为以下文档章节：

```
content/{locale}/docs/
├── index.md              → 文档首页 / 概览
├── getting-started.md    → 快速开始 (安装 + 5分钟体验)
├── architecture.md       → 三层架构 (Manager/Envoy/Tauri)
├── ai-scenes.md          → 8 个 AI Scene + 模型配置
├── agent-system.md       → ReAct Agent + 工具 + Skill Catalog
├── task-workflow.md      → 任务分派 + 执行 + Reviewing
├── manager-guide.md      → Manager 部署 + 用户管理 + AI 配置
└── api-reference.md      → REST API 端点列表
```

### 6. 目录结构

```
website/
├── nuxt.config.ts
├── package.json
├── tsconfig.json
├── app.vue                        → 根布局
├── components/
│   ├── landing/
│   │   ├── HeroBanner.vue         → Hero + ParticleWave 容器
│   │   ├── ParticleWave.vue       → Canvas 2D 波浪粒子
│   │   ├── FeatureGrid.vue        → 4-6 特性卡片网格
│   │   ├── HowItWorks.vue         → 工作流 3 步展示
│   │   ├── TechStack.vue          → 技术栈图标/标签
│   │   └── CallToAction.vue       → CTA 区域
│   ├── docs/
│   │   ├── DocSidebar.vue         → 文档侧边导航
│   │   └── DocHeader.vue          → 文档页头部（面包屑 + 搜索触发）
│   ├── common/
│   │   ├── NavBar.vue             → 全局导航栏（Logo + 菜单 + 语言切换 + 主题切换）
│   │   ├── Footer.vue             → 页脚
│   │   ├── GlassCard.vue          → 通用毛玻璃卡片
│   │   └── ThemeToggle.vue        → 暗/亮主题切换
│   └── download/
│       └── DownloadContent.vue    → 下载页内容
├── pages/
│   ├── index.vue                  → Landing Page
│   ├── docs/
│   │   └── [...slug].vue          → 文档 catch-all 路由
│   └── download.vue               → 下载页
├── content/
│   ├── zh/docs/                   → 中文文档 Markdown
│   └── en/docs/                   → 英文文档 Markdown
├── composables/
│   └── useParticles.ts            → 粒子系统逻辑
├── assets/
│   └── css/
│       └── main.css               → 全局样式 + 毛玻璃变量
├── i18n/
│   ├── zh.json                    → 中文 UI 文案
│   └── en.json                    → 英文 UI 文案
├── public/
│   ├── logo.png                   → 复制的 Logo
│   └── favicon.ico
└── server/                        → (SSG 不需要，保留空)
```

### 7. 构建与开发命令

在主项目 `package.json` 中添加：
```json
{
  "website:dev": "cd website && npm run dev",
  "website:build": "cd website && npm run generate"
}
```

website/ 自身 `package.json`:
```json
{
  "scripts": {
    "dev": "nuxt dev",
    "build": "nuxt build",
    "generate": "nuxt generate",
    "preview": "nuxt preview"
  }
}
```

## Risks / Trade-offs

**[粒子性能]** → 限制粒子数 500-800，离屏暂停渲染，prefers-reduced-motion 降级为纯渐变
**[首屏加载]** → SSG 预渲染所有页面，Canvas 粒子异步加载不阻塞 HTML
**[文档内容维护]** → 中英双语需同步更新，暂时接受手动维护成本，后续可考虑翻译工具辅助
**[SEO]** → SSG 天然 SEO 友好，配合 @nuxtjs/i18n 自动生成 hreflang 和 meta 标签
**[暗色为主]** → 暗色主题为默认（延续客户端体验），同时支持亮色切换，CSS 变量复用客户端体系
