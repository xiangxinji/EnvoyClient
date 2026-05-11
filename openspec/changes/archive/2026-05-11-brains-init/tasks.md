## 1. 模板目录准备

- [x] 1.1 在 `src-tauri/brains/raw/偏好/`、`raw/日志/`、`skills/` 下添加 `.gitkeep` 文件

## 2. Tauri 配置

- [x] 2.1 在 `src-tauri/tauri.conf.json` 的 `bundle` 中添加 `resources: ["brains/**"]`

## 3. Rust 后端实现

- [x] 3.1 创建 `src-tauri/src/brains.rs` 模块，实现 `init_brains(username)` 函数：通过 `resource_dir()` 定位模板，增量合并到 `~/.envoy/brains/{username}/`，返回 brains 根路径
- [x] 3.2 在 `src-tauri/src/lib.rs` 中注册 `mod brains` 和 `init_brains` 命令

## 4. 前端集成

- [x] 4.1 在 `src/views/RoleSelect.vue` 的 `handleLogin` 认证成功后，调用 `invoke("init_brains", { username })`，使用 `safeInvoke` 兼容浏览器模式
