## ADDED Requirements

### Requirement: BrowserTransport 实现与 ClientTransport 兼容的接口
BrowserTransport SHALL 提供与 `ClientTransport` 相同的公开 API：`connect()`、`send(message)`、`disconnect()`、`isConnected` 属性，以及 `open`、`message`、`close`、`error`、`reconnecting`、`reconnect_failed` 事件。

#### Scenario: 成功连接到远端 Server
- **WHEN** 调用 `connect()` 并远端 Server 可达
- **THEN** 内部创建浏览器 `WebSocket` 实例，触发 `open` 事件，`isConnected` 返回 `true`，Promise resolve

#### Scenario: Server 不可达时连接失败
- **WHEN** 调用 `connect()` 并远端 Server 不可达
- **THEN** Promise reject，不触发 `open` 事件，`isConnected` 保持 `false`

#### Scenario: 接收并反序列化消息
- **WHEN** WebSocket 收到文本数据
- **THEN** 使用 `deserializeMessage` 反序列化后触发 `message` 事件

#### Scenario: 发送序列化消息
- **WHEN** 调用 `send(message)` 且连接处于 OPEN 状态
- **THEN** 使用 `serializeMessage` 序列化后通过 WebSocket 发送

#### Scenario: 未连接时发送消息抛出错误
- **WHEN** 调用 `send(message)` 且未连接
- **THEN** 抛出 `Error("Not connected")`

### Requirement: BrowserTransport 支持自动重连
BrowserTransport SHALL 在连接意外关闭时自动尝试重连，使用递增延迟策略。

#### Scenario: 连接意外关闭触发重连
- **WHEN** WebSocket 连接意外关闭且 `reconnect` 选项为 `true`
- **THEN** 触发 `close` 事件，按递增延迟（`reconnectInterval * min(attempt, 5)`）自动尝试重连，每次尝试触发 `reconnecting` 事件

#### Scenario: 达到最大重连次数后放弃
- **WHEN** 重连尝试次数达到 `maxReconnectAttempts`
- **THEN** 触发 `reconnect_failed` 事件，不再尝试重连

#### Scenario: 手动断开不触发重连
- **WHEN** 调用 `disconnect()` 主动断开
- **THEN** 清除重连定时器，不触发任何重连尝试

### Requirement: BrowserTransport 使用浏览器原生 WebSocket API
BrowserTransport SHALL 使用浏览器原生 `WebSocket` API 而非 Node.js `ws` 模块。

#### Scenario: 构造函数创建浏览器 WebSocket
- **WHEN** 调用 `connect()`
- **THEN** 使用 `new WebSocket(url)` 创建浏览器原生 WebSocket 实例，通过 `onopen`/`onmessage`/`onclose`/`onerror` 处理事件
