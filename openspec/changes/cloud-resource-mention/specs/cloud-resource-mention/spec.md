## ADDED Requirements

### Requirement: CloudRef 数据模型

系统 SHALL 定义 `CloudRef` 接口，包含以下字段：
- `name`: string（文件或目录名称）
- `path`: string（完整路径，如 `docs/design-spec.pdf`）
- `type`: "file" | "directory"
- `size`: number（字节数，目录为 0）

`ChatMessage` 接口 SHALL 新增可选字段 `cloudRefs?: CloudRef[]`。

#### Scenario: 旧消息无 cloudRefs 字段
- **WHEN** 收到一条没有 cloudRefs 字段的历史消息
- **THEN** MessageBubble 正常渲染文本内容，不显示任何云资源引用卡片

#### Scenario: 新消息包含云资源引用
- **WHEN** 收到一条 cloudRefs 包含 `[{ name: "design-spec.pdf", path: "docs/design-spec.pdf", type: "file", size: 2458624 }]` 的消息
- **THEN** MessageBubble 在文本中对应标记位置渲染云资源卡片

### Requirement: 云资源搜索 API

Manager SHALL 提供 `GET /api/cloud/search` 端点。请求 SHALL 通过 `team` header 标识目标团队，`q` query 参数为搜索关键词。端点 SHALL 递归搜索团队文件树，返回匹配的文件和目录，最多 20 条。每条结果 SHALL 包含 `name`、`path`、`type`、`size` 字段。

#### Scenario: 搜索匹配文件
- **WHEN** GET /api/cloud/search?q=design&team=alpha，存在 `docs/design-spec.pdf`
- **THEN** 返回 `[{ name: "design-spec.pdf", path: "docs/design-spec.pdf", type: "file", size: 2458624 }]`

#### Scenario: 搜索匹配目录
- **WHEN** GET /api/cloud/search?q=docs&team=alpha，存在 `docs/` 目录
- **THEN** 结果中包含 `{ name: "docs", path: "docs", type: "directory", size: 0 }`

#### Scenario: 搜索无匹配
- **WHEN** GET /api/cloud/search?q=nonexistent&team=alpha
- **THEN** 返回空数组 `[]`

#### Scenario: 缺少 team header
- **WHEN** GET /api/cloud/search?q=test 不带 team header
- **THEN** 返回 400 错误

### Requirement: 云资源校验 API

Manager SHALL 提供 `POST /api/cloud/validate` 端点。请求 SHALL 通过 `team` header 标识目标团队，body 为 `{ paths: string[] }`。端点 SHALL 返回 `Record<string, boolean>`，key 为路径，value 为该路径是否仍然存在。

#### Scenario: 批量校验存在和已删除的文件
- **WHEN** POST /api/cloud/validate，team 为 alpha，body `{ paths: ["docs/a.pdf", "docs/deleted.pdf"] }`，其中 `docs/a.pdf` 存在、`docs/deleted.pdf` 已删除
- **THEN** 返回 `{ "docs/a.pdf": true, "docs/deleted.pdf": false }`

#### Scenario: 空路径数组
- **WHEN** POST /api/cloud/validate，body `{ paths: [] }`
- **THEN** 返回 `{}`

#### Scenario: 缺少 team header
- **WHEN** POST /api/cloud/validate 不带 team header
- **THEN** 返回 400 错误

### Requirement: 编辑器 # 触发检测

`useCloudMention` composable SHALL 监听 RichEditor 的 input 事件，在光标前的文本中检测 `#` 后跟 `[\w.\-]*` 的模式（正则 `/#([\w.\-]*)$/`）。匹配时 SHALL 设置搜索查询并显示 CloudMentionPopup，不匹配时 SHALL 隐藏弹窗。此检测 SHALL 在 DM 和频道中均生效。

#### Scenario: 输入 # 触发
- **WHEN** 用户在编辑器中输入 `#`
- **THEN** CloudMentionPopup 显示，搜索查询为空字符串

#### Scenario: 输入 # 加搜索词
- **WHEN** 用户在编辑器中输入 `#design`
- **THEN** CloudMentionPopup 显示，搜索查询为 "design"

#### Scenario: 输入空格关闭弹窗
- **WHEN** CloudMentionPopup 可见时用户输入空格
- **THEN** CloudMentionPopup 隐藏

#### Scenario: DM 中触发
- **WHEN** 用户在私聊编辑器中输入 `#`
- **THEN** CloudMentionPopup 显示（与频道行为一致）

### Requirement: CloudMentionPopup 搜索面板

CloudMentionPopup 组件 SHALL 接收 `visible`、`query` 属性，调用 `searchCloudFiles` API 实时搜索云资源。每条结果 SHALL 显示 FileIcon + 文件名 + 路径。组件 SHALL 支持键盘导航（ArrowUp/Down 选择，Enter/Tab 确认，Escape 关闭）。

#### Scenario: 显示搜索结果
- **WHEN** popup visible 且 query 为 "design"
- **THEN** 调用 searchCloudFiles API，显示匹配的文件和目录列表

#### Scenario: 键盘选择
- **WHEN** popup visible 且用户按 ArrowDown
- **THEN** 高亮下移一项

