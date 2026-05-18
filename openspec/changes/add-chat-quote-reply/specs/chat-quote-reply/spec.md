## ADDED Requirements

### Requirement: QuoteInfo 类型定义

系统 SHALL 定义 `QuoteInfo` 接口，包含以下字段：
- `id`: string（被引用消息的 ID）
- `from`: string（被引用消息的发送者 ID）
- `text`: string（快照文本，截断至最多 100 字符）
- `timestamp`: number（被引用消息的时间戳）

`ChatMessage` 接口 SHALL 新增可选字段 `quote?: QuoteInfo`。

#### Scenario: 旧消息无 quote 字段
- **WHEN** 收到一条没有 quote 字段的历史消息
- **THEN** MessageBubble 正常渲染消息内容，不显示引用卡片

#### Scenario: 新消息包含 quote 字段
- **WHEN** 收到一条 quote 为 `{ id: "msg-123", from: "Alice", text: "今天天气真不错", timestamp: 1700000000000 }` 的消息
- **THEN** MessageBubble 在消息文本上方渲染引用卡片

### Requirement: 引用快照文本生成

用户引用一条消息时，系统 SHALL 根据原消息内容生成快照文本：
- 纯文本消息：截断至 100 字符，超出部分省略
- 图片附件消息（无文本或文本为空）：快照文本为 `[图片]`
- 文件附件消息（无文本或文本为空）：快照文本为 `[文件] {filename}`
- 转发记录消息：快照文本为 `[聊天记录]`
- 混合内容（文本 + 附件）：取文本部分截断

#### Scenario: 引用短文本消息
- **WHEN** 用户引用一条文本为 "你好" 的消息
- **THEN** 生成的 QuoteInfo.text 为 "你好"

#### Scenario: 引用长文本消息
- **WHEN** 用户引用一条文本超过 100 字符的消息
- **THEN** 生成的 QuoteInfo.text 截断为前 100 字符

#### Scenario: 引用纯图片消息
- **WHEN** 用户引用一条只有图片附件、文本为空的消息
- **THEN** 生成的 QuoteInfo.text 为 "[图片]"

#### Scenario: 引用带文件附件的消息
- **WHEN** 用户引用一条只有文件附件 { name: "report.pdf" }、文本为空的消息
- **THEN** 生成的 QuoteInfo.text 为 "[文件] report.pdf"

### Requirement: 右键菜单引用触发

用户右键点击任意聊天消息时，上下文菜单 SHALL 显示"引用回复"选项。"引用回复"对所有消息可见（不限发送者），"撤回"仅对自己发送的消息可见。

#### Scenario: 右键自己的消息
- **WHEN** 用户右键点击自己发送的消息
- **THEN** 上下文菜单显示"引用回复"和"撤回"两个选项

#### Scenario: 右键他人的消息
- **WHEN** 用户右键点击他人发送的消息
- **THEN** 上下文菜单仅显示"引用回复"选项

#### Scenario: 选择模式（selectMode）下右键
- **WHEN** 用户处于多选转发模式时右键消息
- **THEN** 不弹出上下文菜单（保持现有行为）

### Requirement: 引用预览条

用户点击"引用回复"后，ChatPanel 输入区 SHALL 在 toolbar 下方、RichEditor 上方显示引用预览条。预览条 SHALL 显示 `{发送者}: {截断文本}` 格式的内容和一个关闭按钮（✕）。点击关闭按钮 SHALL 取消引用状态并隐藏预览条。引用状态下发送消息后 SHALL 自动清除引用状态。

#### Scenario: 进入引用模式
- **WHEN** 用户在右键菜单中点击"引用回复"，引用消息为 Alice 发送的 "今天天气真不错"
- **THEN** 输入区显示引用预览条 "Alice: 今天天气真不错"，RichEditor 获得焦点

#### Scenario: 取消引用
- **WHEN** 用户点击引用预览条的关闭按钮
- **THEN** 引用预览条消失，输入区恢复普通状态

#### Scenario: 发送带引用的消息后自动清除
- **WHEN** 用户在引用预览条可见时输入文本并发送
- **THEN** 消息携带 quote 字段发送成功后，引用预览条自动消失

#### Scenario: 重新引用替换旧引用
- **WHEN** 用户已在引用消息 A，再次右键另一条消息 B 并点击"引用回复"
- **THEN** 引用预览条更新为消息 B 的内容

### Requirement: 带引用消息发送

`sendChat` 函数 SHALL 支持在 options 中传入 `quote: QuoteInfo` 参数。发送时 SHALL 将 quote 包含在 POST `/api/messages` 请求体中。

#### Scenario: 发送带引用的消息
- **WHEN** 用户发送消息，options 包含 quote: `{ id: "msg-123", from: "Alice", text: "今天天气真不错", timestamp: 1700000000000 }`
- **THEN** POST `/api/messages` 请求体包含 quote 字段，消息发送成功后本地消息也包含 quote

