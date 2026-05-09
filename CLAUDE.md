# CLAUDE.md

## Project Overview

EnvoyClient 是一个基于 Tauri 2 + Vue 3 的桌面协作客户端，使用 Envoy 框架进行 WebSocket 通信。支持 Leader/Member 角色区分，微信风格聊天界面，任务分派，以及本地文件存储消息记录。

## Tech Stack

- **Frontend**: Vue 3 + TypeScript + Vite + Vue Router
- **Desktop**: Tauri 2 (Rust backend)
- **Communication**: Envoy framework (WebSocket, 子模块 `Envoy/`)
- **Storage**: Rust 文件 IO，存储在 `~/.envoy/history/`

## Commands

```bash
npm run dev              # Vite dev server (port 1420)
npm run tauri dev        # Tauri desktop app
npm run build            # Frontend build
npm run tauri build      # Full desktop build
npx tsx scripts/team-server.ts  # Team server (Node.js, port 3000)
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