#### Scenario: 键盘确认
- **WHEN** popup visible 且用户按 Enter
- **THEN** 触发 select 事件，传递当前高亮的云资源条目

#### Scenario: 无搜索结果
- **WHEN** 搜索 API 返回空数组
- **THEN** popup 显示"无匹配文件"提示

### Requirement: CloudReference Tiptap 节点

RichEditor SHALL 注册自定义 Tiptap 节点 `cloudReference`，属性为 `name`、`path`、`type`、`size`。节点 SHALL 为 inline atom（不可编辑文本）。节点在编辑器中 SHALL 渲染为带文件图标的 chip（如 `[📄 design-spec.pdf]`）。

#### Scenario: 插入云资源引用节点
- **WHEN** 用户从 CloudMentionPopup 选择一个文件 `design-spec.pdf`
- **THEN** 编辑器在光标位置插入 cloudReference 节点，渲染为 chip

#### Scenario: CloudReference 节点序列化
- **WHEN** extractText() 处理编辑器 HTML 输出
- **THEN** 遇到 cloudReference 节点时输出 `{cloud:0}` 标记（索引按出现顺序）

### Requirement: 云资源引用选择与发送

用户从 CloudMentionPopup 选择云资源后，系统 SHALL 删除编辑器中的 `#query` 文本，插入 CloudReference 节点，并将资源信息添加到 `currentCloudRefs` 数组。发送消息时 SHALL 将 `currentCloudRefs` 作为 `cloudRefs` 字段传递给 `sendChat`。发送后 SHALL 清空 `currentCloudRefs`。

#### Scenario: 选择文件并发送
- **WHEN** 用户输入 `#design`，选择 `design-spec.pdf`，然后发送消息
- **THEN** 消息 payload 包含 `cloudRefs: [{ name: "design-spec.pdf", path: "docs/design-spec.pdf", type: "file", size: 2458624 }]`，text 中包含 `{cloud:0}` 标记

#### Scenario: 选择多个云资源
- **WHEN** 用户在一条消息中引用两个文件
- **THEN** cloudRefs 数组包含两个条目，text 中包含 `{cloud:0}` 和 `{cloud:1}` 标记

#### Scenario: 选择目录
- **WHEN** 用户选择一个目录 `research/`
- **THEN** cloudRefs 包含 `{ type: "directory", size: 0 }` 的条目

### Requirement: 弹窗可见时禁止发送

CloudMentionPopup 可见时，RichEditor 的 Enter 键 SHALL NOT 触发发送，而是交给弹窗处理键盘事件。此行为 SHALL 通过 `enterSendDisabled` prop 实现（与 @ 提及一致）。

#### Scenario: 弹窗可见时按 Enter
- **WHEN** CloudMentionPopup 可见且用户按 Enter
- **THEN** 不发送消息，弹窗处理选择

### Requirement: 云资源引用卡片渲染

BubbleContent SHALL 在 `renderedHtml` 中检测 `{cloud:N}` 标记，根据 `cloudRefs[N]` 的信息渲染为内联卡片。

文件卡片 SHALL 显示：
- FileIcon（根据文件类型）
- 文件名
- 文件大小（格式化）
- 下载按钮（链接到 `cloudDownloadUrl`）

目录卡片 SHALL 显示：
- 文件夹图标
- 目录名
- "在云盘中打开"按钮（跳转到 CloudResourcesPanel 对应路径）

#### Scenario: 渲染文件引用卡片
- **WHEN** 消息包含 `{cloud:0}` 标记和 `cloudRefs[0] = { name: "report.pdf", type: "file", size: 1024000, path: "docs/report.pdf" }`
- **THEN** 标记位置渲染为文件卡片，显示 "📄 report.pdf · 1000 KB · [⬇ 下载]"

#### Scenario: 渲染目录引用卡片
- **WHEN** 消息包含 `{cloud:0}` 标记和 `cloudRefs[0] = { name: "research", type: "directory", path: "research" }`
- **THEN** 标记位置渲染为目录卡片，显示 "📁 research · [→ 在云盘中打开]"

#### Scenario: 标记索引越界
- **WHEN** 消息包含 `{cloud:5}` 但 cloudRefs 只有 2 个条目
- **THEN** 渲染为纯文本 `{cloud:5}`（不崩溃）

### Requirement: 云资源过期状态显示

BubbleContent 渲染含云资源引用的消息后，SHALL 在 `onMounted` 中调用 `POST /api/cloud/validate` 批量校验所有引用路径。校验结果 SHALL 缓存在组件内。路径不存在的引用 SHALL 显示为灰色降级卡片，文件名后标注"已过期"。

#### Scenario: 文件已删除
- **WHEN** 消息引用 `docs/deleted.pdf`，validate 返回 `{ "docs/deleted.pdf": false }`
- **THEN** 卡片显示 "📄 deleted.pdf (已过期)"，灰色样式，无下载按钮

#### Scenario: 目录已删除
- **WHEN** 消息引用 `old-folder`，validate 返回 `{ "old-folder": false }`
- **THEN** 卡片显示 "📁 old-folder (已过期)"，灰色样式，无跳转按钮

#### Scenario: 校验请求失败
- **WHEN** validate API 调用失败（网络错误）
- **THEN** 卡片保持正常显示（不标记为过期），静默失败
