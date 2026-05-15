## ADDED Requirements

### Requirement: Vite alias 指向 Envoy 子模块源码
Vite 构建配置 SHALL 提供 `@envoy/core`、`@envoy/client`、`@envoy/teams` 三个 alias，分别指向 `Envoy/packages/core`、`Envoy/packages/client`、`Envoy/packages/teams` 目录的 `index.ts` 入口文件。

#### Scenario: 前端代码引用 Envoy core
- **WHEN** 前端代码包含 `import { Task } from "@envoy/core"`
- **THEN** Vite 解析到 `Envoy/packages/core/index.ts`，TypeScript 编译通过

#### Scenario: 前端代码引用 Envoy client
- **WHEN** 前端代码包含 `import { Client } from "@envoy/client"`
- **THEN** Vite 解析到 `Envoy/packages/client/index.ts`，TypeScript 编译通过

#### Scenario: 前端代码引用 Envoy teams
- **WHEN** 前端代码包含 `import { Leader, Member } from "@envoy/teams"`
- **THEN** Vite 解析到 `Envoy/packages/teams/index.ts`，TypeScript 编译通过

### Requirement: BrowserTransport 通过 alias 替换原始 ClientTransport
Vite 配置 SHALL 将 `Envoy/packages/client/transport` 的 import 解析指向项目内的 `BrowserTransport` 文件，使得所有依赖 `ClientTransport` 的代码自动使用浏览器版本。

#### Scenario: Client 类使用 BrowserTransport
- **WHEN** `Client` 类 import `ClientTransport`
- **THEN** Vite 将该 import 解析到 `src/envoy/BrowserTransport.ts`，而非 `Envoy/packages/client/transport.ts`

#### Scenario: 构建产物不包含 ws 模块
- **WHEN** 执行 Vite 构建
- **THEN** 最终 bundle 中不包含任何 `ws` 模块代码

### Requirement: TypeScript 路径映射与 Vite alias 一致
`tsconfig.json` SHALL 配置与 Vite alias 一致的 `paths` 映射，确保 IDE 类型检查和跳转正常工作。

#### Scenario: IDE 能正确解析 Envoy 类型
- **WHEN** 在 IDE 中 Ctrl+点击 `@envoy/client` 的 import
- **THEN** 跳转到 `Envoy/packages/client/index.ts`，类型提示正常
