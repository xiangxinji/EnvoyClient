use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;

fn envoy_history_dir() -> Option<PathBuf> {
    dirs::home_dir().map(|h| h.join(".envoy").join("history"))
}

fn user_history_dir(my_id: &str) -> Option<PathBuf> {
    envoy_history_dir().map(|h| h.join(my_id))
}

fn history_file(my_id: &str, peer_id: &str) -> Option<PathBuf> {
    user_history_dir(my_id).map(|d| d.join(format!("{peer_id}.json")))
}

pub fn save_message(my_id: &str, peer_id: &str, message: serde_json::Value) -> Result<(), String> {
    let path = history_file(my_id, peer_id).ok_or("Cannot determine home directory")?;

    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }

    let mut messages: Vec<serde_json::Value> = if path.exists() {
        let data = fs::read_to_string(&path).map_err(|e| e.to_string())?;
        serde_json::from_str(&data).unwrap_or_default()
    } else {
        vec![]
    };

    messages.push(message);

    let json = serde_json::to_string_pretty(&messages).map_err(|e| e.to_string())?;
    fs::write(&path, json).map_err(|e| e.to_string())?;

    Ok(())
}

pub fn load_history(my_id: &str, peer_id: &str) -> Result<Vec<serde_json::Value>, String> {
    let path = history_file(my_id, peer_id).ok_or("Cannot determine home directory")?;

    if !path.exists() {
        return Ok(vec![]);
    }

    let data = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let messages: Vec<serde_json::Value> = serde_json::from_str(&data).unwrap_or_default();
    Ok(messages)
}

pub fn load_all_history(my_id: &str) -> Result<HashMap<String, Vec<serde_json::Value>>, String> {
    let dir = user_history_dir(my_id).ok_or("Cannot determine home directory")?;

    if !dir.exists() {
        return Ok(HashMap::new());
    }

    let mut result = HashMap::new();

    let entries = fs::read_dir(&dir).map_err(|e| e.to_string())?;
    for entry in entries {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();

        if path.extension().and_then(|e| e.to_str()) == Some("json") {
            let stem = path.file_stem().and_then(|s| s.to_str()).unwrap_or("");
            let data = fs::read_to_string(&path).map_err(|e| e.to_string())?;
            let messages: Vec<serde_json::Value> = serde_json::from_str(&data).unwrap_or_default();
            result.insert(stem.to_string(), messages);
        }
    }

    Ok(result)
}

pub fn export_history(my_id: &str, peer_id: &str, target_path: &str) -> Result<(), String> {
    let src = history_file(my_id, peer_id).ok_or("Cannot determine home directory")?;

    if !src.exists() {
        return Err("No history file found for this conversation".into());
    }

    if let Some(parent) = std::path::Path::new(target_path).parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }

    fs::copy(&src, target_path).map_err(|e| e.to_string())?;
    Ok(())
}

pub fn import_history(my_id: &str, peer_id: &str, source_path: &str) -> Result<(), String> {
    let data = fs::read_to_string(source_path).map_err(|e| e.to_string())?;
    let imported: Vec<serde_json::Value> = serde_json::from_str(&data)
        .map_err(|e| format!("Invalid JSON: {e}"))?;

    let existing = load_history(my_id, peer_id)?;

    let existing_ids: std::collections::HashSet<String> = existing
        .iter()
        .filter_map(|m| m.get("id").and_then(|v| v.as_str()).map(String::from))
        .collect();

    let mut merged = existing;

    for msg in imported {
        let is_dup = msg
            .get("id")
            .and_then(|v| v.as_str())
            .map(|id| existing_ids.contains(id))
            .unwrap_or(false);

        if !is_dup {
            merged.push(msg);
        }
    }

    merged.sort_by_key(|m| m.get("timestamp").and_then(|v| v.as_i64()).unwrap_or(0));

    let path = history_file(my_id, peer_id).ok_or("Cannot determine home directory")?;

    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }

    let json = serde_json::to_string_pretty(&merged).map_err(|e| e.to_string())?;
    fs::write(&path, json).map_err(|e| e.to_string())?;

    Ok(())
}
