## Context

Manager 后端当前使用两个 JSON 文件存储全局配置：

- `~/.envoy/manager.json` — admin 账号 + AI presets/scenes 配置（`settings.ts` 管理）
- `~/.envoy/users.json` — 用户列表（`user-registry.ts` 管理）

两个模块都采用 read-modify-write 全量文件的方式，每次变更重写整个 JSON。团队级数据（messages、tasks、cloud_files）已使用 per-team SQLite（`db.ts`），本次迁移将全局配置也统一到 SQLite。

## Goals / Non-Goals

**Goals:**
- 将 `manager.json` 和 `users.json` 的数据迁移到 `~/.envoy/manager/db/manager.db`
- 所有 CRUD 操作直接查 DB，无内存缓存
- 保持所有 HTTP API 接口不变，仅替换存储层
- DB 初始化在启动流程中最早完成

**Non-Goals:**
- 不迁移 RSA 密钥（保留 PEM 文件）
- 不迁移 Teams 元数据（保留 `meta.json`）
- 不提供旧 JSON 数据自动迁移
- 不修改 per-team `team.db` 的任何逻辑

## Decisions

### 1. 单 DB + 多表 vs 多 DB

**选择：单 DB `manager.db`，四张表**

`admin`、`ai_presets`、`ai_scenes`、`users` 数据量小、关联紧密（scenes 引用 presets），放在一个 DB 里便于事务操作（如删除 preset 时检查 scene 绑定）。

### 2. 内存缓存 vs 全 DB 查询

**选择：全 DB 查询，无内存缓存**

配置数据量极小（几个 preset、几个 scene、几十个用户），SQLite + WAL 查询耗时微秒级。AI 推理本身耗时数十秒，多一次 DB 查询可忽略。代码更简单，避免缓存一致性问题。

### 3. DB 模块组织

**选择：新建 `manager-db.ts` 模块**

将 DB 初始化、表创建、admin/users/presets/scenes 的 SQL 操作集中在一个文件中。与 per-team 的 `db.ts` 职责分离。`settings.ts` 和 `user-registry.ts` 改为调用 `manager-db.ts` 的函数。

### 4. 首次启动默认数据

**选择：DB 初始化时检查 admin 表，为空则插入默认 admin 账号**

与当前行为一致：首次启动创建 `admin/admin123`。

### 5. legacy AI 配置迁移

**选择：不再处理**

当前 `settings.ts` 有从旧版单 provider 格式迁移到 presets 的逻辑。迁移到 DB 后，旧 `manager.json` 不再读取，该迁移逻辑自然废弃。如果用户需要旧配置，可手动在 Manager UI 重新配置。

## Risks / Trade-offs

- **[旧配置丢失]** 用户已有的 AI presets 和用户数据在切换后不可用 → 不做自动迁移，用户需在 Manager UI 重新配置。Manager UI 本身有完整的 CRUD 界面。
- **[DB 文件损坏]** SQLite 单文件损坏风险 → WAL 模式 + better-sqlite3 的可靠性已在 per-team DB 中验证。
- **[启动顺序]** DB 必须在 crypto/settings 之前初始化 → 在 `index.ts` 中将 `initManagerDB()` 放在最前面。
