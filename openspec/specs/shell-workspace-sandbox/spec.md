## ADDED Requirements

### Requirement: Shell 命令 cd 路径校验

shell_exec 执行前 SHALL 对命令中的 cd 操作进行路径校验。将命令按 `&&`、`||`、`|`、`;` 分割为片段，对每个片段检测 cd 目标路径。目标路径 canonicalize 后 MUST 以 workspace 绝对路径为前缀，否则 SHALL 拒绝执行并返回错误。

#### Scenario: cd 到 workspace 内的子目录
- **WHEN** 命令为 `cd src && npm test`，workspace 为 `/home/bob/.envoy/workspace/bob`
- **THEN** 解析 cd 目标为 `/home/bob/.envoy/workspace/bob/src`，在 workspace 内，允许执行

#### Scenario: cd 跳出 workspace
- **WHEN** 命令为 `cd ../.. && rm -rf something`，workspace 为 `/home/bob/.envoy/workspace/bob`
- **THEN** 解析 cd 目标为 `/home/bob/.envoy`，不在 workspace 内，返回错误 "Command rejected: cd target escapes workspace"

#### Scenario: cd 到绝对路径
- **WHEN** 命令为 `cd /etc && cat passwd`，workspace 为 `/home/bob/.envoy/workspace/bob`
- **THEN** cd 目标 `/etc` 不以 workspace 为前缀，返回错误

#### Scenario: cd 到 home 目录
- **WHEN** 命令为 `cd ~ && ls`，workspace 为 `/home/bob/.envoy/workspace/bob`
- **THEN** cd 目标解析为 `/home/bob`，不在 workspace 内，返回错误

#### Scenario: 无 cd 的命令
- **WHEN** 命令为 `npm install && npm run build`
- **THEN** 不含 cd 操作，直接在 workspace 下执行

### Requirement: Shell 命令 CWD 强制设定

shell_exec SHALL 在执行前将 CWD 强制设为 workspace 绝对路径（已 canonicalize）。即使命令不含 cd，SHALL 也在命令前 prepend `cd /d {workspace} &&`（Windows）或 `cd {workspace} &&`（Unix）。

#### Scenario: 命令在 workspace 下执行
- **WHEN** shell_exec 收到命令 `ls -la`，workspace 为 `C:\Users\bob\.envoy\workspace\bob`
- **THEN** 实际执行 `cd /d C:\Users\bob\.envoy\workspace\bob && ls -la`

### Requirement: 文件读取路径校验

file_read 在读取前 SHALL 对请求路径 canonicalize，并检查结果是否以 workspace 绝对路径为前缀。超出 workspace 的路径 SHALL 返回错误。

#### Scenario: 读取 workspace 内文件
- **WHEN** file_read 请求路径 `~/project/src/index.ts`，解析后在 workspace 内
- **THEN** 允许读取，返回文件内容

#### Scenario: 读取 workspace 外文件
- **WHEN** file_read 请求路径 `/etc/passwd`
- **THEN** 返回错误 "Path outside workspace"

### Requirement: 文件写入路径校验

file_write 在写入前 SHALL 对请求路径 canonicalize，并检查结果是否以 workspace 绝对路径为前缀。超出 workspace 的路径 SHALL 返回错误。

#### Scenario: 写入 workspace 内文件
- **WHEN** file_write 请求路径 `~/project/output.txt`，解析后在 workspace 内
- **THEN** 允许写入

#### Scenario: 写入 workspace 外文件
- **WHEN** file_write 请求路径 `/etc/malicious.conf`
- **THEN** 返回错误 "Path outside workspace"

### Requirement: 自定义工作目录支持

shell_exec SHALL 支持通过 working_dir 参数接收用户自定义的工作目录。当 settings.yml 中 `users.{username}.working_directory` 非空时，SHALL 使用该值作为 workspace。为空时使用默认 `~/.envoy/workspace/{username}`。

#### Scenario: 自定义工作目录生效
- **WHEN** 用户设置了工作目录为 `/home/bob/projects`
- **THEN** shell_exec 的 workspace 使用 `/home/bob/projects`，所有沙箱校验基于此路径

#### Scenario: 默认工作目录
- **WHEN** 用户未设置工作目录
- **THEN** shell_exec 的 workspace 使用 `~/.envoy/workspace/{username}`
