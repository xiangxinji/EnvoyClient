# EnvoyClient

基于 **Tauri 2 + Vue 3 + TypeScript** 的桌面团队协作客户端，使用 Envoy WebSocket 框架进行实时通信。支持 Leader/Member 角色区分、微信风格聊天界面、远程任务分派与执行、消息本地持久化，以及配套的 Manager 管理后台。

---

## 目录

- [功能特性](#功能特性)
- [技术栈](#技术栈)
- [系统架构](#系统架构)
- [项目结构](#项目结构)
- [快速开始](#快速开始)
- [开发指南](#开发指南)
- [核心模块详解](#核心模块详解)
  - [EnvoyClient 桌面客户端](#envoyclient-桌面客户端)
  - [Tauri 后端 (Rust)](#tauri-后端-rust)
  - [Manager 管理后台](#manager-管理后台)
- [主题系统](#主题系统)
- [数据存储](#数据存储)
- [安全机制](#安全机制)
- [API 参考](#api-参考)
- [构建与部署](#构建与部署)

---

## 功能特性

### 即时通讯
- 微信风格的双栏布局：左侧成员列表 + 右侧聊天窗口
- 支持文字消息实时收发
- 未读消息计数与高亮提示
- 消息自动持久化至本地文件系统

### 团队协作
- **Leader（领导者）**：可向指定成员分派任务（如 Shell 命令），实时查看任务执行状态
- **Member（成员）**：接收并自动执行 Leader 下发的任务，返回执行结果（stdout / stderr / exit code）
- 任务状态追踪：`pending` → `running` → `completed` / `failed`

### 管理后台 (Manager)
- 团队生命周期管理：创建/删除团队，每个团队独立 WebSocket 端口
- 用户账号管理：创建/删除用户，分配 Leader/Member 角色
- 全局仪表盘：团队数、在线成员数、任务统计概览
- 管理员认证与密码修改

### 主题系统
- 完整的 Dark / Light 双主题支持
- CSS 变量驱动，全局一键切换
- 用户偏好持久化至 `localStorage`

### 桌面体验
- 自定义 macOS 风格标题栏（红绿灯按钮）
- 无边框窗口，原生系统集成
- 跨平台支持：Windows / macOS / Linux

---

## 技术栈

| 层级 | 技术 | 说明 |
|------|------|------|
| **客户端前端** | Vue 3.5 + TypeScript 5.6 | Composition API + SFC |
| **桌面框架** | Tauri 2 | Rust 后端，轻量级 WebView |
| **构建工具** | Vite 6 | 快速 HMR，路径别名 |
| **通信框架** | Envoy (WebSocket) | Git 子模块，团队通信 |
| **Tauri 后端** | Rust (serde, dirs) | 文件 IO、Shell 执行 |
| **管理后台 - 后端** | Hono 4 + Node.js | REST API (port 8080) |
| **管理后台 - 前端** | Vue 3 + Vite | 管理界面 (port 5180) |
| **密码安全** | bcryptjs + RSA-OAEP | 服务端哈希 + 客户端加密传输 |

---

## 系统架构

```
┌─────────────────────────────────────────────────────────────────┐
│                      Manager (管理后台)                          │
│  ┌────────────────────┐    ┌─────────────────────────────────┐  │
│  │  Manager Web       │    │  Manager Server (Hono, :8080)   │  │
│  │  Vue 3 SPA (:5180) │───▶│  REST API + RSA 密钥对          │  │
│  └────────────────────┘    └──────────┬──────────────────────┘  │
│                                       │                         │
│                            ┌──────────▼──────────────────────┐  │
│                            │  Team 实例池                     │  │
│                            │  Team A (:3001)                  │  │
│                            │  Team B (:3002)                  │  │
│                            │  Team C (:3003)                  │  │
│                            └─────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                    │ WebSocket               │ WebSocket
          ┌─────────▼──────────┐   ┌─────────▼──────────┐
          │  EnvoyClient (A)   │   │  EnvoyClient (B)   │
          │  Role: Leader      │◀─▶│  Role: Member      │
          │  Tauri + Vue 3     │   │  Tauri + Vue 3     │
          │  ~/.envoy/history/ │   │  ~/.envoy/history/ │
          └────────────────────┘   └────────────────────┘
```

### 通信流程

1. **用户登录**：EnvoyClient → Manager Server `POST /api/auth`，验证用户名密码后返回角色信息
2. **加入团队**：EnvoyClient 通过 WebSocket 连接到对应团队的 Team 实例端口
3. **实时通信**：Leader/Member 之间通过 Envoy 框架进行消息路由
4. **任务分派**：Leader 下发任务 → Member 自动执行 Shell 命令 → 结果回传
5. **消息持久化**：所有聊天/任务消息通过 Tauri invoke 写入本地文件

---

## 项目结构

```
EnvoyClient/
├── src/                              # 客户端前端源码
│   ├── main.ts                       # Vue 应用入口
│   ├── App.vue                       # 根组件：TitleBar + router-view + CSS 变量
│   ├── router.ts                     # Vue Router 配置（Hash 模式）
│   ├── types.ts                      # TypeScript 类型定义
│   ├── composables/
│   │   ├── useTeamClient.ts          # 核心：统一的 Leader/Member 客户端逻辑
│   │   ├── useTheme.ts               # Dark/Light 主题切换
│   │   └── teamClientContext.ts      # Vue 依赖注入（跨组件共享客户端实例）
│   ├── views/
│   │   ├── RoleSelect.vue            # 登录 + 团队选择页面
│   │   └── ChatView.vue             # 主聊天页面（侧边栏 + 聊天面板）
│   ├── components/
│   │   ├── TitleBar.vue              # macOS 风格自定义标题栏
│   │   ├── MemberSidebar.vue         # 成员列表侧边栏
│   │   ├── ChatPanel.vue             # 聊天面板（消息列表 + 输入框 + 任务分派）
│   │   ├── MessageBubble.vue         # 聊天消息气泡
│   │   └── TaskCard.vue              # 任务状态卡片
│   └── envoy/
│       └── BrowserTransport.ts       # 浏览器端 WebSocket 传输层（自动重连）
│
├── src-tauri/                        # Tauri (Rust) 后端
│   ├── src/
│   │   ├── lib.rs                    # Tauri 命令：消息存取、设置、Shell 执行
│   │   ├── history.rs                # 文件 IO：消息持久化逻辑
│   │   └── main.rs                   # Tauri 入口
│   ├── Cargo.toml                    # Rust 依赖
│   └── tauri.conf.json              # Tauri 窗口与安全配置
│
├── manager/                          # 管理后台
│   ├── server/
│   │   ├── index.ts                  # Hono HTTP API 入口 (port 8080)
│   │   ├── routes/
│   │   │   ├── admin.ts              # 管理员认证路由
│   │   │   ├── teams.ts              # 团队 CRUD 路由
│   │   │   ├── users.ts              # 用户管理路由
│   │   │   └── dashboard.ts          # 仪表盘统计路由
│   │   ├── team-registry.ts          # teams.json 读写 + 端口分配
│   │   ├── user-registry.ts          # users.json 读写 + bcrypt 认证
│   │   ├── crypto.ts                 # RSA 密钥对生成与管理
│   │   ├── settings.ts               # 管理员设置持久化
│   │   └── package.json              # 服务端依赖
│   └── web/
│       ├── src/
│       │   ├── App.vue               # 管理后台布局（侧边栏 + 导航）
│       │   ├── api.ts                # REST API 封装 + RSA 加密工具
│       │   ├── router.ts             # 管理后台路由（History 模式 + 登录守卫）
│       │   ├── useTheme.ts           # 管理后台主题管理
│       │   ├── views/
│       │   │   ├── Dashboard.vue     # 全局概览仪表盘
│       │   │   ├── Teams.vue         # 团队列表 + 创建/删除
│       │   │   ├── TeamDetail.vue    # 单团队详情（成员 + 任务）
│       │   │   ├── Users.vue         # 用户管理（增删查）
│       │   │   ├── Login.vue         # 管理员登录
│       │   │   └── Settings.vue      # 管理员设置
│       │   └── components/
│       │       └── TeamCard.vue      # 团队卡片组件
│       └── vite.config.ts            # 开发代理配置
│
├── scripts/
│   └── team-server.ts                # 独立 Team Server 启动脚本
│
├── envoy/                            # Git 子模块 - Envoy WebSocket 框架
├── package.json                      # 根项目配置
├── vite.config.ts                    # Vite 配置 + Envoy 传输层重写
├── tsconfig.json                     # TypeScript 配置 + 路径别名
├── CLAUDE.md                         # AI 开发辅助文档
└── .gitignore
```

---

## 快速开始

### 环境要求

- **Node.js** >= 18
- **Rust** >= 1.70（Tauri 2 要求）
- **pnpm / npm** 包管理器

### 安装依赖

```bash
# 克隆项目（含子模块）
git clone --recurse-submodules <repo-url>

# 安装客户端依赖
npm install

# 安装管理后台服务端依赖
cd manager/server && npm install && cd ../..

# 安装管理后台前端依赖
cd manager/web && npm install && cd ../..
```

### 启动开发

```bash
# 1. 启动管理后台（同时启动后端 :8080 + 前端 :5180）
npm run manager

# 2. 启动 Tauri 桌面客户端（前端 :1420 + Rust 后端）
npm run tauri:dev
```

### 快速体验（纯浏览器）

```bash
# 仅启动前端开发服务器（无需 Tauri/Rust）
npm run dev
# 打开 http://localhost:1420
```

> **注意**：浏览器模式下，Tauri 相关功能（消息持久化、Shell 执行）会被自动静默跳过。

---

## 开发指南

### 可用命令

| 命令 | 说明 |
|------|------|
| `npm run dev` | 启动 Vite 前端开发服务器 (port 1420) |
| `npm run build` | TypeScript 类型检查 + Vite 构建 |
| `npm run tauri:dev` | 启动 Tauri 桌面应用（开发模式） |
| `npm run tauri build` | 构建桌面安装包 |
| `npm run manager` | 同时启动 Manager 后端 + 前端 |
| `npm run manager:server` | 仅启动 Manager 后端 (port 8080) |
| `npm run manager:web` | 仅启动 Manager 前端 (port 5180) |

### 端口分配

| 服务 | 端口 | 说明 |
|------|------|------|
| Vite Dev Server | 1420 | 客户端前端 |
| Manager API | 8080 | 管理后台 REST API |
| Manager Web | 5180 | 管理后台前端 |
| Team Server | 3001+ | 每个团队自动分配独立端口 |

---

## 核心模块详解

### EnvoyClient 桌面客户端

#### 路由结构

| 路径 | 组件 | 说明 |
|------|------|------|
| `/` | `RoleSelect.vue` | 登录认证 + 团队选择 |
| `/chat` | `ChatView.vue` | 主聊天界面 |

路由使用 **Hash 模式**（`createWebHashHistory`），兼容 Tauri WebView。

#### 类型系统 (`src/types.ts`)

```typescript
// 在线成员
interface MemberInfo {
  id: string;
  role: "leader" | "member";
  status: "online";
}

// 聊天消息
interface ChatMessage {
  type: "chat";
  id: string;
  from: string;
  to: string;
  text: string;
  timestamp: number;
  mine: boolean;         // 是否为自己发送
}

// 任务消息
interface TaskMessage {
  type: "task";
  id: string;
  taskId: string;
  from: string;
  content: string;       // 任务描述 / Shell 命令
  status: "pending" | "running" | "completed" | "failed";
  resources: TaskResource[];  // 执行结果
  timestamp: number;
}

// 时间线条目（聊天消息 | 任务消息）
type TimelineItem = ChatMessage | TaskMessage;
```

#### 核心 Composable: `useTeamClient`

`src/composables/useTeamClient.ts` 是客户端的核心逻辑，封装了 Leader/Member 的统一行为：

**状态管理：**
- `status` — 连接状态 (`disconnected` / `connecting` / `connected` / `reconnecting`)
- `members` — 在线成员列表
- `messages` — `Map<peerId, TimelineItem[]>` 会话消息存储
- `unreadCounts` — `Map<peerId, number>` 未读消息计数

**API 方法：**

| 方法 | 说明 | 角色 |
|------|------|------|
| `connect()` | 建立 WebSocket 连接 | 通用 |
| `disconnect()` | 断开连接 | 通用 |
| `sendChat(targetId, text)` | 发送聊天消息 | 通用 |
| `dispatchTask(targetIds[], content)` | 分派任务 | Leader |
| `getConversation(peerId)` | 获取会话历史 | 通用 |
| `syncUnread(peerId, isCurrent)` | 同步未读状态 | 通用 |
| `exportHistory(peerId, path)` | 导出会话记录 | 通用 |
| `importHistory(peerId, path)` | 导入会话记录 | 通用 |

**任务执行机制（Member 端）：**

Member 连接后自动注册任务处理器（通过 `client.doing()`），当 Leader 下发任务时：

1. 收到任务 → 状态标记为 `running`
2. 通过 Tauri `shell_exec` 执行 Shell 命令
3. 收集 stdout / stderr / exit_code
4. 将结果作为 `TaskResource` 回传给 Leader
5. 状态更新为 `completed` 或 `failed`

#### 上下文传递

```
RoleSelect.vue ──setTeamClientInstance()──▶ teamClientContext.ts (全局单例)
                                                    │
ChatView.vue ──getTeamClientInstance()──▶ provide(TeamClientKey)
                                                    │
                        MemberSidebar.vue ◀──inject──┤
                        ChatPanel.vue ◀──────inject──┘
```

#### 登录流程 (`RoleSelect.vue`)

两步式认证：

**Step 1 — 用户登录：**
1. 输入用户名 + 密码
2. 从 Manager Server 获取 RSA 公钥
3. 使用 RSA-OAEP 加密密码
4. `POST /api/auth` 发送加密凭据
5. 服务端返回用户角色和可用团队列表

**Step 2 — 选择团队：**
1. 显示已认证用户名和角色标签
2. 从下拉列表选择目标团队
3. 建立 WebSocket 连接到该团队的 Team 实例
4. 跳转至 `/chat` 聊天页面

#### 聊天界面组件

**MemberSidebar** — 左侧成员列表：
- 显示在线成员头像（首字母）+ 名称 + 角色标签
- 在线状态指示点
- 未读消息气泡计数
- 选中高亮

**ChatPanel** — 右侧聊天区域：
- 消息列表（自动滚动到底部）
- 聊天输入框 + 发送按钮
- Leader 专属：任务分派按钮 + 任务输入面板

**MessageBubble** — 消息气泡：
- 自己的消息：蓝色背景，右对齐
- 他人的消息：灰色背景，左对齐
- 最大宽度 75%，底部显示时间戳

**TaskCard** — 任务卡片：
- 左侧彩色边框标识状态（pending=黄, running=蓝, completed=绿, failed=红）
- 状态标签（待执行/执行中/已完成/失败）
- 任务内容 + 发送者
- 资源结果面板（stdout/stderr/exit code，等宽字体显示）

#### 浏览器兼容层 (`BrowserTransport.ts`)

为浏览器环境提供的 WebSocket 传输层，替代 Envoy 原生的 Node.js Transport：

- 基于 `EventEmitter` 的事件驱动架构
- 自动重连：指数退避策略，默认最多 10 次重试
- 事件：`open` / `message` / `close` / `error` / `reconnecting` / `reconnect_failed`
- Vite 构建时通过自定义插件自动替换 Transport 导入

---

### Tauri 后端 (Rust)

#### Tauri 命令 (`src-tauri/src/lib.rs`)

| 命令 | 参数 | 说明 |
|------|------|------|
| `save_message` | user_id, peer_id, message | 追加消息到会话文件 |
| `load_history` | user_id, peer_id | 加载指定会话历史 |
| `load_all_history` | user_id | 加载用户所有会话 |
| `export_history` | user_id, peer_id, target_path | 导出会话到指定路径 |
| `import_history` | user_id, peer_id, source_path | 导入会话（自动去重） |
| `get_settings` | — | 读取用户设置 |
| `save_settings` | settings | 保存用户设置 |
| `shell_exec` | command | 执行 Shell 命令并返回结果 |
| `file_read` | path | 读取文件内容 |
| `file_write` | path, content | 写入文件 |

#### Shell 执行

```rust
// Windows: cmd /C <command>
// Unix:    sh -c <command>
// 返回: { stdout, stderr, exit_code }
```

用于 Member 端执行 Leader 下发的 Shell 任务。

#### 消息持久化 (`src-tauri/src/history.rs`)

存储结构：
```
~/.envoy/history/
  └── {user_id}/
      ├── {peer_id_1}.json    # 与 peer_id_1 的会话
      ├── {peer_id_2}.json    # 与 peer_id_2 的会话
      └── ...
```

每个 JSON 文件包含 `TimelineItem[]` 数组，消息按 `timestamp` 排序。导入时会按 `id` 去重，避免重复消息。

---

### Manager 管理后台

#### 后端 API (`manager/server/`)

基于 **Hono** 框架的 REST API，运行在 port 8080。

**路由前缀：**
- `/api/admin/*` — 管理员认证与管理
- `/api/teams/*` — 团队 CRUD + 实时数据查询
- `/api/users/*` — 用户账号管理
- `/api/dashboard` — 仪表盘统计
- `/api/auth` — 用户登录认证
- `/api/public-key` — RSA 公钥获取

**核心路由处理器：**

| 文件 | 路由 | 说明 |
|------|------|------|
| `routes/admin.ts` | `POST /api/admin/login`, `GET /api/admin/profile`, `PUT /api/admin/update`, `POST /api/admin/logout` | 管理员 JWT 认证 |
| `routes/teams.ts` | `GET /api/teams`, `POST /api/teams`, `DELETE /api/teams/:name`, `GET /api/teams/:name/members`, `GET /api/teams/:name/tasks` | 团队生命周期管理 |
| `routes/users.ts` | `GET /api/users`, `POST /api/users`, `DELETE /api/users/:username` | 用户账号 CRUD |
| `routes/dashboard.ts` | `GET /api/dashboard` | 全局统计数据 |

#### 团队注册表 (`team-registry.ts`)

持久化存储在 `~/.envoy/teams.json`：

```typescript
interface TeamRecord {
  name: string;
  port: number;
  createdAt: string;
}
```

端口分配策略：从 3001 开始递增，跳过已占用端口。

#### 用户注册表 (`user-registry.ts`)

持久化存储在 `~/.envoy/users.json`：

```typescript
interface UserRecord {
  username: string;
  password: string;   // bcrypt 哈希
  role: "leader" | "member";
  createdAt: string;
}
```

密码使用 bcrypt（salt rounds = 10）进行哈希存储。

#### RSA 密钥管理 (`crypto.ts`)

- 服务启动时生成 2048-bit RSA 密钥对
- 公钥通过 `GET /api/public-key` 暴露给客户端
- 私钥仅在服务端内存中持有，用于解密客户端传输的密码

#### 管理后台前端 (`manager/web/`)

**路由结构（History 模式）：**

| 路径 | 组件 | 说明 | 权限 |
|------|------|------|------|
| `/login` | Login.vue | 管理员登录 | 公开 |
| `/` | Dashboard.vue | 全局概览 | 需认证 |
| `/teams` | Teams.vue | 团队列表 | 需认证 |
| `/teams/:name` | TeamDetail.vue | 团队详情 | 需认证 |
| `/users` | Users.vue | 用户管理 | 需认证 |
| `/settings` | Settings.vue | 管理员设置 | 需认证 |

路由守卫检查 `localStorage` 中的 `admin_token`，未认证时重定向至 `/login`。

**Dashboard 仪表盘：**
- 三张统计卡片：团队总数、在线成员数、任务总数
- 任务状态分布网格：待执行 / 执行中 / 已完成 / 失败
- 每 5 秒自动刷新

**Teams 团队管理：**
- 卡片式团队列表，显示名称、端口、在线人数、任务数
- 创建团队弹窗（名称输入，端口自动分配）
- 删除确认对话框
- 点击进入团队详情

**TeamDetail 团队详情：**
- 成员表格（ID、角色、连接状态）
- 任务表格（任务 ID、下发者、内容、状态）

**Users 用户管理：**
- 用户表格（用户名、角色、创建时间）
- 创建用户弹窗（用户名 + 密码 + 角色选择）
- 角色切换按钮（Leader / Member）
- 密码在发送前通过 RSA 加密

---

## 主题系统

### CSS 变量体系

项目使用 CSS 变量实现全局主题，定义在 `src/App.vue` 的 `:root`（Light）和 `html.dark`（Dark）选择器中。

**变量命名规范：**

| 前缀 | 用途 | 示例 |
|------|------|------|
| `--bg-*` | 背景色 | `--bg-primary`, `--bg-secondary`, `--bg-hover` |
| `--text-*` | 文字色 | `--text-primary`, `--text-secondary`, `--text-muted` |
| `--border-*` | 边框色 | `--border-default`, `--border-light` |
| `--accent` | 主强调色 | 按钮、链接、选中态 |
| `--task-*` | 任务状态色 | `--task-pending`, `--task-running`, `--task-completed`, `--task-failed` |
| `--bubble-*` | 聊天气泡色 | `--bubble-mine-bg`, `--bubble-other-bg` |
| `--role-*` | 角色标签色 | `--role-leader-bg`, `--role-member-bg` |
| `--sidebar-*` | 侧边栏色 | `--sidebar-bg`, `--sidebar-active` |
| `--titlebar-*` | 标题栏色 | `--titlebar-bg`, `--titlebar-text` |
| `--error` | 错误色 | 错误提示、失败状态 |

**主题切换：**

```typescript
import { useTheme } from "@/composables/useTheme";

const { theme, toggle } = useTheme();
// theme.value: "dark" | "light"
// toggle(): 切换主题
```

- 默认主题：Dark
- 偏好持久化：`localStorage` key `envoy-theme`
- 监听系统主题偏好变化

> **开发规范**：所有新增或修改的样式必须使用 CSS 变量，并在 `:root` 和 `html.dark` 中同时定义。

---

## 数据存储

所有本地数据存储在 `~/.envoy/` 目录下：

```
~/.envoy/
├── history/                    # 消息历史
│   └── {user_id}/
│       ├── {peer_id}.json     # 会话记录（TimelineItem[]）
│       └── ...
├── teams.json                  # 团队注册表（TeamRecord[]）
├── users.json                  # 用户注册表（UserRecord[]）
├── settings.json               # 用户设置
└── admin.json                  # 管理员账号（bcrypt 哈希密码）
```

---

## 安全机制

### 密码传输加密

- Manager Server 启动时生成 **2048-bit RSA 密钥对**
- 客户端通过 `GET /api/public-key` 获取公钥
- 登录时使用 **RSA-OAEP** 加密密码明文
- 服务端使用私钥解密后进行 bcrypt 比对

### 密码存储

- 使用 **bcrypt**（salt rounds = 10）哈希存储
- 密码永不以明文形式存储在磁盘上

### 管理员认证

- JWT Token 认证机制
- Token 存储在客户端 `localStorage`（key: `admin_token`）
- 每次请求通过 `Authorization: Bearer <token>` 头部验证

### CSP 安全策略

Tauri 窗口配置了 Content Security Policy：
```
default-src 'self' 'unsafe-inline' 'unsafe-eval' http: ws: https: wss:;
img-src 'self' asset: https://asset.localhost data:;
```

---

## API 参考

### Manager REST API

#### 认证相关

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/api/auth` | 用户登录（RSA 加密密码） |
| `GET` | `/api/public-key` | 获取 RSA 公钥 |
| `POST` | `/api/admin/login` | 管理员登录 |
| `POST` | `/api/admin/logout` | 管理员登出 |
| `GET` | `/api/admin/profile` | 获取管理员信息 |
| `PUT` | `/api/admin/update` | 更新管理员账号 |

#### 团队管理

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/teams` | 获取所有团队列表 |
| `POST` | `/api/teams` | 创建新团队 |
| `DELETE` | `/api/teams/:name` | 删除团队 |
| `GET` | `/api/teams/:name/members` | 获取团队成员 |
| `GET` | `/api/teams/:name/tasks` | 获取团队任务 |

#### 用户管理

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/users` | 获取所有用户 |
| `POST` | `/api/users` | 创建用户 |
| `DELETE` | `/api/users/:username` | 删除用户 |

#### 仪表盘

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/dashboard` | 全局统计（团队数、成员数、任务统计） |

### Tauri IPC 命令

| 命令 | 参数 | 返回值 | 说明 |
|------|------|--------|------|
| `save_message` | `user_id`, `peer_id`, `message: string` | `void` | 保存消息 |
| `load_history` | `user_id`, `peer_id` | `string[]` | 加载会话 |
| `load_all_history` | `user_id` | `{ [peerId]: string[] }` | 加载所有会话 |
| `export_history` | `user_id`, `peer_id`, `target_path` | `void` | 导出会话 |
| `import_history` | `user_id`, `peer_id`, `source_path` | `void` | 导入会话 |
| `get_settings` | — | `string \| null` | 读取设置 |
| `save_settings` | `settings: string` | `void` | 保存设置 |
| `shell_exec` | `command: string` | `{ stdout, stderr, exit_code }` | 执行命令 |
| `file_read` | `path: string` | `string` | 读文件 |
| `file_write` | `path`, `content: string` | `void` | 写文件 |

---

## 构建与部署

### 开发环境

```bash
# 安装所有依赖
npm install
cd manager/server && npm install && cd ../..
cd manager/web && npm install && cd ../..

# 启动管理后台
npm run manager

# 启动桌面客户端（另一个终端）
npm run tauri:dev
```

### 生产构建

```bash
# 构建桌面安装包
npm run tauri build

# 输出位置:
# Windows: src-tauri/target/release/bundle/msi/
# macOS:   src-tauri/target/release/bundle/dmg/
# Linux:   src-tauri/target/release/bundle/deb/ 或 appimage/
```

### Tauri 配置要点

- **窗口尺寸**：800 x 600
- **无边框**：`decorations: false`（使用自定义 TitleBar）
- **CSP**：允许 WebSocket 和 HTTP 连接
- **Bundle Targets**：`all`（所有平台）

---

## License

Private - All Rights Reserved
