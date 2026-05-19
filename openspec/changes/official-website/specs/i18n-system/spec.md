## ADDED Requirements

### Requirement: Locale-based routing
官网 SHALL 支持中英双语路由，默认语言为中文。

#### Scenario: Default locale routing
- **WHEN** 用户访问 `/`
- **THEN** 页面 SHALL 以中文（zh）显示内容

#### Scenario: English locale routing
- **WHEN** 用户访问 `/en/`
- **THEN** 页面 SHALL 以英文（en）显示内容

#### Scenario: Locale-prefixed docs
- **WHEN** 用户访问 `/en/docs/getting-started`
- **THEN** 页面 SHALL 渲染英文版快速开始文档

### Requirement: Browser language detection
官网 SHALL 根据浏览器语言设置自动检测并重定向到对应语言版本。

#### Scenario: Chinese browser
- **WHEN** 浏览器语言设置为中文（zh-CN 或 zh-TW）且用户首次访问
- **THEN** 网站 SHALL 显示中文版本

#### Scenario: English browser
- **WHEN** 浏览器语言设置为英文（en 或 en-US）且用户首次访问
- **THEN** 网站 SHALL 重定向到 `/en/` 英文版本

#### Scenario: Other language browser
- **WHEN** 浏览器语言为非中英文语言
- **THEN** 网站 SHALL 默认显示中文版本

### Requirement: Language switcher
导航栏 SHALL 提供语言切换器，允许用户在中文/英文之间切换。

#### Scenario: Switch language
- **WHEN** 用户点击语言切换器
- **THEN** 页面 SHALL 切换到对应语言版本，保持当前页面路径（如 `/docs/architecture` → `/en/docs/architecture`）

### Requirement: Bilingual UI text
所有 UI 文案 SHALL 提供中英双语版本。

#### Scenario: UI text translation
- **WHEN** 页面渲染时
- **THEN** 所有导航项、按钮文字、标签、Footer 文案 SHALL 通过 i18n 翻译系统显示当前语言对应的文本

### Requirement: Bilingual document content
文档内容 SHALL 提供中英双语 Markdown 文件。

#### Scenario: Content locale mapping
- **WHEN** 用户在中文模式下访问文档
- **THEN** SHALL 渲染 `content/zh/docs/` 目录下的 Markdown 文件

#### Scenario: Content locale mapping English
- **WHEN** 用户在英文模式下访问文档
- **THEN** SHALL 渲染 `content/en/docs/` 目录下的 Markdown 文件

### Requirement: SEO meta tags
每个页面 SHALL 根据当前语言生成正确的 SEO 元标签。

#### Scenario: Hreflang tags
- **WHEN** 任何页面渲染
- **THEN** HTML head SHALL 包含 `<link rel="alternate" hreflang="zh" ...>` 和 `<link rel="alternate" hreflang="en" ...>` 标签

#### Scenario: Locale-specific meta
- **WHEN** 中文首页渲染
- **THEN** og:title 和 og:description SHALL 显示中文内容
