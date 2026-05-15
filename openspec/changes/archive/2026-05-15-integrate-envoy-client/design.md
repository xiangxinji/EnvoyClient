## Context

EnvoyClient 是一个 Tauri 2 桌面应用（Vue 3 + Rust），需要集成 Envoy 通信框架作为核心能力。Envoy 是一个纯 TypeScript/Node.js 的 WebSocket 通信框架，已作为 git 子模块存在于项目中。

当前状态：
- Envoy 子模块位于 `Envoy/packages/`，包含 core、client、server、teams 四个包
- 应用只需 Client 能力（Leader/Member 角色），不需要 Server
- Envoy 的 `ClientTransport` 依赖 Node.js `ws` 模块，无法在浏览器/WebView 环境直接运行
- 其余所有代码（core、Client 业务逻辑、Leader、Member）均为纯 TypeScript，与运行环境无关

约束：
- Envoy 子模块本身不做任何修改（保持与上游同步的能力）
- Rust 后端只做桌面壳，不参与网络通信

## Goals / Non-Goals

**Goals:**
- 在 WebView 中运行 Envoy Client 全部业务逻辑（Task 状态机、串行队列、心跳、事件系统）
- 用浏览器原生 `WebSocket` API 替代 `ws` 模块
- Vue 组件能响应式地访问 Client 状态（连接状态、队列、当前任务）
- 支持 Leader 和 Member 两种角色的创建和使用

**Non-Goals:**
- 不在 Rust 层实现任何网络通信逻辑
- 不修改 Envoy 子模块源码
- 不支持 Server/Team 角色在桌面端运行
- 不实现完整的 UI 界面（只提供基础状态展示组件）

## Decisions

### 1. BrowserTransport 作为独立文件，通过 Vite alias 替换原始 transport

**决定**: 新建 `src/envoy/BrowserTransport.ts`，在 Vite 配置中将 `Envoy/packages/client/transport.js` 的 import 解析指向它。

**替代方案**:
- 直接修改 Envoy 子模块代码 → 放弃，会破坏与上游同步
- 在 Rust 侧做 WebSocket proxy → 放弃，增加不必要的复杂度
- 用 Vite plugin 在编译时替换 → 过度工程化

**理由**: alias 替换是最小侵入的方式，Envoy 源码零修改，只有构建配置指向新的 transport。

### 2. Vite alias 直接引用子模块 TypeScript 源码

**决定**: 配置 `@envoy/core`、`@envoy/client`、`@envoy/teams` 三个 alias 指向子模块源码目录。

**理由**: Vite 原生支持 TypeScript 编译，无需 Envoy 单独 build。子模块源码变更后 Vite HMR 自动生效，开发体验最佳。

### 3. Vue Composable 封装 Envoy Client 实例

**决定**: 使用 Vue 3 Composable（`useLeader()` / `useMember()`）封装 Leader/Member 实例，提供响应式状态。

**替代方案**:
- Pinia store → 对单个 Client 实例管理过重
- Provide/Inject → 作用域管理不如 Composable 直观

**理由**: Composable 天然契合 Vue 3 Composition API，生命周期与组件绑定，清理逻辑简单。

### 4. `ws` 模块通过 Vite `resolve.alias` 配合外部化排除

**决定**: 不单独处理 `ws` 的排除——因为 alias 直接指向源码文件（非包入口），Vite 不会解析 `ws` 的 import，BrowserTransport 也不引用它。

**理由**: alias 替换 transport 后，`ws` 的 import 路径根本不会出现在最终 bundle 中，无需额外排除配置。

## Risks / Trade-offs

- **[Envoy 内部 import 路径]** → Envoy 源码使用 `.js` 后缀的相对路径 import（ESM 规范），Vite 能正确解析对应 `.ts` 文件。如果未来 Envoy 改用其他打包方式，alias 可能需要调整。
- **[Transport 接口变更]** → 如果 Envoy 上游修改了 `ClientTransport` 的接口，BrowserTransport 需要同步更新。通过 TypeScript 类型系统可以在编译时捕获不一致。
- **[浏览器 WebSocket 限制]** → 浏览器 WebSocket 不支持自定义 headers，连接参数需要通过 URL query string 传递（与现有实现一致）。浏览器也没有 `ws` 的 `readyState` 常量，需使用 `WebSocket.OPEN` 等原生常量。
