## Context

当前 @ 提及系统（`useMentionSystem` → `MentionPopup`）提供了成熟的触发-搜索-插入模式：用户输入 `@` 触发弹出面板，选择成员后以纯文本 `@memberId` 插入编辑器，发送时 `mentions: string[]` 随消息 payload 传递。

云资源功能已完整实现（`CloudResourcesPanel`），API 层有 `listCloudFiles`、`uploadCloudFile`、`cloudDownloadUrl` 等，数据模型为 `CloudFileItem { id, name, type, size, uploadedBy, createdAt }`。

本设计复用 @ 提及的交互模式，但需要解决以下差异：

| 维度 | @ 提及 | # 云资源引用 |
|------|--------|-------------|
| 触发范围 | 仅频道 | DM + 频道 |
| 数据源 | 成员列表（内存） | 云文件树（需搜索 API） |
| 文本格式 | `@memberId`（无空格） | 文件名可含空格/点/中文 |
| 渲染 | 高亮 span | 可交互卡片（下载/跳转） |
| 生命周期 | 成员始终存在 | 文件可能被删除 |

## Goals / Non-Goals

**Goals:**
- 在编辑器中通过 `#` 触发云资源搜索，选择后以内联 chip 形式插入
- 消息接收方看到带文件信息和下载/跳转按钮的卡片
- 支持文件和目录两种引用类型
- 已删除资源显示"已过期"降级状态

**Non-Goals:**
- 不做云资源浏览导航（引用面板只做搜索，不做目录浏览）
- 不做引用计数或引用关系追踪
- 不做消息内编辑/替换已引用的云资源

## Decisions

### 1. Tiptap 自定义节点 vs 纯文本

**选择：Tiptap 自定义节点（CloudReference）**

文件名可包含空格、Unicode 字符、点号等，与 @ 提及的 `memberId`（纯 `\w+`）不同。纯文本方案难以可靠地划定文件名边界。自定义节点将引用封装为不可编辑的 atom 节点，边界清晰。

节点定义：
- `name: "cloudReference"`, `group: "inline"`, `inline: true`, `atom: true`
- 属性：`name`, `path`, `type`, `size`
- 渲染：`<span data-cloud-ref class="cloud-ref-chip">📄 filename</span>`

序列化策略：`extractText()` 遇到 CloudReference 节点时，输出 `{cloud:N}` 标记（N 为索引，按出现顺序）。

### 2. 触发检测正则

`/#([\w.\-]*)$/` — 匹配 `#` 后跟 word 字符、点号、连字符。这覆盖了大多数文件名前缀场景。搜索由后端 API 处理，正则只负责检测触发和提取搜索词。

### 3. 搜索策略

**选择：后端搜索 API**

新增 `GET /api/cloud/search?q=keyword&team=xxx`，后端递归搜索文件树返回匹配结果。理由：
- 避免前端加载整个文件树（可能很大）
- 后端可以优化搜索（缓存、索引）
- 响应格式：`[{ name, path, type, size }]`，带完整路径

### 4. 过期校验策略

**选择：组件级批量校验 + 响应式状态**

BubbleContent 渲染消息后，`onMounted` 中收集所有该消息的 cloud ref 路径，调用 `POST /api/cloud/validate` 批量校验。校验结果存为响应式 Map，卡片根据结果切换显示状态。

不在 `renderedHtml` computed 中做异步调用（computed 必须同步）。

### 5. 消息标记格式

`{cloud:N}` — 使用花括号包裹 + 索引编号。`cloudRefs` 数组按索引对应，避免同名文件歧义。文本可读性不影响（标记只在 payload 中）。

### 6. 适用范围

DM + 频道均支持，不设 `isChannel()` 守卫。云资源是团队级共享资源，私聊中引用同样合理。

## Risks / Trade-offs

**[文件名重复]** → 同名文件在不同目录下会导致匹配歧义 → 使用 `{cloud:N}` 索引格式 + `cloudRefs` 数组按索引对应，彻底消除歧义。

**[大量 cloud refs 的校验开销]** → 单条消息可能有多个引用 → 批量接口 `POST /api/cloud/validate` 一次校验所有路径，BubbleContent 缓存校验结果避免重复请求。

**[搜索结果过多]** → 后端搜索返回过多结果 → API 限制返回数量（max 20 条），前端弹窗最多显示 20 个结果。
