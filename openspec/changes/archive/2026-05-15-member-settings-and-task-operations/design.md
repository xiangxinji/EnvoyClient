## Context

EnvoyClient 的 Member 端目前缺少三个能力：
1. 成员级个人设置（工作目录、任务执行模式）
2. 任务卡片的手动操作入口（开始/上传/完成）
3. Shell 命令执行的 workspace 沙箱

当前 Agent 工作目录硬编码为 `~/.envoy/workspace/{username}`，任务到达后无条件启动 Agent，任务卡片无操作按钮，shell_exec 只设 CWD 不做逃逸校验。

## Goals / Non-Goals

**Goals:**
- 成员可在侧边栏底部进入设置页面，配置工作目录和任务执行模式
- 任务卡片提供开始执行、上传文件、标记完成的手动操作按钮
- manual 模式下任务不自动启动 Agent，由成员手动处理
- Rust 侧 shell_exec 和 file_read/file_write 强制 workspace 沙箱

**Non-Goals:**
- 不做 Agent 执行过程的实时干预（暂停/取消正在运行的 Agent）
- 不做"半自动"模式（N 秒后自动启动等），只做 manual/auto 二选一
- 不修改 Envoy 框架的任务调度核心逻辑（serial/parallel 行为不变）

## Decisions

### D1: 设置页面用侧边栏内伪路由，不用 vue-router

侧边栏已有的 `__tasks__` 和 `__dispatch__` 伪 ID 模式可直接复用，新增 `__settings__`。右侧内容区根据 `selectedPeer` 值切换渲染 SettingsPanel。无需新增路由定义。

**替代方案**: 新增 `/settings` 子路由。 rejected — 增加路由复杂度，且设置页面是 ChatView 的子功能，不应独立路由。

### D2: 设置存储复用 settings.yml，按 username 嵌套

```yaml
users:
  bob:
    working_directory: ""
    task_execution_mode: "manual"
```

复用已有 `get_settings` / `save_settings` Tauri 命令，不新增文件。空 working_directory 时 fallback 到 `~/.envoy/workspace/{username}`。

**替代方案**: 在 brains/{user}/ 下新建 preferences.json。 rejected — 分散存储，且 brains 目录语义是 Agent 记忆/技能。

### D3: 任务操作按钮纯状态变更，不触发 Agent

开始执行 = pending → running 状态跳转。标记完成 = running → completed 状态跳转 + 提交空结果。上传文件 = 调用已有 /api/tasks/:id/resources。全部是 HTTP API 调用，不启动 Agent 循环。

### D4: Manager 新增 startTask/completeTask 端点

Envoy Server 新增两个方法直接修改任务状态并广播通知。Manager 路由层调用这两个方法。

**替代方案**: 直接修改 task.json 文件。 rejected — 绕过 Envoy 状态管理，不会触发 WebSocket 广播通知其他客户端。

### D5: Shell 沙箱采用命令解析 + canonicalize 校验

1. 将命令按 `&&`、`|`、`;`、`||` 分割为片段
2. 对每个片段正则匹配 `cd <target>`
3. 解析 target 路径（绝对路径直接用，相对路径基于 workspace 解析）
4. canonicalize 后检查是否以 workspace 路径为前缀
5. 超出 workspace 的 cd 返回错误拒绝执行
6. file_read/file_write 同样 canonicalize 后校验前缀

**替代方案**: 用 chroot/Job Object 做进程级沙箱。 rejected — 过度工程化，且跨平台实现复杂。

### D6: task_execution_mode 控制 doing handler 注册

manual 模式：useTaskExecution.registerHandler 仍注册 doing handler，但 handler 内部检查模式——如果是 manual，仅通过 task event 更新任务列表状态，不调用 handleMemberExecution。auto 模式保持现有行为。

## Risks / Trade-offs

- **[命令解析不完美]** → Shell 语法极其灵活（子 shell $()、管道中的 cd），正则无法覆盖所有逃逸路径。缓解：在 AI Agent prompt 中强调必须在 workspace 内操作；命令校验覆盖常见模式（cd ..、cd /abs、cd ~）。
- **[settings.yml 并发写入]** → 多个组件同时保存设置可能覆盖。缓解：设置页面是单入口，用户不会同时操作；保存时先读取最新值再合并写入。
- **[manual 模式下任务可能被遗忘]** → pending 任务停留在列表中无提醒。缓解：后续可加提醒/超时机制，当前版本不做。
