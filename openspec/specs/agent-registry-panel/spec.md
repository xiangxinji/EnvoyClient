## ADDED Requirements

### Requirement: Agent registry data structure
系统 SHALL 提供 `src/agent/registry.ts`，集中管理所有 Agent 的元数据，新增 Agent 只需添加一条记录。

#### Scenario: Registry contains all current agents
- **WHEN** 应用加载 `AGENT_REGISTRY`
- **THEN** 包含 planner、executor、reviewer、scorer 四条记录，每条含 id、name（英文标识）、label（中文名）、icon（图标名）、tools（工具列表含中文名）、maxSteps、instructions（提示词）

#### Scenario: Adding a new agent
- **WHEN** 需要新增一个 Agent
- **THEN** 只需在 `AGENT_REGISTRY` 数组中追加一条记录，面板自动展示新 Agent 卡片

### Requirement: ActivityBar agent icon
ActivityBar SHALL 新增一个 Agent 图标，点击后切换到 Agent 面板。

#### Scenario: Click agent icon
- **WHEN** 用户点击 ActivityBar 中的 Agent 图标
- **THEN** `selectedPeer` 设为 `__agents__`，内容区显示 AgentPanel

#### Scenario: Agent icon active state
- **WHEN** `selectedPeer === "__agents__"`
- **THEN** ActivityBar 中 Agent 图标显示为选中状态

### Requirement: Agent card grid
AgentPanel SHALL 以卡片网格展示所有 Agent，每张卡片显示图标、中文名和运行状态。

#### Scenario: Card displays agent info
- **WHEN** AgentPanel 渲染
- **THEN** 每个 Agent 以卡片形式展示，包含角色图标、中文标签名和状态指示器（运行中/空闲）

#### Scenario: Agent running status
- **WHEN** `useExecutionMonitor` 显示 `status === "running"` 且 `currentStage` 匹配某个 Agent 的 id
- **THEN** 该 Agent 卡片状态指示器显示为"运行中"（绿色圆点）

#### Scenario: Agent idle status
- **WHEN** 该 Agent 未在执行
- **THEN** 卡片状态指示器显示为"空闲"（灰色圆点）

### Requirement: Agent detail drawer
点击 Agent 卡片 SHALL 打开 Drawer，展示该 Agent 的详细信息。

#### Scenario: Drawer shows agent details
- **WHEN** 用户点击某个 Agent 卡片
- **THEN** 右侧滑出 Drawer，展示提示词（只读文本区域）、可用工具列表（中文名）、步骤上限

#### Scenario: Drawer slide animation
- **WHEN** Drawer 打开或关闭
- **THEN** 使用 slideRight 动效预设（`@vueuse/motion`）

#### Scenario: Close drawer
- **WHEN** 用户点击 Drawer 返回按钮或点击同一卡片
- **THEN** Drawer 关闭，回到卡片网格视图

### Requirement: Chinese labels for tools
每个 Agent 的工具列表 SHALL 显示中文名称。

#### Scenario: Tool names in Chinese
- **WHEN** Drawer 展示某个 Agent 的工具列表
- **THEN** 每个工具显示中文名称（如"文件读取"而非"file_read"）
