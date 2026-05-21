## Context

Envoy 是一个团队协作工具，包含聊天、任务管理、AI Agent 等功能。项目使用 Vue 3 + Tauri 构建，已有完整的设计系统（`src/styles/variables.css`），包含毛玻璃变量、品牌色、亮暗双主题。

`website/` 子模块（`xiangxinji/EnvoyWebsite`）当前为空壳，需搭建独立 Astro 静态站点。主项目 `package.json` 已配置 `website:dev` 和 `website:build` 脚本。

## Goals / Non-Goals

**Goals:**
- 搭建可运行的 Astro 项目骨架，包含构建和开发配置
- 实现 Mac 毛玻璃风格的 Landing 页面（首页、功能、下载）
- 集成 Starlight 文档系统，提供最小集文档内容
- 中英双语 i18n 支持
- 亮色/暗色双主题
- 复用主项目设计 token，保持视觉统一

**Non-Goals:**
- 博客系统（后续可加）
- 用户认证 / CMS（纯静态）
- API 交互式文档（如 Swagger UI）
- 搜索引擎优化细节（后续迭代）
- 自动化部署流水线（手动部署即可）

## Decisions

### 1. Astro + Starlight 作为基础框架

**选择**: Astro (SSG 模式) + Starlight (文档) + Tailwind CSS (样式)

**理由**:
- Astro 的 Islands 架构适合内容为主的站点，默认零 JS，加载快
- Starlight 是 Astro 官方文档框架，内置侧边栏、搜索、i18n，避免重复造轮子
- Tailwind 和主项目一致，毛玻璃效果可用 utility + CSS 变量实现

**替代方案**:
- Nuxt 3: 同 Vue 生态但偏重，SSR 对纯展示站过度
- VitePress: 适合文档但不适合自定义 Landing 页
- Next.js: React 生态，与主项目不一致

### 2. 设计 Token 复用策略

**选择**: 将主项目 `variables.css` 的核心变量复制到 `website/src/styles/variables.css`，不跨项目 import。

**理由**:
- website 是独立 git 仓库（子模块），不应依赖主项目构建
- 设计 token 变化频率低，手动同步成本低
- 保留完整的 `:root` + `html.dark` 双主题结构

**同步范围**: glass-* 变量、accent 品牌色、bg-* 背景、text-* 文字、radius-* 圆角、orb-* 装饰球

### 3. i18n 路由策略

**选择**: Astro i18n routing（前缀策略），中文默认无前缀，英文 `/en/` 前缀。

**理由**:
- Astro 原生 i18n 支持，无需额外库
- Starlight 有内置 i18n，与 Astro i18n 路由兼容
- 中文为默认语言符合产品定位

**结构**:
```
/                → 中文首页
/en/             → 英文首页
/features        → 中文功能页
/en/features     → 英文功能页
/docs/           → Starlight 中文文档
/docs/en/        → Starlight 英文文档
```

### 4. macOS 窗口展示组件

**选择**: 创建 `MacWindow.astro` 组件，模拟 macOS 窗口标题栏（traffic lights + 标题），内部 slot 放产品截图或模拟界面。

**实现**:
- 纯 CSS + SVG 的 traffic lights（红黄绿圆点）
- 毛玻璃背景的窗口容器
- 支持暗色模式
- 响应式宽度

### 5. 页面动画

**选择**: 使用 CSS 动画 + Intersection Observer 实现滚动触发动画，不引入 GSAP 等重库。

**理由**:
- Landing 页动画需求简单（渐入、上浮）
- 保持零/轻量 JS 依赖，符合 Astro 性能理念
- 后续如需复杂动画再引入

## Risks / Trade-offs

- **[设计 token 漂移]** → 主项目改了 token 但官网未同步。缓解：在 CLAUDE.md 中记录同步要求，或在主项目 CI 中加提醒
- **[Starlight 样式覆盖复杂]** → Starlight 有自己的设计系统，深度自定义可能需要较多 CSS 覆盖。缓解：只覆盖颜色/圆角等核心变量，不改布局
- **[中英文案维护]** → 双语内容需同步更新。缓解：Astro Content Collections 的 i18n 结构天然并排，容易发现遗漏
- **[产品截图需要定期更新]** → 静态截图会过时。缓解：初始版本用截图，后续可考虑自动截图流水线
