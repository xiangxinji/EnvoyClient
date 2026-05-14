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

pub fn delete_history(my_id: &str, peer_id: &str) -> Result<(), String> {
    let path = history_file(my_id, peer_id).ok_or("Cannot determine home directory")?;

    if path.exists() {
        fs::remove_file(&path).map_err(|e| e.to_string())?;
    }

    Ok(())
}

/// Validate an external path is under user home directory.
/// Returns the canonicalized path on success.
fn validate_external_path(path: &str) -> Result<std::path::PathBuf, String> {
    let target = std::path::Path::new(path);
    if !target.is_absolute() {
        return Err("Path must be absolute".into());
    }

    let canonical = if target.exists() {
        target.canonicalize().map_err(|e| e.to_string())?
    } else {
        let file_name = target.file_name().ok_or("Invalid path")?;
        let parent = target.parent().ok_or("Invalid path")?;
        if !parent.exists() {
            return Err("Parent directory does not exist".into());
        }
        parent.canonicalize().map_err(|e| e.to_string())?.join(file_name)
    };

    let home = dirs::home_dir().ok_or("Cannot determine home directory")?;
    let home_canonical = home.canonicalize().unwrap_or(home);

    let canonical_str = canonical.to_string_lossy();
    let home_str = home_canonical.to_string_lossy();
    let canonical_clean = canonical_str.strip_prefix(r"\\?\").unwrap_or(&canonical_str);
    let home_clean = home_str.strip_prefix(r"\\?\").unwrap_or(&home_str);

    if !canonical_clean.starts_with(home_clean) {
        return Err("Path must be under user home directory".into());
    }

    Ok(canonical)
}

pub fn export_history(my_id: &str, peer_id: &str, target_path: &str) -> Result<(), String> {
    let src = history_file(my_id, peer_id).ok_or("Cannot determine home directory")?;

    if !src.exists() {
        return Err("No history file found for this conversation".into());
    }

    let canonical_target = validate_external_path(target_path)?;

    if let Some(parent) = canonical_target.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }

    fs::copy(&src, &canonical_target).map_err(|e| e.to_string())?;
    Ok(())
}

pub fn import_history(my_id: &str, peer_id: &str, source_path: &str) -> Result<(), String> {
    let canonical_source = validate_external_path(source_path)?;

    let data = fs::read_to_string(&canonical_source).map_err(|e| e.to_string())?;
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
