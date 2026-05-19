## ADDED Requirements

### Requirement: List stickers command
系统 SHALL 提供 Tauri invoke 命令 `list_stickers(userId)`，读取 `~/.envoy/stickers/{userId}/` 目录下的文件列表，返回 `[{ name: string, path: string }]` 数组。仅列出图片文件（png/jpg/jpeg/gif/webp）。目录不存在时返回空数组并自动创建目录。

#### Scenario: 列出已有贴纸
- **WHEN** 调用 `list_stickers("alice")` 且 stickers/alice/ 目录包含 3 个图片文件
- **THEN** 返回包含 3 个元素的数组，每个元素包含 name 和 path

#### Scenario: 目录不存在
- **WHEN** 调用 `list_stickers("alice")` 且 stickers/alice/ 目录不存在
- **THEN** 自动创建目录，返回空数组

#### Scenario: 过滤非图片文件
- **WHEN** stickers 目录包含 .txt 和 .png 文件
- **THEN** 仅返回 .png 文件信息，忽略 .txt 文件

### Requirement: Add sticker command
系统 SHALL 提供 Tauri invoke 命令 `add_sticker(userId, srcPath)`，将源文件复制到 `~/.envoy/stickers/{userId}/` 目录，以 `{timestamp}.{ext}` 命名。返回新文件信息 `{ name, path }`。文件大小超过 1MB 时返回错误。

#### Scenario: 成功添加贴纸
- **WHEN** 调用 `add_sticker("alice", "/path/to/cat.png")` 且文件为 500KB
- **THEN** 文件被复制为 `1716000000000.png`，返回 `{ name: "1716000000000.png", path: "~/.envoy/stickers/alice/1716000000000.png" }`

#### Scenario: 文件过大
- **WHEN** 调用 `add_sticker("alice", "/path/to/big.png")` 且文件为 5MB
- **THEN** 返回错误 "Sticker file too large (max 1MB)"

### Requirement: Delete sticker command
系统 SHALL 提供 Tauri invoke 命令 `delete_sticker(userId, name)`，从 `~/.envoy/stickers/{userId}/` 目录删除指定文件。文件不存在时返回错误。

#### Scenario: 成功删除贴纸
- **WHEN** 调用 `delete_sticker("alice", "1716000000000.png")` 且文件存在
- **THEN** 文件被删除

#### Scenario: 文件不存在
- **WHEN** 调用 `delete_sticker("alice", "nonexist.png")` 且文件不存在
- **THEN** 返回错误 "Sticker file not found"
