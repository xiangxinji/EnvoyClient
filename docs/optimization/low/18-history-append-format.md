# 18 - 历史消息全量读写

## 问题描述

每次追加消息都全量读取→解析→追加→序列化→回写，消息量大时性能差。

## 涉及代码

- `src-tauri/src/history.rs:17-37`

## 详细整改方案

### 方案：改用 JSONL 追加格式

#### save_message 改为 append

```rust
pub fn save_message(my_id: &str, peer_id: &str, message: Value) -> Result<(), String> {
    let path = history_file(my_id, peer_id).ok_or("...")?;
    let jsonl_path = path.with_extension("jsonl");

    // 兼容旧 .json 格式迁移
    if path.exists() && !jsonl_path.exists() {
        migrate_json_to_jsonl(&path, &jsonl_path)?;
    }

    let mut line = serde_json::to_string(&message)? ;
    line.push('\n');

    let mut file = OpenOptions::new().create(true).append(true).open(&jsonl_path)?;
    file.write_all(line.as_bytes())?;
    Ok(())
}
```

#### load_history 逐行解析

```rust
pub fn load_history(my_id: &str, peer_id: &str) -> Result<Vec<Value>, String> {
    let path = history_file(my_id, peer_id).ok_or("...")?;
    let jsonl_path = path.with_extension("jsonl");

    // 兼容旧格式
    if path.exists() && !jsonl_path.exists() {
        let data = fs::read_to_string(&path)?;
        return serde_json::from_str(&data).map_err(|e| e.to_string());
    }

    let data = fs::read_to_string(&jsonl_path)?;
    Ok(data.lines()
        .filter(|l| !l.trim().is_empty())
        .filter_map(|l| serde_json::from_str(l).ok())
        .collect())
}
```

## 验证方法

1. 新对话 → 生成 `.jsonl`，每行一个 JSON
2. 旧 `.json` → 首次自动迁移
3. 1000 条消息 append 性能对比
