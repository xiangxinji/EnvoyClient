# EnvoyClient 代码审查报告

> 审查日期: 2026-05-11
> 审查范围: 全仓库核心代码

---

## 严重程度说明

- **P0 - 安全漏洞**: 可能被直接利用，需优先修复
- **P1 - 架构风险**: 不影响当前功能，但会在规模增长或暴露公网时引发问题
- **P2 - 可维护性**: 代码质量和工程化改进建议

---

## P0 - 安全漏洞

### 1. `shell_exec` 命令注入 — 无校验无确认

**文件**: `src-tauri/src/lib.rs:45-58`

Leader 向 Member 分派任务时，Member 端直接通过 `shell_exec` 执行任务内容，没有任何限制：

```rust
fn shell_exec(command: String) -> Result<serde_json::Value, String> {
    Command::new("cmd").args(["/C", &command]).output()
}
```

**风险**: 恶意 Leader 可以让 Member 执行任意命令（`rm -rf`、读取密钥、反弹 shell 等）。

**修复方向**:
- [ ] Member 端收到任务时弹窗确认，展示将要执行的完整命令
- [ ] 实现命令白名单（只允许特定前缀或工具）
- [ ] 沙箱执行（Docker 容器 / 受限用户权限）
- [ ] 至少在 TaskCard UI 上清晰显示 "将执行命令: xxx"

---

### 2. `file_read` / `file_write` — 任意路径读写

**文件**: `src-tauri/src/lib.rs:61-74`

前端可读写文件系统上任意路径，无路径限制：

```rust
fn file_read(path: String) -> Result<serde_json::Value, String> {
    let content = std::fs::read_to_string(&path)
fn file_write(path: String, content: String) -> Result<serde_json::Value, String> {
    std::fs::write(&path, &content)
```

**风险**: 若前端存在 XSS（Markdown 渲染使用 `marked` + `dompurify`），攻击者可读取 `~/.envoy/keys/private.pem`（RSA 私钥）或 `~/.ssh/id_rsa` 等敏感文件。

**修复方向**:
- [ ] 通过 Tauri 2 capabilities 限制可访问的路径范围
- [ ] 实现路径白名单（只允许 `~/.envoy/` 目录）
- [ ] 审计 `dompurify` 配置确保 XSS 防护到位
- [ ] 评估 `file_read`/`file_write` 是否真的需要暴露给前端

---

### 3. Manager API 大部分路由无认证

**文件**: `manager/server/routes/` 下除 `admin.ts` 外的所有路由

`admin.ts` 有 session 验证，但以下路由**完全开放**：

| 路由 | 风险 |
|------|------|
| `GET /api/teams` | 查看所有团队信息 |
| `POST /api/teams` | 创建团队 |
| `DELETE /api/teams/:name` | 删除团队 |
| `GET /api/teams/:name/members` | 查看成员列表 |
| `GET /api/teams/:name/tasks` | 查看所有任务 |
| `GET /api/users` | 查看所有用户信息 |
| `POST /api/users` | 创建用户 |
| `DELETE /api/users/:id` | 删除用户 |
| `PUT /api/ai/config` | 修改 AI 配置（可窃取 API key） |
| `GET /api/ai/config` | 获取 AI 配置（含 API key 信息） |
| `POST /api/ai/chat/stream` | 消耗 AI API 额度 |

**修复方向**:
- [ ] 添加认证中间件，所有 `/api/*` 路由要求 Bearer token
- [ ] `ai.ts` 的 `config` 接口脱敏（不返回完整 API key）
- [ ] 考虑 CORS 策略收紧（当前 `cors()` 允许所有来源）

---

## P1 - 架构风险

### 4. 历史消息写入 — 全量重写

**文件**: `src-tauri/src/history.rs:17-36`

每条消息的保存流程：读取全量 JSON → 解析为 Vec → 追加 → 序列化 → 写回文件。

```rust
let mut messages: Vec<serde_json::Value> = /* 读全量 */;
messages.push(message);
let json = serde_json::to_string_pretty(&messages)?;
fs::write(&path, json)?;
```

**风险**: 对话超过几百条后，每次发消息的 IO 开销会明显增加。高并发时可能出现写入竞争。

**修复方向**:
- [ ] 改为 append-only 写入（每行一条 JSON，类似 JSONL）
- [ ] 或引入 SQLite（`~/.envoy/history.db`）做结构化存储
- [ ] 加文件锁防止并发写入冲突

