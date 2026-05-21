## Why

Envoy 需要一个面向公众的产品官网，让潜在用户、团队管理员和开发者能够了解产品、下载客户端、查阅文档。当前 `website` 子模块 (`xiangxinji/EnvoyWebsite`) 为空壳，需要搭建完整的静态站点。

## What Changes

- 创建基于 Astro 的静态站点项目，包含 SSG 构建配置
- 实现自定义 Landing 页面（首页、功能页、下载页），使用 Mac 毛玻璃设计语言
- 集成 Starlight 文档框架，提供产品使用文档
- 复用主项目 `src/styles/variables.css` 的设计 token（毛玻璃、品牌色、圆角等）
- 实现中英双语 i18n 路由
- 支持亮色/暗色双主题切换
- Hero 区域使用 macOS 窗口样式展示聊天+任务分派功能

## Capabilities

### New Capabilities
- `website-landing`: Landing 页面架构——首页 Hero、功能介绍页、下载页，macOS 窗口样式产品展示，毛玻璃设计系统
- `website-docs`: 文档系统——Starlight 文档框架集成，Markdown 内容管理，侧边栏导航，全文搜索
- `website-i18n`: 国际化——中英双语路由，Landing 页面文案翻译，Starlight 多语言文档

### Modified Capabilities

（无已有 capability 需修改）

## Impact

- `website/` 子模块：从空壳变为完整 Astro 项目
- `package.json`：已有 `website:dev` 和 `website:build` 脚本，无需修改
- 构建产物为纯静态 HTML，自托管部署
- 需安装依赖：astro, @astrojs/starlight, tailwindcss, @astrojs/tailwind
