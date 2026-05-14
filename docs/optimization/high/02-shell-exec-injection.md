# 02 - shell_exec 命令注入风险

## 问题描述

`src-tauri/src/lib.rs` 的 `shell_exec` 直接执行前端传入的任意命令，无过滤。Agent AI 被诱导时可执行危险命令。

**风险等级**：高 — 本地代码执行

## 影响范围

调用链：AI Agent → tool_call shell → invoke("shell_exec") → Rust Command

## 涉及代码

- `src-tauri/src/lib.rs:224-238`
- `src/agent/tools.ts` — shell 工具定义
- `src/agent/react.ts` — ReAct 循环

## 详细整改方案

### 方案：命令黑名单 + 工作目录限制

#### 步骤 1：添加命令校验

```rust
// src-tauri/src/shell.rs
const BLOCKED: &[&str] = &[
    "rm", "rmdir", "del", "format",
    "shutdown", "reboot",
    "reg", "regedit",
    "net user", "net localgroup",
];

pub fn validate_command(command: &str) -> Result<(), String> {
    let lower = command.to_lowercase();
    for blocked in BLOCKED {
        if lower.contains(blocked) {
            return Err(format!("Command blocked: contains '{}'", blocked));
        }
    }
    if lower.contains("| sh") || lower.contains("| bash") || lower.contains("| cmd") {
        return Err("Pipe to shell not allowed".into());
    }
    Ok(())
}
```

#### 步骤 2：限制工作目录

```rust
#[tauri::command]
pub fn shell_exec(command: String, working_dir: Option<String>) -> Result<serde_json::Value, String> {
    validate_command(&command)?;

    let workspace = working_dir
        .or_else(|| std::env::var("ENVOY_WORKSPACE").ok())
        .or_else(|| dirs::home_dir().map(|h| h.join(".envoy/workspace").to_str().unwrap().to_string()));

    let mut cmd = if cfg!(target_os = "windows") {
        let mut c = Command::new("cmd");
        c.args(["/C", &command]);
        c
    } else {
        let mut c = Command::new("sh");
        c.arg("-c").arg(&command);
        c
    };

    if let Some(dir) = &workspace {
        cmd.current_dir(dir);
    }

    let output = cmd.output().map_err(|e| e.to_string())?;
    // ...返回结果
}
```

#### 步骤 3：前端传递工作目录

```typescript
// src/agent/tools.ts
execute: async (args) => {
  const result = await invoke("shell_exec", {
    command: args.command,
    workingDir: workspaceDir,
  });
}
```

## 验证方法

1. `rm -rf /tmp/test` → blocked
2. `echo hello` → 正常
3. `curl ... | sh` → blocked