#### Scenario: 发送无引用的消息
- **WHEN** 用户发送消息，没有设置引用
- **THEN** 行为与现有一致，请求体不包含 quote 字段

### Requirement: 服务端 quote 存储

Manager 的 `POST /api/messages` SHALL 支持请求体中的 `quote` 字段。若存在，SHALL 将其存入 `extra` JSON 对象的 `quote` 键中。relay 转发时 SHALL 将 quote 随 payload 一起发送到目标客户端。

#### Scenario: 发送带 quote 的消息
- **WHEN** POST `/api/messages` body 包含 `{ from: "bob", to: "alice", text: "是啊", quote: { id: "msg-123", ... } }`
- **THEN** Manager 将 quote 存入 extra JSON，并通过 WebSocket relay 完整 payload（含 quote）到 alice

#### Scenario: 发送无 quote 的消息
- **WHEN** POST `/api/messages` body 不包含 quote 字段
- **THEN** 行为与现有一致，extra 中不包含 quote 键

### Requirement: 客户端 quote 接收

useMessages 的 `handleIncomingMessage` 和 `syncMessageToTimeline` SHALL 从消息 payload / extra 中提取 `quote` 字段，构造包含 `quote` 的 ChatMessage。

#### Scenario: 接收带引用的实时消息
- **WHEN** WebSocket 收到 message，payload 包含 `{ text: "是啊", quote: { id: "msg-123", from: "Alice", text: "今天天气真不错", timestamp: 1700000000000 } }`
- **THEN** 构造的 ChatMessage 包含 quote 字段

#### Scenario: 同步带引用的历史消息
- **WHEN** GET `/api/messages/sync` 返回一条 extra 包含 `quote` 的消息
- **THEN** syncMessageToTimeline 构造的 ChatMessage 包含 quote 字段

### Requirement: 引用卡片渲染

MessageBubble 对包含 `quote` 字段的消息 SHALL 在文本内容上方渲染引用卡片。引用卡片 SHALL 包含：左侧竖线（accent 色）、发送者 ID、截断文本。引用卡片 SHALL 可点击。

#### Scenario: 渲染普通引用卡片
- **WHEN** 消息 quote 为 `{ id: "msg-123", from: "Alice", text: "今天天气真不错" }`
- **THEN** 在消息文本上方显示引用卡片：左侧竖线 + "Alice" + "今天天气真不错"

#### Scenario: 引用卡片文本截断显示
- **WHEN** 消息 quote.text 为 100 字符的长文本
- **THEN** 引用卡片中文本单行显示，超出部分用 CSS 省略号截断

### Requirement: 引用卡片撤回检测

MessageBubble 渲染引用卡片时 SHALL 检测被引用的原消息是否已被撤回。若原消息已被撤回（timeline 中对应 ID 的条目为 RevokedNotice），SHALL 显示"原消息已撤回"替代快照文本。若原消息不在当前已加载的 timeline 中，SHALL 显示快照文本作为 fallback。

#### Scenario: 被引用消息已被撤回
- **WHEN** 消息引用了 id 为 "msg-123" 的消息，但 timeline 中 "msg-123" 对应的条目是 RevokedNotice
- **THEN** 引用卡片显示 "Alice" + "原消息已撤回"（灰色文字）

#### Scenario: 被引用消息在已加载范围内且正常
- **WHEN** 消息引用了 id 为 "msg-123" 的消息，timeline 中该条目为正常 ChatMessage
- **THEN** 引用卡片正常显示快照文本

#### Scenario: 被引用消息不在已加载范围内
- **WHEN** 消息引用了 id 为 "msg-123" 的消息，但该消息不在当前已加载的 50 条中
- **THEN** 引用卡片显示快照文本（fallback 行为）

### Requirement: 引用卡片点击跳转

用户点击引用卡片时，系统 SHALL 将聊天面板滚动到被引用的原消息位置，使用 smooth 滚动。原消息 SHALL 短暂高亮以提示用户定位。

#### Scenario: 跳转到可视范围内的原消息
- **WHEN** 用户点击引用卡片，被引用消息在当前已渲染的消息列表中
- **THEN** 聊天面板 smooth 滚动到原消息位置，原消息短暂高亮后恢复

#### Scenario: 跳转时原消息不在已加载范围
- **WHEN** 用户点击引用卡片，被引用消息不在当前加载的 50 条消息中
- **THEN** 系统先加载更多历史消息，然后滚动到目标消息位置

### Requirement: MessageBubble data-id 属性

MessageBubble 的根元素 SHALL 设置 `data-id` 属性为消息 ID，用于引用跳转时的 DOM 定位。

#### Scenario: 消息渲染带 data-id
- **WHEN** 渲染一条 id 为 "msg-123" 的消息
- **THEN** MessageBubble 根元素带有 `data-id="msg-123"` 属性
