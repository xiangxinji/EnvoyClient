# CLAUDE.md

## Project Overview

EnvoyClient 是一个基于 Tauri 2 + Vue 3 的桌面协作客户端，使用 Envoy 框架进行 WebSocket 通信。支持 Leader/Member 角色区分，微信风格聊天界面，任务分派，以及本地文件存储消息记录。项目还包含 Manager 管理后台，支持多团队创建和管理。

## Tech Stack

- **Client Frontend**: Vue 3 + TypeScript + Vite + Vue Router
- **Desktop**: Tauri 2 (Rust backend)
- **Communication**: Envoy framework (WebSocket, 子模块 `Envoy/`)
- **Storage**: Rust 文件 IO，存储在 `~/.envoy/history/`
- **Manager Backend**: Hono (Node.js HTTP API)
- **Manager Frontend**: Vue 3 + TypeScript + Vite + Vue Router

## Commands

```bash
# EnvoyClient (Tauri 桌面客户端)
npm run dev              # Vite dev server (port 1420)
npm run tauri dev        # Tauri desktop app
npm run build            # Frontend build
npm run tauri build      # Full desktop build
npx tsx scripts/team-server.ts  # 单独 Team server (Node.js, port 3000)

# Manager (管理后台)
cd manager/server && npx tsx index.ts    # Manager API + Team 实例池 (port 8080)
cd manager/web && npm run dev            # Manager 前端 (port 5180)
```

## Project Structure

```
src/
├── App.vue              # Root: TitleBar + router-view, CSS variables (theme)
├── router.ts            # Vue Router (/ → RoleSelect, /chat → ChatView)
├── types.ts             # ChatMessage, TaskMessage, MemberInfo, TimelineItem
├── composables/
│   ├── useTeamClient.ts # Unified Leader/Member client composable
│   ├── useTheme.ts      # Dark/light mode toggle, persisted in localStorage
│   └── teamClientContext.ts  # Shared instance + injection key
├── components/
│   ├── TitleBar.vue     # macOS-style titlebar with traffic lights + theme toggle
│   ├── MemberSidebar.vue
│   ├── ChatPanel.vue
│   ├── MessageBubble.vue
│   └── TaskCard.vue
└── views/
    ├── RoleSelect.vue   # Role selection + connection config
    └── ChatView.vue     # Main chat layout
src-tauri/
├── src/
│   ├── lib.rs           # Tauri commands (history: save/load/export/import)
│   ├── history.rs       # File IO for message persistence
│   └── main.rs
├── Cargo.toml           # Rust deps: tauri, serde, serde_json, dirs
└── tauri.conf.json      # Window config (decorations: false)
Envoy/                   # Git submodule - WebSocket framework
scripts/
└── team-server.ts       # Team server launcher (tsx)
manager/
├── server/
│   ├── index.ts          # Hono HTTP API + Team 实例池管理 (port 8080)
│   ├── team-registry.ts  # teams.json 读写 + 端口分配
│   ├── user-registry.ts  # users.json 读写 + 认证
│   └── package.json      # hono, tsx
└── web/
    ├── src/
    │   ├── App.vue       # 管理后台布局 + 主题变量
    │   ├── api.ts        # REST API 封装
    │   ├── router.ts     # / → Dashboard, /teams, /teams/:name, /users
    │   ├── views/
    │   │   ├── Dashboard.vue   # 全局概览（团队数/成员数/任务统计）
    │   │   ├── Teams.vue       # 团队列表 + 创建/删除
    │   │   ├── TeamDetail.vue  # 单团队详情（成员表 + 任务表）
    │   │   └── Users.vue       # 用户管理（增删查账号）
    │   └── components/
    │       ├── TeamCard.vue
    │       ├── MemberTable.vue
    │       └── TaskTable.vue
    └── vite.config.ts    # proxy /api → localhost:8080
```

## Style Rules

### Dark/Light Mode

项目使用 CSS 变量实现主题切换，定义在 `App.vue` 的 `:root` 和 `html.dark` 中。

**所有更改或新增的样式必须包含双色逻辑：**
1. 使用 CSS 变量（`var(--xxx)`）而非硬编码颜色值
2. 如果现有变量不够用，在 `App.vue` 的 `:root` 和 `html.dark` 中同时添加新变量
3. 绝不允许写只有亮色或只有暗色的样式

变量命名规范：
```
--bg-*          背景色
--text-*        文字色
--border-*      边框色
--accent        主强调色
--task-*        任务卡片相关
--bubble-*      聊天气泡
--role-*        角色标签
--sidebar-*     侧边栏
--titlebar-*    标题栏
--error         错误色
```

### Theme Toggle

使用 `useTheme()` composable，通过 `html.dark` class 切换。用户偏好保存在 `localStorage` key `envoy-theme`，默认 dark。

## Key Patterns

- **Composable**: `useTeamClient(role, options)` 统一入口，返回 connect/disconnect/sendChat/dispatchTask
- **Context passing**: `teamClientContext.ts` 持有实例，RoleSelect 创建后 set，ChatView get 并 provide
- **Browser compat**: `safeInvoke()` 检测 Tauri 环境，浏览器端静默跳过 Rust 调用
- **Message persistence**: 新消息通过 `invoke("save_message")` 写入 `~/.envoy/history/${myId}/${peerId}.json`
- **Manager architecture**: Manager 后端同时运行 HTTP API 和多个 Team 实例，每个团队独立端口。团队注册表持久化在 `~/.envoy/teams.json`
- **Manager API**: REST 风格，通过 `team.innerServer.getClients()` / `getAllTasks()` 查询实时数据
- **User auth**: 全局账号存储在 `~/.envoy/users.json`（明文密码），EnvoyClient 连接前通过 `POST /api/auth` 校验，不修改 Envoy 框架
