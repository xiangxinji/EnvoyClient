## ADDED Requirements

### Requirement: Installation guide display
下载页 SHALL 展示安装指南，帮助用户快速上手。

#### Scenario: Quick start command
- **WHEN** 用户访问下载页
- **THEN** 页面 SHALL 展示快速开始命令（`git clone` + `npm install` + `npm run tauri:dev`），以代码块形式呈现，带复制按钮

#### Scenario: Prerequisites
- **WHEN** 用户浏览安装指南
- **THEN** 页面 SHALL 列出前置依赖（Node.js 18+、Rust、系统依赖）

### Requirement: Platform support information
下载页 SHALL 说明支持的平台。

#### Scenario: Platform list
- **WHEN** 用户浏览下载页
- **THEN** 页面 SHALL 列出支持的平台（Windows、macOS、Linux），每个平台附带对应的构建命令

### Requirement: Build commands reference
下载页 SHALL 提供完整的构建命令参考。

#### Scenario: Command display
- **WHEN** 用户浏览构建命令区域
- **THEN** 页面 SHALL 以表格或列表形式展示所有构建命令（`npm run dev`、`npm run build`、`npm run tauri build`、`npm run manager` 等），每个命令附带说明

### Requirement: Download page i18n
下载页内容 SHALL 支持中英双语。

#### Scenario: Localized download page
- **WHEN** 用户切换语言
- **THEN** 下载页所有内容（标题、说明文字、平台名称、命令说明）SHALL 切换到对应语言
