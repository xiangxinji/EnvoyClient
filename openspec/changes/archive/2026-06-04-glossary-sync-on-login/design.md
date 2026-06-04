## Context

词汇表系统已有完整的服务端 CRUD（全局 + 团队两级 SQLite）和 Agent 工具（`query_glossary` 通过 API 实时查询）。现在需要将词汇数据在加入团队时同步到本地知识库目录 `~/.envoy/brains/{user}/glossary/`，使数据持久化于本地。

现有参考模式：
- `useBrainsSync`：团队连接后在 connected 事件中触发，通过 Tauri invoke 操作本地文件
- `init_brains` Tauri 命令：登录时创建 `~/.envoy/brains/{user}/` 目录结构
- `file_write` Tauri 命令：沙箱内写文件，自动创建父目录

## Goals / Non-Goals

**Goals:**
- 加入团队时自动将合并后的词汇表（全局+团队）写入 `~/.envoy/brains/{user}/glossary/system.md`
- 首次创建空的 `glossary/personal.md`（带 YAML frontmatter）
- 切换团队时仅重新同步 system.md，不碰 personal.md
- 移除 `query_glossary` Agent 工具及其所有引用

**Non-Goals:**
- Agent 如何消费本地词汇文件（后续再定）
- 个人词汇编辑 UI（后续评估系统）
- 增量同步或版本管理（全量覆盖即可）
- 非加入团队时的增量同步触发

## Decisions

### 1. 新增 composable vs 内联在 useTeamClient

**选择**：新增 `useGlossarySync` composable

**理由**：与 `useBrainsSync` 模式一致，职责分离。useTeamClient 只负责在 connected 事件中调用。

### 2. 文件写入方式

**选择**：使用现有 `file_write` Tauri 命令

**理由**：`file_write` 已支持路径 `~/glossary/system.md`（相对于 `~/.envoy/` 沙箱），自动创建父目录。无需新增 Tauri 命令。

**替代方案**：新增专用 Tauri 命令 — 过度设计，file_write 已满足需求。

### 3. 文件格式：Markdown 带标题

**选择**：每个条目用 `## 术语名` 作为标题，定义作为正文段落

**理由**：与 skills 目录的 Markdown 格式一致，Agent 可读性好，也方便人工编辑 personal.md。

### 4. 集成点：useTeamClient connected 事件

**选择**：在 `useTeamClient.ts` 的 `conn.client.on("connected", ...)` 回调中，与 brainsSync 并列调用

**理由**：connected 事件是团队连接生命周期管理点，此时 teamName 和 myId 都已确定。与 brainsSync.setupTriggers() 同级，模式统一。

### 5. 同步时机细节

**选择**：先调用 API 获取数据，再转换写入。API 调用失败时静默跳过（不阻塞连接流程）

**理由**：词汇同步是增强功能，不应影响核心连接流程。与 brainsSync 的容错模式一致。

## Risks / Trade-offs

- [词汇表可能很大] → 当前 API 返回所有条目，Markdown 转换无分页。实际上词汇表通常几十到几百条，不会造成性能问题。
- [API 调用失败] → 静默失败，不阻塞连接。用户下次切换团队或重连时会重新同步。
- [personal.md 被误覆盖] → 代码中必须检查文件已存在则跳过，绝不覆盖。
