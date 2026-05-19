## 1. Project Scaffolding

- [ ] 1.1 Create `website/` directory and initialize Nuxt 3 project with `npx nuxi@latest init website --no-install`
- [ ] 1.2 Install dependencies: `nuxt`, `@nuxt/content`, `@nuxtjs/i18n`, `@nuxtjs/color-mode`
- [ ] 1.3 Configure `nuxt.config.ts` with SSG mode (`ssr: true`, `nitro: { preset: 'static' }`), register modules (`@nuxt/content`, `@nuxtjs/i18n`, `@nuxtjs/color-mode`)
- [ ] 1.4 Copy `src/assets/logo.png` to `website/public/logo.png`
- [ ] 1.5 Add `website:dev` and `website:build` scripts to root `package.json`

## 2. Global Styles & Design System

- [ ] 2.1 Create `assets/css/main.css` with extended CSS variables from client App.vue — adjust `--glass-blur` to 40px, `--glass-bg` opacity to 45%, `--glass-bg-heavy` opacity to 60%, add orb variables, multi-layer gradient `--app-gradient`
- [ ] 2.2 Define light theme variables in `:root` and dark theme in `html.dark` (mirror client's dual-theme structure)
- [ ] 2.3 Add global resets, typography (system font stack), scrollbar styles, `::selection` styles
- [ ] 2.4 Add `@keyframes` for fade-in/slide-up scroll animations + `prefers-reduced-motion` media query to disable them
- [ ] 2.5 Register `main.css` in `nuxt.config.ts` via `css: ['~/assets/css/main.css']`

## 3. Common Components

- [ ] 3.1 Create `components/common/NavBar.vue` — sticky top nav with Logo, menu links (首页/文档/下载), language switcher, theme toggle; mobile hamburger menu below 768px
- [ ] 3.2 Create `components/common/Footer.vue` — dark glass footer with copyright, links, i18n text
- [ ] 3.3 Create `components/common/GlassCard.vue` — reusable card with `var(--glass-bg)`, `backdrop-filter: blur(var(--glass-blur))`, `border: 1px solid var(--glass-border)`, rounded corners 16-24px
- [ ] 3.4 Create `components/common/ThemeToggle.vue` — toggle dark/light mode using `@nuxtjs/color-mode`, persist to localStorage
- [ ] 3.5 Create `app.vue` — root layout with NavBar + `<NuxtPage />` + Footer, apply background gradient

## 4. i18n System

- [ ] 4.1 Create `i18n/zh.json` with all UI text (nav items, button labels, landing section titles, footer text)
- [ ] 4.2 Create `i18n/en.json` with English translations
- [ ] 4.3 Configure `@nuxtjs/i18n` in `nuxt.config.ts`: locales `['zh', 'en']`, defaultLocale `'zh'`, strategy `'prefix_except_root'`, lazy-loaded messages
- [ ] 4.4 Verify hreflang tags are auto-generated and og:title/description are locale-aware

## 5. Landing Page — Particle Wave Effect

- [ ] 5.1 Create `composables/useParticles.ts` — particle system logic: wave layer definitions (3-4 layers with frequency/amplitude/speed), particle pool (500-800), position update loop, trail history buffer
- [ ] 5.2 Create `components/landing/ParticleWave.vue` — Canvas element, `requestAnimationFrame` loop, mouse tracking for flee force, `visibilitychange` pause/resume, `resize` observer, `prefers-reduced-motion` detection (fallback to CSS gradient)
- [ ] 5.3 Verify particle performance: 60fps at 800 particles, no jank during scroll

## 6. Landing Page — Sections

- [ ] 6.1 Create `components/landing/HeroBanner.vue` — full-viewport section with ParticleWave background, product name, slogan (i18n), two CTA buttons (下载/文档), glass card overlay
- [ ] 6.2 Create `components/landing/FeatureGrid.vue` — 6 feature cards (ReAct Agent, 智能任务分派, 实时协作通信, 多模型AI支持, 任务Reviewing, 桌面原生体验) in responsive grid (1col/2col/3col), scroll animation trigger
- [ ] 6.3 Create `components/landing/HowItWorks.vue` — 3-step flow (Leader 分派 → Member Agent 执行 → Review 审批) with step cards and connecting arrows/lines
- [ ] 6.4 Create `components/landing/TechStack.vue` — tech tags/badges display (Tauri 2, Vue 3, WebSocket, Vercel AI SDK, SQLite, etc.)
- [ ] 6.5 Create `components/landing/CallToAction.vue` — bottom CTA section with download + docs buttons in glass container
- [ ] 6.6 Create `pages/index.vue` — compose all landing sections with IntersectionObserver scroll animations

## 7. Documentation Site

- [ ] 7.1 Create `components/docs/DocSidebar.vue` — fixed sidebar with chapter list, active section highlight, mobile drawer mode
- [ ] 7.2 Create `components/docs/DocHeader.vue` — breadcrumb navigation + doc title
- [ ] 7.3 Create `pages/docs/[...slug].vue` — catch-all route that renders `@nuxt/content` documents with locale awareness, 404 fallback
- [ ] 7.4 Configure `@nuxt/content` in `nuxt.config.ts` with content path and highlight.js theme for code blocks

## 8. Documentation Content — Chinese

- [ ] 8.1 Create `content/zh/docs/index.md` — 文档概览首页
- [ ] 8.2 Create `content/zh/docs/getting-started.md` — 快速开始（环境要求、安装步骤、5 分钟体验流程），内容基于 CLAUDE.md Commands + Architecture 部分
- [ ] 8.3 Create `content/zh/docs/architecture.md` — 三层架构（Manager/Envoy/Tauri）+ 数据存储表，基于 CLAUDE.md Architecture 部分
- [ ] 8.4 Create `content/zh/docs/ai-scenes.md` — 8 个 AI Scene + 模型配置 + Provider 工厂，基于 CLAUDE.md AI Scene / Model 映射部分
- [ ] 8.5 Create `content/zh/docs/agent-system.md` — ReAct Agent 循环 + 工具集 + Skill Catalog，基于 CLAUDE.md Agent 执行流程部分
- [ ] 8.6 Create `content/zh/docs/task-workflow.md` — 任务分派（手动+AI）+ 执行 + Reviewing，基于 CLAUDE.md 任务流程部分
- [ ] 8.7 Create `content/zh/docs/manager-guide.md` — Manager 部署 + 用户管理 + AI 配置，基于 CLAUDE.md Manager Backend 部分
- [ ] 8.8 Create `content/zh/docs/api-reference.md` — REST API 端点列表（Teams/Users/Messages/AI/Dashboard），基于 CLAUDE.md Key Files 部分

## 9. Documentation Content — English

- [ ] 9.1 Create `content/en/docs/index.md` — Documentation overview
- [ ] 9.2 Create `content/en/docs/getting-started.md` — Quick start guide (translated from 8.2)
- [ ] 9.3 Create `content/en/docs/architecture.md` — Three-layer architecture (translated from 8.3)
- [ ] 9.4 Create `content/en/docs/ai-scenes.md` — AI scenes & model config (translated from 8.4)
- [ ] 9.5 Create `content/en/docs/agent-system.md` — ReAct Agent system (translated from 8.5)
- [ ] 9.6 Create `content/en/docs/task-workflow.md` — Task workflow (translated from 8.6)
- [ ] 9.7 Create `content/en/docs/manager-guide.md` — Manager guide (translated from 8.7)
- [ ] 9.8 Create `content/en/docs/api-reference.md` — API reference (translated from 8.8)

## 10. Download Page

- [ ] 10.1 Create `components/download/DownloadContent.vue` — installation guide with code blocks (copy button), prerequisites list, platform support cards, build commands table
- [ ] 10.2 Create `pages/download.vue` — download page layout with DownloadContent, all text via `$t()` i18n

## 11. Integration & Polish

- [ ] 11.1 Add `@nuxtjs/color-mode` configuration: default `'dark'`, class-based (`html.dark`/`html.light`)
- [ ] 11.2 Verify all pages render correctly in both dark and light themes
- [ ] 11.3 Test responsive layouts: mobile (<768px), tablet (768-1024px), desktop (>1024px)
- [ ] 11.4 Run `npm run generate` in website/ and verify static output is complete
- [ ] 11.5 Test i18n: verify all routes work for /zh/ and /en/ prefixes, language switcher preserves path
