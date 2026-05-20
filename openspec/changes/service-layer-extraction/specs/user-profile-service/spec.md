## ADDED Requirements

### Requirement: UserProfileService.fetchProfiles 获取用户资料

UserProfileService SHALL 提供 `fetchProfiles(usernames: readonly string[])` 方法。方法 SHALL 通过 `managerFetch` 向 `GET /api/users/profiles` 发送请求，query 参数 `names` 为逗号分隔的用户名列表。

方法 SHALL 返回 `Promise<UserProfile[]>`。

#### Scenario: 批量获取资料
- **WHEN** 调用 `fetchProfiles(["alice", "bob"])`
- **THEN** 请求 `GET /api/users/profiles?names=alice%2Cbob`，返回 UserProfile 数组

#### Scenario: 空数组
- **WHEN** 调用 `fetchProfiles([])`
- **THEN** 请求 `GET /api/users/profiles?names=`，返回空数组

### Requirement: UserProfileService.updateProfile 更新用户资料

UserProfileService SHALL 提供 `updateProfile(username: string, data: Readonly<{ nickname?: string | null }>)` 方法。方法 SHALL 通过 `managerFetch` 向 `PATCH /api/users/:username/profile` 发送 JSON 请求。

方法 SHALL 返回 `Promise<{ nickname: string | null; avatar_url: string | null }>`。

#### Scenario: 更新昵称
- **WHEN** 调用 `updateProfile("alice", { nickname: "Alice W." })`
- **THEN** PATCH body 为 `{ nickname: "Alice W." }`，返回更新后的 nickname 和 avatar_url

#### Scenario: 清除昵称
- **WHEN** 调用 `updateProfile("alice", { nickname: null })`
- **THEN** PATCH body 为 `{ nickname: null }`，返回 `{ nickname: null, avatar_url: ... }`

### Requirement: UserProfileService.uploadAvatar 上传用户头像

UserProfileService SHALL 提供 `uploadAvatar(username: string, file: File)` 方法。方法 SHALL 通过 `fetch` 向 `POST /api/users/:username/avatar` 发送 `FormData`（包含 `avatar` 字段），使用 `X-Envoy-Token` header 认证。

方法 SHALL 返回 `Promise<{ avatar_url: string }>`。服务端返回非 2xx 时 SHALL throw Error。

#### Scenario: 上传头像成功
- **WHEN** 调用 `uploadAvatar("alice", imageFile)` 且服务端返回 200
- **THEN** 返回 `{ avatar_url: "/uploads/avatars/alice.png" }`

#### Scenario: 上传头像失败
- **WHEN** 服务端返回非 2xx
- **THEN** throw Error，包含错误信息
