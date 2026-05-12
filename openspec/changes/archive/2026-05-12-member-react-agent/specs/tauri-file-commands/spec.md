## ADDED Requirements

### Requirement: File Read Command

Tauri SHALL 提供 `file_read` invoke command，允许前端读取本地文件内容。

#### Scenario: 读取 home 目录下的文件
- **WHEN** 前端调用 `invoke("file_read", { path: "~/project/config.json" })`
- **THEN** Tauri SHALL 解析 `~` 为用户 home 目录，读取文件内容并返回 `{ content: string }`

#### Scenario: 读取绝对路径文件
- **WHEN** 前端调用 `invoke("file_read", { path: "C:\\Users\\user\\file.txt" })` 且路径在用户 home 目录内
- **THEN** Tauri SHALL 读取并返回文件内容

#### Scenario: 路径在 home 目录外
- **WHEN** 前端调用 `invoke("file_read", { path: "/etc/shadow" })`
- **THEN** Tauri SHALL 拒绝操作并返回错误 `{ error: "Path outside allowed directory" }`

#### Scenario: 文件不存在
- **WHEN** 前端调用 `invoke("file_read", { path: "~/nonexistent.txt" })`
- **THEN** Tauri SHALL 返回 `{ error: "File not found" }`

#### Scenario: 文件为二进制
- **WHEN** 前端调用 `invoke("file_read", { path: "~/image.png" })`
- **THEN** Tauri SHALL 返回 `{ error: "Cannot read binary file" }` 或截断为空字符串

### Requirement: File Write Command

Tauri SHALL 提供 `file_write` invoke command，允许前端写入本地文件。

#### Scenario: 写入新文件
- **WHEN** 前端调用 `invoke("file_write", { path: "~/output.txt", content: "hello" })` 且路径在 home 目录内
- **THEN** Tauri SHALL 创建文件并写入内容，返回 `{ success: true }`

#### Scenario: 覆盖已存在文件
- **WHEN** 前端调用 `invoke("file_write", { path: "~/output.txt", content: "updated" })` 且文件已存在
- **THEN** Tauri SHALL 覆盖文件内容，返回 `{ success: true }`

#### Scenario: 路径在 home 目录外
- **WHEN** 前端调用 `invoke("file_write", { path: "/etc/passwd", content: "..." })`
- **THEN** Tauri SHALL 拒绝操作并返回 `{ error: "Path outside allowed directory" }`

#### Scenario: 父目录不存在
- **WHEN** 前端调用 `invoke("file_write", { path: "~/new_dir/output.txt", content: "..." })` 且 `new_dir` 不存在
- **THEN** Tauri SHALL 自动创建父目录后写入文件

### Requirement: 路径安全检查

`file_read` 和 `file_write` SHALL 对所有传入的路径做安全检查，确保最终解析后的绝对路径在用户 home 目录内。

#### Scenario: 路径遍历攻击防护
- **WHEN** 前端调用 `invoke("file_read", { path: "~/../../etc/shadow" })`
- **THEN** Tauri SHALL 解析 `..` 后检测到路径在 home 外，拒绝操作

#### Scenario: 符号链接指向 home 外
- **WHEN** `~/link` 是指向 `/etc` 的符号链接
- **THEN** Tauri SHALL 解析符号链接后检测到路径在 home 外，拒绝操作
