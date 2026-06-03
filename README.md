# EnvoyClient 使用指南

团队 AI Agent 协作桌面客户端。

---

## 项目结构

这是一个由根仓库协调多个子项目的桌面应用：

| 路径 | 说明 |
|------|------|
| `src/` | Tauri 桌面客户端前端（Vue） |
| `src-tauri/` | Tauri/Rust 桌面壳和本地能力 |
| `manager/` | 管理后台，包含 `server/` 后端和 `web/` 前端 |
| `envoy/` | Envoy 协作通信库子模块 |
| `website/` | 官网和文档站子模块 |
| `openspec/` | 功能规格和变更记录 |
| `docs/` | 架构和补充文档 |

`envoy`、`manager`、`website` 是 Git submodule，首次拉取后需要初始化。

---

## 安装

### 你需要先安装

1. **Node.js**（>= 18）— [下载地址](https://nodejs.org/)
2. **Rust** — [下载地址](https://rustup.rs/)
3. **Git** — [下载地址](https://git-scm.com/)

> 构建 `website/` 文档站需要 Node.js >= 22.12.0；只运行桌面客户端和管理后台时 Node.js >= 18 即可。

### 下载项目

打开终端，运行：

```bash
git clone https://github.com/xiangxinji/EnvoyClient.git
cd EnvoyClient
git submodule update --init --recursive
```

### 安装依赖

```bash
npm run all:install
```

等待安装完成即可。

---

## 启动

你需要打开 **两个终端窗口**。

### 终端 1：启动管理后台

```bash
npm run manager
```

启动成功后会看到：
- 后端 API 运行在 `http://localhost:8080`
- 管理前端运行在 `https://localhost:5180`

### 终端 2：启动桌面客户端

```bash
npm run tauri:dev
```

首次启动需要编译 Rust，请耐心等待。之后再次启动会很快。

---

## 使用步骤

### 一、配置 AI（管理员操作）

首次使用需要先配置 AI，否则聊天和任务分派功能无法使用。

1. 浏览器打开 `https://localhost:5180`
2. 使用默认管理员账号登录：
   - 用户名：`admin`
   - 密码：`admin123`
3. 进入 **Settings**（设置）页面
4. 添加 AI Provider：
   - 选择服务商（OpenAI / Anthropic / Google / DeepSeek）
   - 填写对应的 API Key
   - 保存配置
5. 可以为不同场景选择不同的模型（聊天、任务分派、Agent 执行等）

### 二、创建用户（管理员操作）

1. 在管理后台进入 **Users**（用户）页面
2. 点击创建用户
3. 填写用户名、密码，选择角色：
   - **Leader**（领导者）— 可以分派任务、审批任务结果
   - **Member**（成员）— 接收并执行任务

### 三、创建团队（管理员操作）

1. 进入 **Teams**（团队）页面
2. 点击创建团队，输入团队名称
3. 进入团队详情，添加成员到团队中

### 四、客户端登录

1. 打开桌面客户端
2. 填写信息：
   - **Manager URL**：`http://localhost:8080`（默认已填好）
   - **用户名**：管理员为你创建的账号
   - **密码**：对应的密码
3. 点击 **登录**
4. 登录成功后，从下拉列表选择你的团队
5. 点击 **连接**，进入主界面

### 五、日常使用

#### 聊天

- 左侧边栏显示团队成员列表
- 点击某个成员，右侧打开 1:1 对话窗口
- 输入消息，按回车或点击发送
- 支持 Markdown 格式消息、文件下载、消息撤回

#### 分派任务（Leader）

1. 左侧边栏点击 **分派任务**
2. 输入任务描述（用自然语言描述你想做什么）
3. 点击 **AI 分派**，系统会自动分析并匹配合适的成员
4. 确认匹配结果，点击发送
5. 任务会自动下发到对应成员

也可以手动选择目标成员来分派任务。

#### 接收任务（Member）

当 Leader 分派任务给你时：

- **自动模式**（默认）：收到任务后，本地 AI Agent 会自动执行（读取文件、运行命令等），执行完毕后自动提交结果
- **手动模式**：收到任务后需要你手动点击执行

可以在 **设置** 面板中切换执行模式。

#### 审批任务（Leader）

串行任务（按顺序逐个执行的任务）全部完成后，会自动进入审批阶段：

1. 左侧边栏点击 **任务中心**
2. 在 **审核中** 分组查看待审批任务
3. 点击任务查看详情，包括每个成员的执行过程和结果
4. 点击 **通过**（任务完成）或 **驳回**（任务会重新分派给所有成员）

#### 查看任务

左侧边栏点击 **任务中心**，可以看到所有任务，按状态分组：

| 状态 | 含义 |
|------|------|
| 运行中 | 正在执行的任务 |
| 待执行 | 等待 Member 处理 |
| 审核中 | 等待 Leader 审批 |
| 已完成 | 审批通过的任务 |
| 失败 | 执行失败的任务 |

---

## 成员设置

点击左侧边栏底部的 **设置** 按钮，可以配置：

| 设置 | 说明 | 默认值 |
|------|------|--------|
| 任务执行模式 | `auto` 自动执行 / `manual` 手动触发 | auto |
| AI 自动回复 | 开启后收到消息会自动生成 AI 回复 | 关闭 |
| 工作目录 | Agent 执行命令时的根目录 | — |
| AI 建议上下文条数 | AI 回复参考的历史消息数量 | 5 |

---

## 其他命令

```bash
# 启动桌面前端（不启动 Tauri 壳）
npm run dev

# 仅启动管理后台后端
npm run manager:server

# 仅启动管理后台前端
npm run manager:web

# 启动文档站
npm run website:dev

# 构建桌面前端
npm run build

# 构建桌面安装包
npm run tauri build

# 运行 Envoy 库测试
npm run envoy:test

# 运行管理后台后端测试
npm run manager:server:test
```

### 管理后台环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `MANAGER_PORT` | 管理后台 API 端口 | `8080` |
| `MANAGER_CORS_ORIGINS` | 允许访问 API 的来源，多个值用逗号分隔 | 开发环境允许本地 Vite/Tauri 来源；生产环境允许 Tauri 本地来源 |
| `ENVOY_TEAM_HOST` | 团队 WebSocket 服务监听地址 | 开发环境 `0.0.0.0`，生产环境 `127.0.0.1` |
| `ENVOY_DEFAULT_ADMIN_USERNAME` | 首次初始化默认管理员用户名 | `admin` |
| `ENVOY_DEFAULT_ADMIN_PASSWORD` | 首次初始化默认管理员密码 | `admin123` |

## 数据位置

所有数据保存在用户目录下的 `.envoy` 文件夹中：

```
~/.envoy/
├── manager.json      # 管理后台设置和 AI 配置
├── users.json        # 用户账号
├── settings.json     # 客户端个人设置
├── history/          # 聊天记录
├── teams/            # 团队数据（消息、任务、附件）
└── brains/           # Agent 记忆和技能
```
