# Enterprise Screenshot System (DXGI + Tauri v2)

## Objective

为 AI Desktop Assistant 实现一套企业级截图系统。

目标产品体验对标：

* 微信截图
* QQ截图
* Snipaste
* PixPin

要求：

* 秒开截图
* 多显示器支持
* 高 DPI 支持
* AI 聊天集成
* 可扩展 OCR
* 可扩展录屏
* 可扩展 Computer Use

禁止实现 Demo 级方案。

---

# Current Tech Stack

Frontend:

```text
Vue3
TypeScript
```

Desktop:

```text
Tauri v2
```

Backend:

```text
Rust
```

Operating System:

```text
Windows 10
Windows 11
```

---

# Product Scenario

当前产品是 AI Desktop Assistant。

界面结构：

```text
┌────────────────────────────┐
│ Chat History               │
│                            │
├────────────────────────────┤
│ Input Box                  │
│                            │
│ [📎] [📷 Screenshot] [Send] │
└────────────────────────────┘
```

截图按钮位于聊天输入框工具栏。

用户流程：

```text
点击截图按钮
↓
进入截图模式
↓
框选区域
↓
生成截图
↓
自动插入聊天输入区
↓
发送给AI
```

---

# Core Requirements

## Performance

目标：

```text
进入截图模式 < 100ms

区域裁剪 < 30ms

图片生成 < 20ms

总耗时 < 150ms
```

---

## Memory

避免：

```text
Base64大图传输

频繁创建窗口

频繁初始化DXGI

频繁初始化D3D11
```

---

# Mandatory Technical Solution

必须使用：

```text
DXGI Desktop Duplication API
```

允许：

```text
windows crate

windows-capture crate

Direct3D11

DXGI
```

如果封装库能力不足：

```text
直接调用Windows API
```

---

# Explicitly Forbidden

禁止：

```text
截图时创建WebViewWindow

截图时创建浏览器实例

截图时Base64传输图片

截图时写临时文件

截图时GDI BitBlt全屏抓取

截图时重新初始化DXGI
```

---

# Architecture Principles

截图系统不是独立功能。

而是：

```text
Screen Capture Infrastructure
```

未来服务于：

```text
Screenshot

OCR

Recording

Computer Use

Screen Understanding

Visual Agent
```

要求统一底层能力。

---

# System Architecture

```text
capture
│
├── desktop_duplication.rs
│
├── monitor_manager.rs
│
├── frame_pool.rs
│
├── screenshot_service.rs
│
├── image_cropper.rs
│
├── clipboard.rs
│
├── overlay_window.rs
│
└── tauri_commands.rs
```

---

# Module Responsibilities

## desktop_duplication.rs

负责：

```text
初始化DXGI

初始化D3D11

获取Desktop Duplication

持续获取Frame

维护Latest Frame
```

要求：

应用启动时初始化。

不能等用户点击截图再初始化。

---

## frame_pool.rs

负责：

```text
Frame缓存

Frame复用

纹理生命周期管理
```

避免：

```text
频繁申请显存

频繁释放显存
```

---

## monitor_manager.rs

负责：

```text
显示器枚举

虚拟桌面计算

DPI计算

坐标转换
```

支持：

```text
单屏

双屏

三屏

混合分辨率

混合DPI
```

---

## overlay_window.rs

负责：

```text
全屏透明覆盖层

鼠标框选

高亮区域

截图工具栏
```

要求：

```text
AlwaysOnTop

Transparent

Borderless

SkipTaskbar

NonResizable

NonMovable
```

禁止拖动。

禁止缩放。

---

## image_cropper.rs

负责：

```text
Frame裁剪

GPU裁剪

图片编码
```

优先：

```text
GPU裁剪
```

避免：

```text
全量CPU拷贝
```

---

## screenshot_service.rs

负责：

```text
开始截图

结束截图

返回结果
```

作为统一入口。

---

# Capture Lifecycle

应用启动：

```text
App Start
↓
Initialize D3D11
↓
Initialize DXGI
↓
Initialize Desktop Duplication
↓
Start Capture Loop
↓
Maintain Latest Frame
```

---

截图：

```text
User Click Screenshot
↓
Show Overlay
↓
Select Region
↓
Read Latest Frame
↓
Crop
↓
Encode
↓
Return Result
```

禁止：

```text
User Click Screenshot
↓
Start DXGI
↓
Capture Screen
```

---

# Overlay Design

必须实现：

```text
微信截图体验
```

流程：

```text
显示Overlay
↓
桌面变暗
↓
鼠标拖拽
↓
实时显示选区
↓
显示尺寸信息
↓
确认截图
```

---

# Multi Monitor

支持：

```text
Monitor1
2560x1440

Monitor2
3840x2160

Monitor3
1920x1080
```

统一坐标系：

```text
Virtual Desktop Space
```

例如：

```text
(-1920,0)
(0,0)
(3840,0)
```

要求给出完整实现。

---

# DPI Handling

支持：

```text
100%

125%

150%

175%

200%
```

要求：

鼠标框选区域与实际裁剪区域严格一致。

必须考虑：

```text
Logical Pixel

Physical Pixel
```

提供换算公式。

---

# Image Encoding

支持：

```text
PNG

JPEG

WEBP
```

默认：

```text
PNG
```

要求：

无临时文件。

直接内存返回。

---

# Clipboard Integration

支持：

```text
Ctrl+C

自动复制

右键复制

拖拽上传
```

要求：

直接写入系统剪贴板。

---

# Tauri Integration

提供：

```rust
#[tauri::command]
start_screenshot()

#[tauri::command]
cancel_screenshot()

#[tauri::command]
get_screenshot_result()
```

并给出完整调用链。

---

# Frontend Integration

禁止：

```text
Base64
```

使用：

```typescript
Blob

ObjectURL

Uint8Array
```

返回结构：

```typescript
interface ScreenshotResult {
  id: string
  width: number
  height: number
  mimeType: string
  bytes: Uint8Array
}
```

---

# Future Extension

架构必须兼容：

```text
OCR

GIF录制

录屏

Computer Use

Screen Understanding

Visual Agent

滚动截图
```

不允许未来重构底层采集系统。

---

# Error Recovery

必须处理：

```text
显示器热插拔

分辨率变化

DPI变化

DXGI设备丢失

显卡驱动重启

窗口失焦
```

提供自动恢复策略。

---

# Expected Output

请输出：

1. 完整架构设计
2. Rust目录结构
3. DXGI实现
4. D3D11实现
5. Overlay实现
6. 多显示器实现
7. DPI适配
8. GPU裁剪实现
9. 剪贴板实现
10. Tauri集成
11. Vue集成
12. 性能优化方案
13. 错误恢复机制
14. 最终推荐生产级代码

要求：

不要生成Demo代码。

所有设计必须符合企业级产品标准。