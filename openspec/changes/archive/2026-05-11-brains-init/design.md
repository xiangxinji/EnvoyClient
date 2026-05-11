## Context

EnvoyClient 目前在 `~/.envoy/` 下存储聊天记录（`history/`）和本地设置（`settings.json`），但没有按用户隔离的结构化知识存储。项目需要为每个用户提供独立的 brains 目录，用于 AI 记忆、偏好、日志和技能模板。

现有文件操作模式：Rust 侧通过 `dirs::home_dir()` 定位 `~/.envoy/`，文件 IO 使用 `std::fs`。前端通过 Tauri invoke 调用 Rust 命令，已有通用 `file_read`/`file_write` 命令可复用。

## Goals / Non-Goals

**Goals:**
- 用户登录后自动创建 `~/.envoy/brains/{username}/` 目录结构
- 增量合并模板：只补充不存在的文件，保留用户修改和自建文件
- 幂等：多次调用安全无副作用
- 前端通过现有命令读写 brains 内容

**Non-Goals:**
- 不做版本跟踪（无 .version 文件）
- 不做 brains 内容的删除或覆盖
- 不做 brains 内容的同步/云备份
- 不做 brains 专用读写命令（复用 file_read/file_write）

## Decisions

### 1. 模板打包方式：bundle.resources

**选择**: 在 `tauri.conf.json` 中配置 `bundle.resources: ["brains/**"]`

**替代方案**: 使用 `include_dir!` 宏编译期嵌入

**理由**: `bundle.resources` 是 Tauri 标准方式，无需额外依赖，dev/build 模式下路径自动适配。`include_dir!` 需要额外 crate 依赖，对本场景过于复杂。

### 2. 初始化时机：前端 invoke

**选择**: 前端 `handleLogin` 成功后调用 `invoke("init_brains", { username })`

**替代方案**: Tauri `setup` 钩子在启动时自动执行

**理由**: brains 目录按用户名隔离，需要等登录后拿到 username。setup 钩子执行时还没有用户信息。

### 3. 合并策略：只增不删不覆盖

**选择**: 遍历模板文件，目标不存在则复制，存在则跳过

**理由**: 用户可能自定义修改 brains 内容（如编辑偏好文件），不应被覆盖。新增模板文件（app 升级）会自动补充。

### 4. 读写方式：复用现有命令

**选择**: 前端通过 `init_brains` 获取 brains 根路径，然后用 `file_read`/`file_write` 拼接路径读写

**理由**: 避免引入 brains 专用读写命令，减少重复代码。路径由 `init_brains` 返回，前端自行拼接相对路径。

## Risks / Trade-offs

- **[中文路径]** 模板目录含中文文件名（`基础信息.md`、`偏好/`、`日志/`），Rust `std::fs` 在 Windows 上可正常处理，无风险。
- **[路径安全]** 复用 `file_read`/`file_write` 意味着前端可读写任意路径。现有代码已有此特性，不在本次范围内解决。
- **[空目录跟踪]** Git 不跟踪空目录，需要 `.gitkeep` 文件占位。合并时 `.gitkeep` 也会被复制，不影响功能。
- **[资源路径定位]** dev 模式下 resource_dir 指向 `src-tauri/`，build 后指向安装包资源目录。需确保路径解析正确。
