## 1. Agent 注册表

- [x] 1.1 创建 `src/agent/registry.ts`，定义 `AgentRegistryEntry` 接口和 `AGENT_REGISTRY` 数组，包含 planner、executor、reviewer、scorer 四条记录（id、name、label 中文名、icon、tools 含中文名、maxSteps、instructions）

## 2. AgentPanel 组件

- [x] 2.1 创建 `src/components/AgentPanel/main.vue`：卡片网格展示所有 Agent，从 `AGENT_REGISTRY` 读取数据，从 `useExecutionMonitor` 获取运行状态
- [x] 2.2 创建 `src/components/AgentPanel/styles.css`：毛玻璃卡片样式 + CSS Grid 自动换行布局
- [x] 2.3 实现 Drawer 详情面板：点击卡片滑出右侧 Drawer，展示提示词、工具中文名列表、步骤上限

## 3. 集成到主布局

- [x] 3.1 修改 `src/components/ActivityBar/main.vue`：新增 `__agents__` 图标项
- [x] 3.2 修改 `src/views/ChatView/main.vue`：import AgentPanel，处理 `selectedPeer === "__agents__"` 渲染逻辑
