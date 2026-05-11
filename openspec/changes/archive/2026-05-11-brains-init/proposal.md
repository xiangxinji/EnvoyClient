## Why

项目需要为每个用户提供独立的 AI 记忆/知识空间（brains），用于存储偏好、基础信息、日志和技能模板。目前用户目录下仅有 `history/` 和 `settings.json`，缺少按用户隔离的结构化知识存储。首次登录时需要自动初始化该空间。

## What Changes

- 新增 `src-tauri/brains/` 模板目录，包含初始目录结构（raw/基础信息.md、raw/偏好/、raw/日志/、skills/）
- 新增 Tauri 命令 `init_brains(username)`：将模板增量合并到 `~/.envoy/brains/{username}/`
- 在 `tauri.conf.json` 中通过 `bundle.resources` 将模板目录打包
- 前端 `RoleSelect.vue` 登录成功后调用 `init_brains`
- 复用现有 `file_read` / `file_write` 命令读写 brains 内容

## Capabilities

### New Capabilities
- `brains-init`: 用户登录后自动初始化个人 brains 目录，支持增量合并（只增不删不覆盖），幂等安全

### Modified Capabilities
<!-- 无现有 spec 需要修改 -->

## Impact

- **Rust 后端**: 新增 `brains.rs` 模块，修改 `lib.rs` 注册命令，修改 `Cargo.toml`（如需新依赖）
- **Tauri 配置**: `tauri.conf.json` 增加 `bundle.resources` 配置
- **前端**: `RoleSelect.vue` 在 `handleLogin` 成功后新增 invoke 调用
- **模板文件**: `src-tauri/brains/` 下的空目录需要 `.gitkeep` 以被 git 跟踪
- **文件系统**: 在 `~/.envoy/brains/{username}/` 下创建用户专属目录结构
