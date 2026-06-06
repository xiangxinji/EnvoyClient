## ADDED Requirements

### Requirement: ai_usage 数据表
系统 SHALL 在全局 manager-db 中维护 `ai_usage` 表，存储每次 AI 调用的 token 用量记录。表结构 SHALL 包含字段：`id`（自增主键）、`team`（团队名）、`username`（触发用户）、`scene`（场景类型）、`preset_id`（模型预设 ID）、`prompt_tokens`（输入 token 数）、`completion_tokens`（输出 token 数）、`created_at`（时间戳）。

#### Scenario: 表创建
- **WHEN** manager-db 初始化
- **THEN** SHALL 创建 `ai_usage` 表，含 `team`、`username`、`scene`、`created_at` 索引

#### Scenario: 写入用量记录
- **WHEN** 任意 AI 端点完成一次调用
- **THEN** SHALL 插入一条记录到 `ai_usage` 表，包含 team、username、scene、preset_id、prompt_tokens、completion_tokens、created_at

### Requirement: recordUsage 工具函数
系统 SHALL 在 `manager-db.ts` 中提供 `recordUsage(record)` 函数，接受 `{ team, username, scene, presetId, promptTokens, completionTokens }` 参数，执行 INSERT 到 `ai_usage` 表。

#### Scenario: 正常记录
- **WHEN** 调用 `recordUsage({ team: "alpha", username: "user1", scene: "agent", presetId: "preset-1", promptTokens: 500, completionTokens: 200 })`
- **THEN** SHALL 在 `ai_usage` 表插入对应记录，`created_at` 为当前时间戳

#### Scenario: 记录失败不阻塞主流程
- **WHEN** `recordUsage` 执行时数据库写入失败
- **THEN** SHALL 静默记录错误（console.error），不抛出异常，不影响 AI 响应返回

### Requirement: 用量查询 API
系统 SHALL 提供 `GET /api/ai/usage` 端点（adminAuth 保护），支持查询参数 `from`（起始时间戳）、`to`（结束时间戳）、`team`（团队筛选）、`username`（用户筛选）、`scene`（场景筛选）、`group`（聚合维度：`team`|`username`|`scene`|`day`）。

#### Scenario: 查询总用量（无 group）
- **WHEN** 管理员 GET `/api/ai/usage?from=<今日0点>`
- **THEN** SHALL 返回 `{ total: { promptTokens, completionTokens, calls }, breakdown: [] }`

#### Scenario: 按团队聚合
- **WHEN** 管理员 GET `/api/ai/usage?group=team`
- **THEN** SHALL 返回 `breakdown` 数组，每项包含 `{ key: "<teamName>", promptTokens, completionTokens, calls }`，按总 token 降序

#### Scenario: 按用户聚合
- **WHEN** 管理员 GET `/api/ai/usage?group=username`
- **THEN** SHALL 返回 `breakdown` 数组，每项包含 `{ key: "<username>", promptTokens, completionTokens, calls }`

#### Scenario: 按场景聚合
- **WHEN** 管理员 GET `/api/ai/usage?group=scene`
- **THEN** SHALL 返回 `breakdown` 数组，每项包含 `{ key: "<sceneType>", promptTokens, completionTokens, calls }`

#### Scenario: 按天聚合
- **WHEN** 管理员 GET `/api/ai/usage?group=day`
- **THEN** SHALL 返回 `breakdown` 数组，每项包含 `{ key: "<YYYY-MM-DD>", promptTokens, completionTokens, calls }`，按日期升序

#### Scenario: 组合筛选
- **WHEN** 管理员 GET `/api/ai/usage?team=alpha&scene=agent&from=...&to=...`
- **THEN** SHALL 同时应用团队、场景和时间范围筛选

#### Scenario: 无认证拒绝
- **WHEN** 未携带 admin token 请求 `/api/ai/usage`
- **THEN** SHALL 返回 401

### Requirement: clientAuth 身份透传
`clientAuth` middleware SHALL 通过 `c.set("userId", session.userId)` 和 `c.set("role", session.role)` 将用户身份信息透传给下游 handler。需在 `routes/users.ts` 中新增 `lookupClientSession(token)` 函数返回完整 session 对象。

#### Scenario: 有效 token 透传身份
- **WHEN** 携带有效 `X-Envoy-Token` 的请求经过 clientAuth
- **THEN** SHALL 调用 `c.set("userId", <session.userId>)` 和 `c.set("role", <session.role>)`，下游可通过 `c.get("userId")` 获取

#### Scenario: 无效 token 不透传
- **WHEN** 携带无效或过期 token
- **THEN** SHALL 返回 401，不执行 c.set

#### Scenario: 向后兼容
- **WHEN** 现有端点不读取 `c.get("userId")`
- **THEN** SHALL 行为完全不变，无副作用

### Requirement: AI 端点 team 上下文
所有 clientAuth 保护的 AI 端点 SHALL 通过 `c.req.header("team")` 获取团队名称，传递给 `recordUsage`。若 team header 缺失，SHALL 使用空字符串作为 team 值（不拒绝请求）。

#### Scenario: 携带 team header
- **WHEN** AI 请求包含 `team: alpha` header
- **THEN** SHALL 使用 "alpha" 作为 team 值记录用量

#### Scenario: 缺少 team header
- **WHEN** AI 请求不包含 team header
- **THEN** SHALL 使用空字符串 `""` 作为 team 值，请求正常处理

### Requirement: Dashboard 概览统计
Dashboard 页面 SHALL 显示今日 AI token 消耗统计卡，包含今日 prompt tokens、今日 completion tokens、今日总调用次数。数据通过 `/api/ai/usage?from=<今日0点>` 获取。

#### Scenario: Dashboard 显示统计卡
- **WHEN** 管理员访问 Dashboard 页面
- **THEN** SHALL 在现有统计卡旁显示 AI 用量统计卡，随 5 秒自动刷新更新

#### Scenario: 无用量数据
- **WHEN** 今日无 AI 调用
- **THEN** SHALL 显示 "0" 而非空白

### Requirement: Analytics 独立分析页
系统 SHALL 提供 `/analytics` 页面，包含时间范围筛选（今日/7天/30天）、团队下拉、用户下拉、场景下拉、统计总览、团队排行、用户排行、场景分布。

#### Scenario: 页面访问
- **WHEN** 管理员点击侧边栏 "AI 用量" 入口
- **THEN** SHALL 导航到 `/analytics` 页面

#### Scenario: 默认加载
- **WHEN** 进入 Analytics 页面
- **THEN** SHALL 默认显示最近 7 天数据，加载团队/用户/场景排行

#### Scenario: 切换筛选
- **WHEN** 管理员选择不同时间范围或筛选条件
- **THEN** SHALL 刷新统计数据和排行列表

#### Scenario: 团队排行
- **WHEN** 展示团队排行
- **THEN** SHALL 按总 token 降序列出所有团队及其 prompt/completion token 数

#### Scenario: 用户排行
- **WHEN** 展示用户排行
- **THEN** SHALL 按总 token 降序列出所有用户及其 prompt/completion token 数

#### Scenario: 场景分布
- **WHEN** 展示场景分布
- **THEN** SHALL 列出各场景类型的调用次数和 token 占比
