## ADDED Requirements

### Requirement: StickerInfo type definition
系统 SHALL 定义 `StickerInfo` 接口，包含 `url: string`（上传后的附件 URL）和 `name: string`（贴纸文件名）字段。`ChatMessage` 类型 SHALL 新增可选字段 `sticker?: StickerInfo`。

#### Scenario: ChatMessage 包含 sticker 字段
- **WHEN** 发送贴纸消息
- **THEN** ChatMessage 的 `sticker` 字段包含 `{ url, name }`，`text` 字段为空或占位符，`attachments` 字段为空

#### Scenario: ChatMessage 无 sticker 字段
- **WHEN** 发送普通文本或附件消息
- **THEN** ChatMessage 的 `sticker` 字段为 `undefined`

### Requirement: Sticker local storage
系统 SHALL 在 `~/.envoy/stickers/{userId}/` 目录下存储用户贴纸文件。目录不存在时自动创建。贴纸文件以 `{timestamp}.{ext}` 命名以避免冲突。

#### Scenario: 首次使用自动创建目录
- **WHEN** 用户首次打开贴纸面板且 stickers 目录不存在
- **THEN** 系统自动创建 `~/.envoy/stickers/{userId}/` 目录

#### Scenario: 贴纸文件存储
- **WHEN** 用户选择一张本地图片作为贴纸
- **THEN** 文件被复制到 stickers 目录，命名为 `{timestamp}.{ext}`

### Requirement: Sticker panel UI
系统 SHALL 在聊天工具栏的贴纸按钮上方弹出贴纸选择面板。面板以网格形式（约 5 列）展示所有贴纸缩略图，每格约 64px。底部显示 [+ 添加] 按钮。

#### Scenario: 打开贴纸面板
- **WHEN** 用户点击工具栏的贴纸按钮
- **THEN** 贴纸面板在工具栏正上方弹出，显示所有已添加的贴纸网格

#### Scenario: 关闭贴纸面板
- **WHEN** 用户点击面板外部区域或再次点击贴纸按钮
- **THEN** 贴纸面板关闭

#### Scenario: 空贴纸面板
- **WHEN** 用户未添加任何贴纸时打开面板
- **THEN** 面板显示空状态提示和 [+ 添加] 按钮

### Requirement: Send sticker by click
用户 SHALL 能够点击贴纸缩略图直接发送贴纸消息，无需进入编辑器。点击后面板自动关闭。

#### Scenario: 点击发送贴纸
- **WHEN** 用户在贴纸面板中点击一张贴纸
- **THEN** 系统上传贴纸图片到 Manager 附件存储，然后发送包含 `sticker` 字段的消息，面板自动关闭

#### Scenario: 上传失败
- **WHEN** 贴纸图片上传失败
- **THEN** 系统显示错误提示，不发送消息，面板保持打开

### Requirement: Add sticker via file dialog
用户 SHALL 能通过 [+ 添加] 按钮调用 Tauri 原生文件对话框选择图片文件（支持 png/jpg/gif/webp）。选择后图片自动添加到贴纸列表。

#### Scenario: 选择图片添加贴纸
- **WHEN** 用户点击 [+ 添加] 按钮并选择一张图片文件
- **THEN** 图片被复制到 stickers 目录，贴纸面板实时刷新显示新贴纸

#### Scenario: 文件过大
- **WHEN** 选择的图片文件超过 1MB
- **THEN** 系统显示错误提示，不添加该贴纸

### Requirement: Delete sticker with confirmation
用户 SHALL 能在贴纸面板中 hover 显示删除按钮（✕），点击后弹窗确认删除。

#### Scenario: 删除贴纸
- **WHEN** 用户 hover 一张贴纸并点击删除按钮，然后在确认弹窗中点击确认
- **THEN** 贴纸从 stickers 目录中删除，面板刷新

#### Scenario: 取消删除
- **WHEN** 用户 hover 一张贴纸并点击删除按钮，然后在确认弹窗中点击取消
- **THEN** 贴纸保留，面板不变

### Requirement: Sticker message rendering
系统 SHALL 对包含 `sticker` 字段的消息采用独立渲染：无气泡背景和边框，直接展示图片，最大宽度 150px，居中对齐。

#### Scenario: 接收贴纸消息
- **WHEN** 收到包含 `sticker` 字段的消息
- **THEN** 消息以大图形式渲染，无气泡包裹，图片最大宽度 150px

#### Scenario: 贴纸消息与普通消息交替显示
- **WHEN** 对话中既有贴纸消息又有普通文本消息
- **THEN** 贴纸消息独立渲染（无气泡），普通消息保持原有气泡样式