---

### 5. 会话状态全在内存

**文件**: `manager/server/routes/admin.ts:7`

```typescript
const sessions = new Map<string, { createdAt: number }>();
```

**现象**:
- Manager 进程重启后所有 admin session 丢失
- `teamInstances` Map 在内存中，重启需 `restoreTeams()` 恢复
- WebSocket 连接断开后客户端需自动重连（已实现 reconnecting，OK）

**修复方向**:
- [ ] 单实例部署无问题，记录即可
- [ ] 如需多实例/HA，考虑 Redis 存储 session + 共享 Team 状态

---

### 6. JSON 文件持久化的并发安全

**文件**: `manager/server/team-registry.ts`, `user-registry.ts`

`teams.json` 和 `users.json` 在每次请求时读写，无文件锁。

**风险**: 并发请求（如同时创建两个团队）可能导致数据丢失或文件损坏。

**修复方向**:
- [ ] 添加文件锁（如 `proper-lockfile`）
- [ ] 或迁移到 SQLite

---

## P2 - 可维护性

### 7. 依赖管理 — 无 workspace

**现象**: 项目有 4 个独立的 `package-lock.json`（根目录、ai-layer、manager/server、manager/web）。

**影响**:
- 依赖重复安装
- 版本可能不一致（多个版本的 hono、vue 等）
- 构建脚本复杂度增加

**修复方向**:
- [ ] 引入 pnpm workspace 或 npm workspace
- [ ] 统一共享依赖版本（vue、hono 等）

---

### 8. 无测试覆盖

**现象**: 全仓库无任何测试文件。

**优先建议**:
- [ ] ai-layer 的 SSE 解析器 — 逻辑独立，易于单测
- [ ] Manager API 路由 — 用 Hono 的 test harness
- [ ] Rust history 模块 — 单元测试
- [ ] useTeamClient 的消息处理逻辑

---

### 9. SSE 解析器边界情况

**文件**: `src/composables/useAI.ts:68-80`

自建的 SSE 解析器处理了基本场景，但可能遗漏：
- 多行 `data:` 字段（标准 SSE 允许）
- `data:` 后无空格的情况
- 非 JSON 的 data 内容

```typescript
function parseSSE(raw: string): { event: string; data: any } | null {
  for (const line of raw.split("\n")) {
    if (line.startsWith("event: ")) event = line.slice(7).trim();
    else if (line.startsWith("data: ")) dataStr = line.slice(6);
  }
}
```

**修复方向**:
- [ ] 补充边界测试
- [ ] 或使用成熟的 SSE 解析库（如 `eventsource-parser`）

---

### 10. RSA 加密用于密码传输 — 非标准做法

**文件**: `manager/server/crypto.ts`, `manager/server/routes/admin.ts`

当前方案：前端用 RSA 公钥加密密码 → 传输 → 后端私钥解密 → bcrypt 比较。

**现象**: 这不是常见的认证模式。通常做法是 HTTPS 提供传输加密 + 服务端 bcrypt/argon2 哈希验证。RSA 加密密码增加了复杂度但没有提供额外安全收益（如果已经有 HTTPS 的话是多余的，如果没有 HTTPS 则 RSA 公钥暴露在 HTTP 下可被中间人替换）。

**修复方向**:
- [ ] 确保全程 HTTPS（开发环境可用自签证书）
- [ ] 如已有 HTTPS，可简化为明文传输 + 服务端哈希验证
- [ ] 如无 HTTPS，考虑 SRP（Secure Remote Password）协议

---

## 修复优先级建议

| 优先级 | 编号 | 工作量 | 建议 |
|--------|------|--------|------|
| 立即 | #3 API 认证 | 中 | 添加中间件，影响面可控 |
| 立即 | #2 文件路径限制 | 小 | Tauri capabilities 配置 |
| 短期 | #1 shell_exec 安全 | 中 | 至少加确认弹窗 |
| 短期 | #4 历史写入优化 | 中 | append-only 或 SQLite |
| 中期 | #6 并发安全 | 小 | 文件锁 |
| 中期 | #7 workspace | 小 | 配置调整 |
| 长期 | #8 测试覆盖 | 大 | 逐步补全 |
| 长期 | #5 分布式状态 | 大 | 架构变更，按需 |
