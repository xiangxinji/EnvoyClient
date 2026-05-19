## ADDED Requirements

### Requirement: Extended glass design variables
官网 SHALL 延续客户端毛玻璃设计体系的 CSS 变量结构，使用更大气的参数值。

#### Scenario: Glass blur level
- **WHEN** 毛玻璃元素渲染
- **THEN** `--glass-blur` SHALL 设为 40px（客户端为 20px），产生更柔和的模糊效果

#### Scenario: Glass opacity
- **WHEN** 标准毛玻璃面板渲染
- **THEN** `--glass-bg` SHALL 使用 45% 透明度（客户端为 60%），更通透的视觉效果

#### Scenario: Glass heavy opacity
- **WHEN** 重度毛玻璃面板（导航栏、Header）渲染
- **THEN** `--glass-bg-heavy` SHALL 使用 60% 透明度（客户端为 75%）

### Requirement: Dark-first theme
官网 SHALL 以暗色主题为默认，同时支持亮色主题切换。

#### Scenario: Default dark theme
- **WHEN** 用户首次访问官网
- **THEN** 页面 SHALL 以暗色主题渲染（延续客户端 `html.dark` 色系）

#### Scenario: Theme toggle
- **WHEN** 用户点击主题切换按钮
- **THEN** 页面 SHALL 在暗色/亮色主题之间切换，切换结果保存在 localStorage

#### Scenario: Theme persistence
- **WHEN** 用户再次访问官网
- **THEN** 页面 SHALL 读取 localStorage 中的主题偏好并应用

### Requirement: Orb background decorations
官网 SHALL 使用装饰性光晕球（Orb）作为背景元素。

#### Scenario: Orb rendering
- **WHEN** 页面渲染
- **THEN** 背景 SHALL 包含多个半透明渐变光晕球（复用客户端 `--orb-*` 色系），以固定或缓慢浮动的方式呈现

### Requirement: Content max-width constraint
官网内容区域 SHALL 有最大宽度限制，保证大屏阅读体验。

#### Scenario: Content width
- **WHEN** 视口宽度超过 1200px
- **THEN** 主要内容区域 SHALL 限制在最大 1200px 宽度，水平居中

### Requirement: Responsive breakpoints
官网 SHALL 支持主流响应式断点。

#### Scenario: Mobile layout
- **WHEN** 视口宽度小于 768px
- **THEN** 导航栏 SHALL 切换为汉堡菜单，内容区单列布局，Feature 网格变为单列

#### Scenario: Tablet layout
- **WHEN** 视口宽度在 768px-1024px 之间
- **THEN** Feature 网格 SHALL 显示为 2 列

#### Scenario: Desktop layout
- **WHEN** 视口宽度大于 1024px
- **THEN** Feature 网格 SHALL 显示为 3 列，侧边栏展开

### Requirement: Scroll animations
页面中的各区块 SHALL 包含滚动进入动画。

#### Scenario: Fade-in on scroll
- **WHEN** 区块滚动进入视口（IntersectionObserver）
- **THEN** 区块 SHALL 以 fade-in + slide-up 动画出现

#### Scenario: Animation disabled for reduced motion
- **WHEN** 用户浏览器设置了 `prefers-reduced-motion: reduce`
- **THEN** 所有滚动动画 SHALL 被禁用，内容直接显示
