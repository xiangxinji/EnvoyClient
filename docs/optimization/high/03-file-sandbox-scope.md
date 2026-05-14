# 03 - file_read/write 沙箱范围过大

## 问题描述

`resolve_safe_path` 只限制在 home 目录（`~`），前端可读写 `~/.ssh/`、`~/.bashrc` 等敏感文件。设计意图是限制在 `~/.envoy/`。

**风险等级**：高 — 敏感文件泄露/篡改

## 涉及代码

- `src-tauri/src/lib.rs:12-70` — `resolve_safe_path`
- 关键行：`if !canonical_clean.starts_with(home_clean)` 只检查了 home 前缀

## 详细整改方案

### 方案：沙箱收窄到 ~/.envoy/

```rust
fn resolve_safe_path(path: &str) -> Result<PathBuf, serde_json::Value> {
    let home = dirs::home_dir().ok_or_else(|| {
        serde_json::json!({ "error": "Cannot determine home directory" })
    })?;

    let sandbox = home.join(".envoy");

    let expanded = if path.starts_with("~/") {
        home.join(&path[2..])
    } else if path == "~" {
        sandbox.clone()
    } else {
        PathBuf::from(path)
    };

    let canonical = /* ... 现有的规范化逻辑不变 ... */;

    // 改为检查 ~/.envoy/ 前缀（原来检查 home 前缀）
    let sandbox_canonical = sandbox.canonicalize().unwrap_or_else(|_| sandbox.clone());
    let sandbox_str = sandbox_canonical.to_string_lossy();
    let canonical_str = canonical.to_string_lossy();

    let sandbox_clean = sandbox_str.strip_prefix(r"\\?\").unwrap_or(&sandbox_str);
    let canonical_clean = canonical_str.strip_prefix(r"\\?\").unwrap_or(&canonical_str);

    if !canonical_clean.starts_with(sandbox_clean) {
        return Err(serde_json::json!({
            "error": "Path outside allowed directory (~/.envoy/)"
        }));
    }

    Ok(canonical)
}
```

同时更新 Agent 工具描述：

```typescript
// src/agent/tools.ts
{
  name: "file_read",
  description: "Read file content. Only files under ~/.envoy/ are accessible.",
  // ...
}
```

## 验证方法

1. `file_read("~/.ssh/id_rsa")` → 拒绝
2. `file_read("~/.envoy/settings.json")` → 正常
3. `file_write("~/.bashrc", "test")` → 拒绝
4. `file_write("~/.envoy/test.txt", "ok")` → 正常
