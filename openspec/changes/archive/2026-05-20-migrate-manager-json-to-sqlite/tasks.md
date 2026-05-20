## 1. Manager DB 模块

- [x] 1.1 创建 `manager/server/manager-db.ts`：DB 初始化函数 `initManagerDB()`，创建 `~/.envoy/manager/db/manager.db`，建表（admin, ai_presets, ai_scenes, users），WAL 模式，首次启动插入默认 admin 账号
- [x] 1.2 在 `manager-db.ts` 中实现 admin 表 CRUD：`getAdminConfig()`、`updateAdmin()`、`verifyAdmin()`
- [x] 1.3 在 `manager-db.ts` 中实现 ai_presets 表 CRUD：`listPresets()`、`getPreset()`、`getDefaultPreset()`、`createPreset()`、`updatePreset()`、`deletePreset()`、`setDefaultPreset()`
- [x] 1.4 在 `manager-db.ts` 中实现 ai_scenes 表 CRUD：`listScenes()`、`updateScenes()`
- [x] 1.5 在 `manager-db.ts` 中实现 users 表 CRUD：`listUsers()`、`upsertUser()`、`deleteUser()`、`authenticateUser()`

## 2. 重写 settings.ts

- [x] 2.1 重写 `settings.ts`：移除 JSON 文件读写和内存缓存，改为调用 `manager-db.ts` 中的函数
- [x] 2.2 移除 `loadSettings()`/`saveSettings()` 函数和 legacy AI 迁移逻辑
- [x] 2.3 保留并适配 `resolveForScene()`：改为查询 DB 获取 scene config 和 preset
- [x] 2.4 确保 `initSettings()` 仅保留必要的初始化逻辑（如 DB 已在启动时初始化则可简化为空操作）

## 3. 重写 user-registry.ts

- [x] 3.1 重写 `user-registry.ts`：移除 JSON 文件读写，改为调用 `manager-db.ts` 中的 users CRUD 函数
- [x] 3.2 `loadUsers()` 改为调用 `listUsers()`，`saveUsers()` 拆分为 `upsertUser()`/`deleteUser()` 调用
- [x] 3.3 `authenticate()` 改为调用 `authenticateUser()` 直接查 DB

## 4. 更新启动流程

- [x] 4.1 更新 `index.ts`：在 crypto 初始化之前调用 `initManagerDB()`
- [x] 4.2 移除 `initSettings()` 调用（或保留为空操作），确保启动顺序正确

## 5. 路由层适配

- [x] 5.1 检查 `routes/users.ts`：确认 `loadUsers()`/`saveUsers()` 签名变更后的兼容性，适配新的单用户操作模式
- [x] 5.2 检查 `routes/ai.ts`：确认 settings.ts 的导出函数签名变更后的兼容性
- [x] 5.3 检查 `routes/teams.ts`：确认用户查询方式变更后的兼容性
