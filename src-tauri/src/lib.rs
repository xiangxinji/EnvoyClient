mod brains;
mod credentials;
mod history;
mod settings;

use std::collections::HashMap;
use std::process::Command;

/// Resolve a path string to a safe absolute path within the user's home directory.
/// Expands `~` to home dir, canonicalizes (resolving `..` and symlinks),
/// and verifies the result is inside the home directory.
fn resolve_safe_path(path: &str) -> Result<std::path::PathBuf, serde_json::Value> {
    let home = dirs::home_dir().ok_or_else(|| {
        serde_json::json!({ "error": "Cannot determine home directory" })
    })?;

    let expanded = if path.starts_with("~/") {
        home.join(&path[2..])
    } else if path == "~" {
        home.clone()
    } else {
        std::path::PathBuf::from(path)
    };

    // For non-existent paths, canonicalize won't work, so resolve the parent
    // and append the file name. For existent paths, canonicalize directly.
    let canonical = if expanded.exists() {
        expanded
            .canonicalize()
            .map_err(|e| serde_json::json!({ "error": format!("Failed to resolve path: {}", e) }))?
    } else {
        // Resolve parent if it exists, then append the final component
        let file_name = expanded
            .file_name()
            .ok_or_else(|| serde_json::json!({ "error": "Invalid path" }))?;
        let parent = expanded.parent().ok_or_else(|| {
            serde_json::json!({ "error": "Invalid path" })
        })?;

        if parent.as_os_str().is_empty() {
            // Relative path with no parent — treat as relative to cwd, reject
            return Err(serde_json::json!({ "error": "Path outside allowed directory" }));
        }

        let canonical_parent = if parent.exists() {
            parent.canonicalize().map_err(|e| {
                serde_json::json!({ "error": format!("Failed to resolve path: {}", e) })
            })?
        } else {
            return Err(serde_json::json!({ "error": "Parent directory does not exist" }));
        };

        canonical_parent.join(file_name)
    };

    let canonical_str = canonical.to_string_lossy();
    let home_str = home.to_string_lossy();

    // On Windows, canonicalize returns UNC prefix (\\?\), strip it for comparison
    let canonical_clean = canonical_str
        .strip_prefix(r"\\?\")
        .unwrap_or(&canonical_str);
    let home_clean = home_str.strip_prefix(r"\\?\").unwrap_or(&home_str);

    if !canonical_clean.starts_with(home_clean) {
        return Err(serde_json::json!({ "error": "Path outside allowed directory" }));
    }

    Ok(canonical)
}

#[tauri::command]
fn file_read(path: String) -> Result<serde_json::Value, String> {
    let safe_path = resolve_safe_path(&path).map_err(|v| {
        serde_json::to_string(&v).unwrap_or_else(|_| r#"{"error":"Unknown error"}"#.to_string())
    })?;

    if !safe_path.exists() {
        return Err(
            serde_json::to_string(&serde_json::json!({ "error": "File not found" }))
                .unwrap_or_else(|_| r#"{"error":"File not found"}"#.to_string()),
        );
    }

    // Read first 8KB to check for binary content
    let mut file = std::fs::File::open(&safe_path).map_err(|e| e.to_string())?;
    let mut probe = [0u8; 8192];
    let bytes_read = std::io::Read::read(&mut file, &mut probe).map_err(|e| e.to_string())?;

    if probe[..bytes_read].contains(&0) {
        return Err(
            serde_json::to_string(&serde_json::json!({ "error": "Cannot read binary file" }))
                .unwrap_or_else(|_| r#"{"error":"Cannot read binary file"}"#.to_string()),
        );
    }

    let content = std::fs::read_to_string(&safe_path).map_err(|e| e.to_string())?;
    Ok(serde_json::json!({ "content": content }))
}

#[tauri::command]
fn file_write(path: String, content: String) -> Result<serde_json::Value, String> {
    let safe_path = resolve_safe_path(&path).map_err(|v| {
        serde_json::to_string(&v).unwrap_or_else(|_| r#"{"error":"Unknown error"}"#.to_string())
    })?;

    // Ensure parent directory exists
    if let Some(parent) = safe_path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    std::fs::write(&safe_path, &content).map_err(|e| e.to_string())?;
    Ok(serde_json::json!({ "success": true }))
}

#[tauri::command]
fn save_message(my_id: &str, peer_id: &str, message: serde_json::Value) -> Result<(), String> {
    history::save_message(my_id, peer_id, message)
}

#[tauri::command]
fn load_history(my_id: &str, peer_id: &str) -> Result<Vec<serde_json::Value>, String> {
    history::load_history(my_id, peer_id)
}

#[tauri::command]
fn load_all_history(
    my_id: &str,
) -> Result<HashMap<String, Vec<serde_json::Value>>, String> {
    history::load_all_history(my_id)
}

#[tauri::command]
fn export_history(my_id: &str, peer_id: &str, target_path: &str) -> Result<(), String> {
    history::export_history(my_id, peer_id, target_path)
}

#[tauri::command]
fn import_history(my_id: &str, peer_id: &str, source_path: &str) -> Result<(), String> {
    history::import_history(my_id, peer_id, source_path)
}

#[tauri::command]
fn delete_history(my_id: &str, peer_id: &str) -> Result<(), String> {
    history::delete_history(my_id, peer_id)
}

#[tauri::command]
fn get_settings() -> Result<serde_json::Value, String> {
    settings::get_settings()
}

#[tauri::command]
fn save_settings(settings: serde_json::Value) -> Result<(), String> {
    settings::save_settings(settings)
}

#[tauri::command]
fn init_workspace(username: String) -> Result<serde_json::Value, String> {
    let home = dirs::home_dir().ok_or("Cannot determine home directory")?;
    let workspace_dir = home.join(".envoy").join("workspace").join(&username);
    if !workspace_dir.exists() {
        std::fs::create_dir_all(&workspace_dir).map_err(|e| e.to_string())?;
    }
    Ok(serde_json::json!({ "workspace_dir": workspace_dir.to_string_lossy() }))
}

/// Parse YAML-like frontmatter from a markdown file.
/// Returns a map of key-value pairs from the `---` delimited block.
fn parse_frontmatter(content: &str) -> HashMap<String, String> {
    let mut map = HashMap::new();
    let trimmed = content.trim_start();
    if !trimmed.starts_with("---") {
        return map;
    }
    let rest = &trimmed[3..];
    let end = rest.find("---").unwrap_or(rest.len());
    for line in rest[..end].lines() {
        let line = line.trim();
        if line.is_empty() || line.starts_with('#') {
            continue;
        }
        if let Some((k, v)) = line.split_once(':') {
            let key = k.trim().to_string();
            let val = v.trim().trim_matches('"').trim_matches('\'').to_string();
            map.insert(key, val);
        }
    }
    map
}

#[tauri::command]
fn load_skill_catalog(username: String) -> Result<serde_json::Value, String> {
    let home = dirs::home_dir().ok_or("Cannot determine home directory")?;
    let skills_dir = home.join(".envoy").join("brains").join(&username).join("skills");

    if !skills_dir.exists() {
        return Ok(serde_json::json!({ "skills": [] }));
    }

    let mut skills = Vec::new();
    let entries = std::fs::read_dir(&skills_dir).map_err(|e| e.to_string())?;

    for entry in entries {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        if path.extension().and_then(|e| e.to_str()) != Some("md") {
            continue;
        }
        let filename = path.file_stem().and_then(|s| s.to_str()).unwrap_or("").to_string();
        let content = match std::fs::read_to_string(&path) {
            Ok(c) => c,
            Err(_) => continue,
        };
        let fm = parse_frontmatter(&content);
        skills.push(serde_json::json!({
            "name": fm.get("name").cloned().unwrap_or_else(|| filename.clone()),
            "description": fm.get("description").cloned().unwrap_or_default(),
            "filename": filename,
        }));
    }

    Ok(serde_json::json!({ "skills": skills }))
}

#[tauri::command]
fn shell_exec(command: String) -> Result<serde_json::Value, String> {
    let output = if cfg!(target_os = "windows") {
        Command::new("cmd").args(["/C", &command]).output()
    } else {
        Command::new("sh").arg("-c").arg(&command).output()
    }
    .map_err(|e| e.to_string())?;

    Ok(serde_json::json!({
        "stdout": String::from_utf8_lossy(&output.stdout).to_string(),
        "stderr": String::from_utf8_lossy(&output.stderr).to_string(),
        "exit_code": output.status.code().unwrap_or(-1),
    }))
}


#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            save_message,
            load_history,
            load_all_history,
            delete_history,
            export_history,
            import_history,
            get_settings,
            save_settings,
            shell_exec,
            file_read,
            file_write,
            brains::init_brains,
            init_workspace,
            load_skill_catalog,
            credentials::get_credential,
            credentials::save_credential,
            credentials::delete_credential,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
