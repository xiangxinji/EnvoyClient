## 1. 依赖安装

- [x] 1.1 安装 `@vue-flow/core`、`@vue-flow/background`、`@dagrejs/dagre` 依赖
- [x] 1.2 创建 `src/components/OrgView/` 目录结构（main.vue、styles.css、LeaderNode.vue、MemberNode.vue）

## 2. 数据层 — useTeamGraph composable

- [x] 2.1 创建 `src/composables/useTeamGraph.ts`，从 `getTeamClientInstance()` 获取 members、myId、role、client
- [x] 2.2 实现 `fetchTasks()`：调用 `managerFetch` 拉取任务列表，转换为 `TaskMessage[]`
- [x] 2.3 实现 `computeMemberTaskSummary()`：按 member id 聚合 subscribe 中包含该成员的任务，按 status 分组计数
- [x] 2.4 实现 `computeLeaderTaskSummary()`：统计 from 等于 leader id 的任务按 status 分组计数
- [x] 2.5 实现 `buildGraph()`：将 members + task summaries 转换为 Vue Flow `Node[]` + `Edge[]`，Leader 节点 type 为 `leader`，Member 节点 type 为 `member`
- [x] 2.6 实现实时更新：监听 `client.on("task", ...)` 和 onlineIds 变化，触发 `buildGraph` 重新计算
- [x] 2.7 dagre 布局配置：TB 方向，ranksep=120，nodesep=40，节点按在线优先 + 任务量降序排列，`draggable: false`

## 3. 自定义节点组件

- [x] 3.1 创建 `LeaderNode.vue`：大尺寸卡片，显示头像（或 initial）、昵称、👑 图标、任务摘要（只显示非零计数）
- [x] 3.2 创建 `MemberNode.vue`：标准卡片，显示头像、昵称、在线状态点、任务摘要、responsibilities 截断
- [x] 3.3 MemberNode 状态分支：在线有任务显示摘要，在线无任务显示"✨ 空闲"，离线显示灰色点 + "离线" + 虚线边框 + opacity:0.5
- [x] 3.4 边样式：在线成员实线边，离线成员虚线边 + 低透明度

## 4. 页面组件 — OrgView

- [x] 4.1 创建 `OrgView/main.vue`：挂载 Vue Flow，注册自定义节点类型（leader → LeaderNode，member → MemberNode）
- [x] 4.2 配置 Vue Flow：禁用拖拽、缩放限制、fitView 初始化、Background 插件
- [x] 4.3 页面样式 `styles.css`：毛玻璃背景、节点卡片样式，遵循 CLAUDE.md 设计规范（CSS 变量）

## 5. 路由集成

- [x] 5.1 `MemberSidebar/main.vue`：在 tools 列表的 `navItems` computed 中添加 `__org__`，在 `toolDescMap` 和 `toolIconMap` 中注册
- [x] 5.2 `MemberSidebar/main.vue`：在模板 tools `<ul>` 中添加 `__org__` 的 `<li>` 条目（图标 + 标签）
- [x] 5.3 `useSidebarSearch.ts`：在 tools 列表中添加 `__org__` 条目
- [x] 5.4 `ChatView/main.vue`：添加 `v-else-if="selectedPeer === '__org__'"` 分支，异步加载 OrgView 组件
- [x] 5.5 添加 i18n 翻译 key：`sidebar.orgStructure`、`sidebar.orgStructureDesc`

## 6. 验证

- [ ] 6.1 验证侧栏入口点击切换到 OrgView
- [ ] 6.2 验证 Leader 节点和 Member 节点正确渲染
- [ ] 6.3 验证成员在线/离线状态切换实时反映到图中
- [ ] 6.4 验证任务状态变更实时更新节点上的摘要计数
- [ ] 6.5 验证离线成员样式（虚线边框 + 半透明）和排序（沉底）
- [ ] 6.6 验证 Vue Flow 懒加载，不在首屏 bundle 中
