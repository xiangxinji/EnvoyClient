## ADDED Requirements

### Requirement: MessageService.send 发送聊天消息

MessageService SHALL 提供 `send(targetId: string, text: string, options?: Readonly<SendOptions>)` 方法。方法 SHALL 通过 `managerPost` 向 `POST /api/messages` 发送请求，请求 body 包含 `from`（myId）、`to`（targetId）、`text`。当 options 包含 `channel` 字段时，body 中 SHALL NOT 包含 `to` 字段。

`SendOptions` 类型 SHALL 包含以下可选字段（均为 readonly）：`attachments`、`source`、`forwarded`、`quote`、`sticker`、`channel`、`mentions`、`cloudRefs`。

方法 SHALL 返回 `Promise<SendResult>`，`SendResult` 包含 `id: string` 和 `seq: number`。

#### Scenario: 发送普通消息
- **WHEN** 调用 `send("member1", "hello")`
- **THEN** 向 POST /api/messages 发送 `{ from: myId, to: "member1", text: "hello" }`，返回 `{ id, seq }`

#### Scenario: 发送频道消息
- **WHEN** 调用 `send("", "hello", { channel: "general" })`
- **THEN** 向 POST /api/messages 发送 `{ from: myId, text: "hello", channel: "general" }`（无 to 字段）

#### Scenario: 发送带附件消息
- **WHEN** 调用 `send("member1", "see attached", { attachments: [...] })`
- **THEN** body 中包含 `attachments` 数组

### Requirement: MessageService.revoke 撤回消息

MessageService SHALL 提供 `revoke(msgId: string)` 方法。方法 SHALL 通过 `fetch` 向 `DELETE /api/messages/:msgId` 发送请求，query 参数包含 `from=myId`，header 包含 `team: teamName`。

方法 SHALL 返回 `Promise<boolean>`，成功返回 `true`，失败返回 `false`。

#### Scenario: 撤回成功
- **WHEN** 调用 `revoke("msg-123")` 且服务端返回 200
- **THEN** 返回 `true`

#### Scenario: 撤回失败
- **WHEN** 调用 `revoke("msg-123")` 且服务端返回非 200
- **THEN** 返回 `false`

### Requirement: MessageService.uploadAttachment 上传消息附件

MessageService SHALL 提供 `uploadAttachment(file: File)` 方法。方法 SHALL 通过 `fetch` 向 `POST /api/messages/attachments` 发送 `FormData`（包含 `file` 和 `from`），header 包含 `team: teamName`。

方法 SHALL 返回 `Promise<MessageAttachment>`，并将返回的 `url` 字段转换为完整 URL（通过 `apiUrl`）。

#### Scenario: 上传图片文件
- **WHEN** 调用 `uploadAttachment(imageFile)` 且服务端返回 `{ url: "/uploads/abc.png", name: "abc.png", ... }`
- **THEN** 返回 `MessageAttachment`，其中 `url` 为完整路径（如 `http://localhost:8080/uploads/abc.png`）

#### Scenario: 上传失败
- **WHEN** 调用 `uploadAttachment(file)` 且服务端返回非 200
- **THEN** throw Error，包含服务端错误信息
