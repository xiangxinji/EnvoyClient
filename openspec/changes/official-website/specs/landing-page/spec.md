## ADDED Requirements

### Requirement: Hero Banner with particle wave effect
官网首页 SHALL 展示全屏 Hero Banner，包含产品名称、slogan、CTA 按钮和 Canvas 2D 波浪粒子特效背景。

#### Scenario: Normal rendering
- **WHEN** 用户访问官网首页
- **THEN** Hero Banner 显示产品名称 "EnvoyClient"、slogan 文案、"下载" 和 "文档" 两个 CTA 按钮，背景为 Canvas 2D 渲染的多层波浪粒子动画

#### Scenario: Reduced motion fallback
- **WHEN** 用户浏览器设置了 `prefers-reduced-motion: reduce`
- **THEN** Canvas 粒子特效不渲染，Hero Banner 背景降级为纯 CSS 渐变效果

#### Scenario: Mouse interaction
- **WHEN** 用户在 Hero 区域移动鼠标
- **THEN** 鼠标附近的粒子 SHALL 受到排斥力影响，产生向外散开的效果

### Requirement: Particle system performance
粒子系统 SHALL 保证流畅渲染，不影响页面交互性能。

#### Scenario: Frame rate stability
- **WHEN** 粒子数量为 500-800 个
- **THEN** 渲染帧率 SHALL 保持在 60fps（允许偶尔降到 45fps 以上）

#### Scenario: Off-screen pause
- **WHEN** 浏览器标签页不可见（visibilitychange hidden）
- **THEN** 粒子渲染循环 SHALL 完全暂停，不消耗 CPU/GPU

#### Scenario: Page resize
- **WHEN** 浏览器窗口大小改变
- **THEN** Canvas SHALL 自动调整尺寸匹配容器，粒子位置按比例重分布

### Requirement: Feature grid section
首页 SHALL 展示 4-6 个核心特性卡片，以网格布局呈现。

#### Scenario: Feature display
- **WHEN** 用户浏览首页 Features 区域
- **THEN** 每个 Feature 卡片 SHALL 包含图标、标题、描述文案，采用毛玻璃卡片样式

#### Scenario: Scroll animation
- **WHEN** Feature 卡片滚动进入视口
- **THEN** 卡片 SHALL 以 fade-in + slide-up 动画依次出现

### Requirement: How it Works section
首页 SHALL 展示工作流程的 3 步说明（Leader 分派 → Member Agent 执行 → Review 审批）。

#### Scenario: Workflow display
- **WHEN** 用户浏览 How it Works 区域
- **THEN** 页面 SHALL 以流程图/步骤卡片形式展示 3 个步骤，每步包含标题、描述和示意图标

### Requirement: Tech Stack section
首页 SHALL 展示项目使用的技术栈。

#### Scenario: Tech display
- **WHEN** 用户浏览 Tech Stack 区域
- **THEN** 页面 SHALL 展示 Tauri 2、Vue 3、WebSocket、Multi-AI Providers 等核心技术标签/图标

### Requirement: Call to Action section
首页底部 SHALL 包含 CTA 区域，引导用户下载或阅读文档。

#### Scenario: CTA display
- **WHEN** 用户浏览到首页底部
- **THEN** 页面 SHALL 显示醒目的行动号召按钮（下载 + 阅读文档），采用毛玻璃卡片容器
