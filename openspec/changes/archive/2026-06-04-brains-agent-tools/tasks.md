## 1. 新增 brainsService

- [x] 1.1 创建 `src/agent/services/brainsService.ts`，使用 `defineService` 定义包含 `list_brains_files`、`read_brains_file`、`list_logs`、`read_log` 四个操作的服务
- [x] 1.2 实现 `list_brains_files`：调用 `scan_brains_files`，过滤掉 `raw/日志/` 前缀路径，返回文件列表
- [x] 1.3 实现 `read_brains_file`：调用 `read_brains_file` Tauri 命令，base64 解码为明文，拒绝 `raw/日志/` 前缀路径
- [x] 1.4 实现 `list_logs`：调用 `scan_brains_files`，仅保留 `raw/日志/` 前缀路径，返回文件列表
- [x] 1.5 实现 `read_log`：调用 `read_brains_file` Tauri 命令，base64 解码为明文，仅允许 `raw/日志/` 前缀路径

## 2. 注册到所有 Agent

- [x] 2.1 修改 `src/agent/agents/planner.ts`：import brainsService 并通过 `toTools` 注册
- [x] 2.2 修改 `src/agent/agents/executor.ts`：import brainsService 并通过 `toTools` 注册
- [x] 2.3 修改 `src/agent/agents/reviewer.ts`：import brainsService 并通过 `toTools` 注册
