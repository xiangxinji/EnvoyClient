## Why

Manager 后端的全局配置（admin 账号、AI preset/scene、用户列表）目前以 JSON 文件（`manager.json`、`users.json`）存储在 `~/.envoy/` 下。每次写入都是 read-modify-write 全量文件，存在并发写入风险，且与 per-team 已有的 SQLite 存储方式不一致。将这些数据迁移到统一的 SQLite 数据库，可获得事务安全、一致的数据访问模式，并为后续扩展（如配置审计、批量查询）打下基础。

## What Changes

- 新建全局 Manager SQLite 数据库 `~/.envoy/manager/db/manager.db`，包含 `admin`、`ai_presets`、`ai_scenes`、`users` 四张表
- 重写 `settings.ts`：JSON 文件读写替换为 SQLite CRUD，移除内存缓存，所有操作直接查 DB
- 重写 `user-registry.ts`：JSON 文件读写替换为 SQLite CRUD
- 更新 `index.ts` 启动流程：新增 `initManagerDB()` 调用，在 crypto/settings 初始化之前完成 DB 初始化
- 不再读取/写入 `~/.envoy/manager.json` 和 `~/.envoy/users.json`（旧文件保留但不再使用）
- RSA 密钥（`~/.envoy/keys/`）和 Teams 元数据（`~/.envoy/teams/*/meta.json`）不变

## Capabilities

### New Capabilities
- `manager-database`: Manager 全局配置的 SQLite 数据库存储层，管理 admin、AI presets/scenes、users 四张表的初始化和 CRUD

### Modified Capabilities
- `model-preset-management`: 存储后端从 JSON 文件切换到 SQLite ai_presets + ai_scenes 表
- `user-responsibilities`: 用户数据存储后端从 users.json 切换到 SQLite users 表

## Impact

- **代码文件**: `manager/server/settings.ts`（重写）、`manager/server/user-registry.ts`（重写）、`manager/server/index.ts`（启动顺序调整）
- **新文件**: Manager DB 初始化逻辑（可内联到 settings.ts 或独立模块）
- **依赖**: 已有 `better-sqlite3`，无新依赖
- **API 接口**: 无变化，所有 HTTP 路由签名不变，仅底层存储切换
- **磁盘布局**: 新增 `~/.envoy/manager/db/manager.db`，旧的 `manager.json` 和 `users.json` 不再使用
