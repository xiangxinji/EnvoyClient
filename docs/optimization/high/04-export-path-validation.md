# 04 - export_history 路径无校验

## 问题描述

`export_history` 和 `import_history` 接受前端直接传入的路径，无安全校验。可将聊天记录导出到任意位置，或读取任意文件。

**风险等级**：高

## 涉及代码

- `src-tauri/src/history.rs:86-99` — `export_history`
- `src-tauri/src/history.rs:101-139` — `import_history`

## 详细整改方案

### 方案：限制在 home 目录下，禁止写入 ~/.envoy/

```rust
pub fn export_history(my_id: &str, peer_id: &str, target_path: &str) -> Result<(), String> {
    let src = history_file(my_id, peer_id).ok_or("Cannot determine home directory")?;
    if !src.exists() {
        return Err("No history file found".into());
    }

    let home = dirs::home_dir().ok_or("Cannot determine home directory")?;
    let target = std::path::Path::new(target_path);

    // 必须是绝对路径
    if !target.is_absolute() {
        return Err("Target path must be absolute".into());
    }

    // 规范化并检查在 home 目录下
    let parent = target.parent().ok_or("Invalid target path")?;
    if !parent.exists() {
        return Err("Target directory does not exist".into());
    }
    let canonical_parent = parent.canonicalize().map_err(|e| e.to_string())?;
    let file_name = target.file_name().ok_or("Invalid target path")?;
    let target_canonical = canonical_parent.join(file_name);

    let home_str = home.to_string_lossy();
    let target_str = target_canonical.to_string_lossy();
    let home_clean = home_str.strip_prefix(r"\\?\").unwrap_or(&home_str);
    let target_clean = target_str.strip_prefix(r"\\?\").unwrap_or(&target_str);

    if !target_clean.starts_with(home_clean) {
        return Err("Target path must be under user home directory".into());
    }

    // 禁止写入 ~/.envoy/ 内部
    let envoy_clean = home.join(".envoy").to_string_lossy()
        .strip_prefix(r"\\?\").unwrap_or("").to_string();
    // 这里简化比较，实际需规范化
    let envoy_path = format!("{}\\.envoy\\", home_clean.replace('/', "\\"));
    if target_clean.starts_with(&envoy_path) || target_clean.contains("\\.envoy\\") {
        return Err("Cannot export into ~/.envoy/ directory".into());
    }

    fs::copy(&src, &target_canonical).map_err(|e| e.to_string())?;
    Ok(())
}
```

`import_history` 同理，校验 `source_path` 必须在 home 目录下。

## 验证方法

1. `export_history(..., "C:\\Windows\\test.json")` → 拒绝
2. `export_history(..., "~/Desktop/chat.json")` → 正常
3. `import_history(..., "/etc/passwd")` → 拒绝
4. `import_history(..., "~/Documents/chat.json")` → 正常
