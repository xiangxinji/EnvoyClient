# 优化报告目录

## 高优先级（安全/正确性）

| 编号 | 问题 | 文件 |
|------|------|------|
| 01 | AI 路由无认证保护 | [high/01-ai-route-auth.md](high/01-ai-route-auth.md) |
| 02 | shell_exec 命令注入风险 | [high/02-shell-exec-injection.md](high/02-shell-exec-injection.md) |
| 03 | file_read/write 沙箱范围过大 | [high/03-file-sandbox-scope.md](high/03-file-sandbox-scope.md) |
| 04 | export_history 路径无校验 | [high/04-export-path-validation.md](high/04-export-path-validation.md) |

## 中优先级（代码质量/性能）

| 编号 | 问题 | 文件 |
|------|------|------|
| 05 | useTeamClient 职责过重 | [medium/05-useteamclient-split.md](medium/05-useteamclient-split.md) |
| 06 | 大量 any 类型 | [medium/06-typescript-any-cleanup.md](medium/06-typescript-any-cleanup.md) |
| 07 | AI 函数结构重复 | [medium/07-ai-functions-dedup.md](medium/07-ai-functions-dedup.md) |
| 08 | isTauri/safeInvoke 重复定义 | [medium/08-istauri-dedup.md](medium/08-istauri-dedup.md) |
| 09 | 消息存储响应式开销大 | [medium/09-message-shallow-ref.md](medium/09-message-shallow-ref.md) |
| 10 | taskCount 遍历性能差 | [medium/10-taskcount-performance.md](medium/10-taskcount-performance.md) |
| 11 | AI Provider 每次创建新实例 | [medium/11-provider-instance-cache.md](medium/11-provider-instance-cache.md) |
| 12 | 团队路由校验代码重复 | [medium/12-team-route-middleware.md](medium/12-team-route-middleware.md) |
| 13 | Session 无持久化和清理 | [medium/13-session-management.md](medium/13-session-management.md) |
| 19 | App.vue 代码规范整改 | [medium/19-app-vue-code-review.md](medium/19-app-vue-code-review.md) |

## 低优先级（锦上添花）

| 编号 | 问题 | 文件 |
|------|------|------|
| 14 | ChatPanel 组件过大 | [low/14-chatpanel-split.md](low/14-chatpanel-split.md) |
| 15 | file_read 双倍 IO | [low/15-file-read-double-io.md](low/15-file-read-double-io.md) |
| 16 | loadRegistry 频繁磁盘扫描 | [low/16-registry-cache.md](low/16-registry-cache.md) |
| 17 | RSA 私钥无文件权限保护 | [low/17-rsa-key-permission.md](low/17-rsa-key-permission.md) |
| 18 | 历史消息全量读写 | [low/18-history-append-format.md](low/18-history-append-format.md) |
