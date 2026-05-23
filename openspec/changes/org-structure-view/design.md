## Context

EnvoyClient 当前通过 `MemberSidebar` 列表展示团队成员，在线状态仅用一个小圆点表示，任务执行状态无法一览。团队数据已具备：
- `useConnection.members`：所有注册成员 + online/offline 状态（`MemberInfo[]`，含 role/nickname/avatar_url/responsibilities）
- `TaskService` REST API：`GET /api/teams/{teamName}/tasks` 返回所有任务（`ApiTask[]`，含 subscribe[] 和 status）
- WebSocket 实时推送：`team:members`（在线状态变更）、`task`（任务状态变更）

页面路由通过 `ChatView` 的 `selectedPeer` ref + `v-else-if` 链控制，新增面板需一个 `__org__` 前缀的 peer ID。

## Goals / Non-Goals

**Goals:**
- 新增侧栏入口 `__org__`，点击切换到组织架构可视化页面
- 使用 Vue Flow 渲染两层树形图：Leader 节点在上，所有 Member 节点在下
- 每个成员节点展示：头像、昵称、在线状态点、任务摘要（⏳running ✅completed ❌failed 🔍reviewing，只显示非零项）
- 空闲成员显示"空闲"提示，离线成员用虚线边框 + 半透明样式
- 实时更新：订阅已有 WebSocket 事件，无需新增 API

**Non-Goals:**
- 不支持节点拖拽或交互跳转（纯展示）
- 不支持多层级组织架构（固定两层 Leader → Members）
- 不展示任务内容详情，只做状态统计
- 不新增后端 API

## Decisions

### 1. 使用 @vue-flow/core + @dagrejs/dagre

**选择**: Vue Flow + dagre 层级布局
**替代方案**: 纯 CSS Flexbox/SVG 连线
**理由**: dagre 自动处理成员数量变化时的布局重排（3 人 vs 15 人），Vue Flow 的自定义节点可复用现有组件（SvgIcon、头像、状态点），连线样式（贝塞尔/直线/虚线）开箱即用。纯 CSS 方案在成员数变化时需手动计算连线和间距。

### 2. 数据聚合在 useTeamGraph composable 中

**选择**: 新建 `src/composables/useTeamGraph.ts`，内部聚合 members + tasks → Vue Flow nodes/edges
**理由**: 视图组件只负责渲染，数据转换逻辑独立可测试。composable 负责：
- 调用 `managerFetch` 拉取任务列表（复用 TaskCenterView 的 fetchTasks 模式）
- 按 member.id 聚合任务计数（`subscribe` 数组包含该 member 的任务按 status 分组计数）
- 转换为 Vue Flow 的 `Node[]` + `Edge[]`
- 监听 `client.on("task", ...)` 和 `team:members` 事件更新数据

### 3. 自定义节点组件拆分

**选择**: 三个独立节点组件，放在 `src/components/OrgView/` 目录下
- `LeaderNode.vue` — 较大的卡片，显示头像 + 昵称 + 任务摘要 + 👑 标识
- `MemberNode.vue` — 标准卡片，显示头像 + 昵称 + 在线状态 + 任务摘要 + responsibilities 截断
- `EmptyMemberNode.vue` — 无任务在线成员，显示"✨ 空闲"
**理由**: Leader 和 Member 样式差异明显，分开比一个组件内 v-if 更清晰。离线成员通过 CSS class 切换样式（虚线边框 + opacity），不单独成组件。

### 4. 文件结构

```
src/
├── components/OrgView/
│   ├── main.vue              # 页面容器，挂载 Vue Flow
│   ├── styles.css            # 页面 + 节点样式
│   ├── LeaderNode.vue        # Leader 自定义节点
│   └── MemberNode.vue        # Member 自定义节点（含空闲/离线状态）
├── composables/
│   └── useTeamGraph.ts       # 聚合 members + tasks → Graph 数据
```

### 5. 任务摘要格式

只显示非零计数，避免无意义的一排零：
- `⏳2  ✅3  ❌1` — 有任务时显示
- `✨ 空闲` — 零任务 + 在线时显示
- `离线` — 离线时只显示状态

### 6. dagre 布局参数

- 方向：TB（top to bottom）
- Leader 节点 rank 固定在顶层
- Member 节点按在线优先排序（在线在前，离线在后），同状态按任务量降序
- 节点间距：ranksep=120, nodesep=40
- 所有节点不可拖拽（`draggable: false`）

## Risks / Trade-offs

- **[Vue Flow 体积]** +50KB 依赖 → 仅在 OrgView 路由下异步加载（Vue `defineAsyncComponent` 或动态 import），不影响首屏
- **[任务数据拉取]** 每次进入页面需 fetch 任务列表 → 可接受，TaskCenterView 也是这个模式。后续可考虑提升任务数据到共享 store 避免重复拉取
- **[大量成员性能]** dagre 布局在 50+ 节点时可能卡顿 → 短期内团队规模在 20 人以内无问题，超大团队需后续优化（虚拟化或分页）
- **[重复数据获取]** OrgView 和 TaskCenterView 各自独立 fetch 任务 → 当前可接受，后续可提取 `useTaskStore` 共享数据
