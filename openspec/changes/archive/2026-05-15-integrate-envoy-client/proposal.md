## Why

EnvoyClient 是一个 Tauri 桌面应用，需要使用 Envoy 通信框架作为核心能力。Envoy 作为 git 子模块已存在于项目中，但其代码依赖 Node.js 的 `ws` 模块，无法直接在浏览器/WebView 环境运行。需要将 Envoy 的 Client 能力桥接到 Tauri 的 WebView 层，使桌面应用能以 Leader 或 Member 角色连接远端 Team Server。

## What Changes

- 新增 `BrowserTransport`，使用浏览器原生 `WebSocket` API 替代 Node.js `ws` 模块，实现与 `ClientTransport` 相同的接口
- 配置 Vite alias，使 Vue 前端直接引用 Envoy 子模块源码（`packages/core`、`packages/client`、`packages/teams`），无需单独 build
- 配置 Vite 排除 `ws` 模块，打包时使用 `BrowserTransport` 替代原始 `ClientTransport`
- 在 Vue 应用中初始化 Envoy Client 实例，提供 Leader/Member 角色的连接管理能力
- 提供基础 Vue 组件，展示连接状态和任务信息

## Capabilities

### New Capabilities

- `envoy-transport-browser`: 浏览器环境下的 WebSocket 传输层实现，替换 Node.js `ws` 模块，提供与 `ClientTransport` 兼容的接口（connect/send/disconnect 及 open/message/close/error 事件）
- `envoy-vite-integration`: Vite 构建配置，通过 alias 引用 Envoy 子模块源码，排除 `ws` 模块，使 Envoy TypeScript 代码在 WebView 中可用
- `envoy-vue-client`: Vue 前端层对 Envoy Client 的封装，提供 Leader/Member 角色管理、连接状态响应式绑定、任务事件监听等能力

### Modified Capabilities

## Impact

- **构建系统**: `vite.config.ts` 需要新增 alias 和 resolve 配置
- **新增文件**: `BrowserTransport` 实现、Vue 组件、Envoy Client 封装
- **依赖关系**: 前端代码依赖 Envoy 子模块源码（git submodule）
- **不受影响**: Rust 后端（`src-tauri/`）仅做桌面壳，不参与网络通信；Envoy 子模块本身不做任何修改
