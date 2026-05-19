## ADDED Requirements

### Requirement: Document navigation sidebar
文档页 SHALL 包含固定的侧边栏导航，列出所有文档章节。

#### Scenario: Sidebar display
- **WHEN** 用户访问文档页面
- **THEN** 左侧 SHALL 显示侧边栏导航，按顺序列出所有文档章节（概览、快速开始、架构、AI 场景、Agent 系统、任务工作流、Manager 指南、API 参考）

#### Scenario: Active section highlight
- **WHEN** 用户浏览某个文档章节
- **THEN** 侧边栏中对应的章节链接 SHALL 高亮显示当前所在位置

#### Scenario: Mobile responsive
- **WHEN** 视口宽度小于 768px
- **THEN** 侧边栏 SHALL 折叠为可收起的抽屉式菜单，通过汉堡按钮触发

### Requirement: Markdown content rendering
文档内容 SHALL 以 Markdown 格式存储，通过 @nuxt/content 渲染为富文本页面。

#### Scenario: Content rendering
- **WHEN** 用户访问 `/docs/architecture` 路由
- **THEN** 页面 SHALL 渲染 `content/{locale}/docs/architecture.md` 的内容，支持标题、段落、代码块（语法高亮）、列表、表格、链接

#### Scenario: Code syntax highlighting
- **WHEN** Markdown 内容包含代码块
- **THEN** 代码块 SHALL 提供语法高亮，支持 TypeScript、Vue、Rust、Bash 等语言

#### Scenario: 404 handling
- **WHEN** 用户访问不存在的文档路径（如 `/docs/nonexistent`）
- **THEN** 页面 SHALL 显示文档 404 提示，并提供返回文档首页的链接

### Requirement: Breadcrumb navigation
文档页 SHALL 在顶部显示面包屑导航。

#### Scenario: Breadcrumb display
- **WHEN** 用户浏览 `/docs/agent-system` 页面
- **THEN** 页面顶部 SHALL 显示面包屑："文档 > Agent 系统"

### Requirement: Document content chapters
文档站 SHALL 包含以下完整章节（中英双语）。

#### Scenario: Chapter completeness
- **WHEN** 文档站构建完成
- **THEN** SHALL 包含以下章节的 Markdown 文件（每个章节中英各一份）：
  - index（概览）
  - getting-started（快速开始）
  - architecture（架构概览）
  - ai-scenes（AI 场景配置）
  - agent-system（Agent 系统）
  - task-workflow（任务工作流）
  - manager-guide（Manager 指南）
  - api-reference（API 参考）

#### Scenario: Content source
- **WHEN** 文档内容编写完成
- **THEN** 内容 SHALL 基于 CLAUDE.md 中已有的架构描述转化而来，保持技术准确性
