use std::fs;
use std::io::{Read, Write};
use std::path::Path;
use std::time::SystemTime;
use base64::Engine;
use tauri::Manager;

fn brains_dir(username: &str) -> Result<std::path::PathBuf, String> {
    Ok(dirs::home_dir()
        .ok_or("Cannot determine home directory")?
        .join(".envoy")
        .join("brains")
        .join(username))
}

fn to_millis(t: SystemTime) -> Result<u64, String> {
    t.duration_since(SystemTime::UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn init_brains(app_handle: tauri::AppHandle, username: &str) -> Result<serde_json::Value, String> {
    let resource_dir = app_handle
        .path()
        .resource_dir()
        .map_err(|e| e.to_string())?;
    let template_dir = resource_dir.join("brains");

    let dest_dir = dirs::home_dir()
        .ok_or("Cannot determine home directory")?
        .join(".envoy")
        .join("brains")
        .join(username);

    fs::create_dir_all(&dest_dir).map_err(|e| e.to_string())?;

    if template_dir.exists() {
        copy_dir_recursive(&template_dir, &dest_dir)?;
    }

    Ok(serde_json::json!({
        "brains_dir": dest_dir.to_string_lossy().to_string()
    }))
}

fn copy_dir_recursive(src: &Path, dest: &Path) -> Result<(), String> {
    if !src.is_dir() {
        return Ok(());
    }

    let entries = fs::read_dir(src).map_err(|e| e.to_string())?;
    for entry in entries {
        let entry = entry.map_err(|e| e.to_string())?;
        let src_path = entry.path();
        let file_name = src_path
            .file_name()
            .ok_or("Invalid file name")?
            .to_string_lossy()
            .to_string();
        let dest_path = dest.join(&file_name);

        if src_path.is_dir() {
            fs::create_dir_all(&dest_path).map_err(|e| e.to_string())?;
            copy_dir_recursive(&src_path, &dest_path)?;
        } else {
            if !dest_path.exists() {
                if let Some(parent) = dest_path.parent() {
                    fs::create_dir_all(parent).map_err(|e| e.to_string())?;
                }
                fs::copy(&src_path, &dest_path).map_err(|e| e.to_string())?;
            }
        }
    }

    Ok(())
}

#[tauri::command]
pub async fn scan_brains_files(username: String) -> Result<serde_json::Value, String> {
    tokio::task::spawn_blocking(move || scan_brains_files_impl(&username)).await.map_err(|e| e.to_string())?
}

fn scan_brains_files_impl(username: &str) -> Result<serde_json::Value, String> {
    let base = brains_dir(username)?;
    if !base.exists() {
        return Ok(serde_json::json!({ "files": [] }));
    }

    let mut files = Vec::new();
    scan_dir_recursive(&base, &base, &mut files)?;
    Ok(serde_json::json!({ "files": files }))
}

fn scan_dir_recursive(
    base: &Path,
    current: &Path,
    results: &mut Vec<serde_json::Value>,
) -> Result<(), String> {
    let entries = fs::read_dir(current).map_err(|e| e.to_string())?;
    for entry in entries {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();

        if path.is_dir() {
            scan_dir_recursive(base, &path, results)?;
        } else {
            let metadata = entry.metadata().map_err(|e| e.to_string())?;
            let mtime_ms = to_millis(metadata.modified().map_err(|e| e.to_string())?)?;
            let size = metadata.len();
            let relative = path
                .strip_prefix(base)
                .map_err(|e| e.to_string())?
                .to_string_lossy()
                .replace('\\', "/");

            results.push(serde_json::json!({
                "path": relative,
                "mtime_ms": mtime_ms,
                "size": size,
            }));
        }
    }
    Ok(())
}

#[tauri::command]
pub async fn read_brains_file(username: String, path: String) -> Result<serde_json::Value, String> {
    tokio::task::spawn_blocking(move || read_brains_file_impl(username, path)).await.map_err(|e| e.to_string())?
}

fn read_brains_file_impl(username: String, path: String) -> Result<serde_json::Value, String> {
    let base = brains_dir(&username)?;
    if path.contains("..") {
        return Err("invalid path".to_string());
    }

    let full_path = base.join(&path);
    let canonical_base = base.canonicalize().unwrap_or_else(|_| base.clone());
    let canonical_full = full_path.canonicalize().unwrap_or_else(|_| full_path.clone());
    if !canonical_full.starts_with(&canonical_base) {
        return Err("invalid path".to_string());
    }

    let mut file = fs::File::open(&full_path).map_err(|e| e.to_string())?;
    let mut content = Vec::new();
    file.read_to_end(&mut content).map_err(|e| e.to_string())?;

    let encoded = base64::engine::general_purpose::STANDARD.encode(&content);
    Ok(serde_json::json!({ "content": encoded }))
}

/// Upload a single brains file directly to the server.
/// The entire read → encode → POST happens in Rust, never passing large payloads through JS.
#[tauri::command]
pub async fn upload_brains_file(
    username: String,
    path: String,
    mtime_ms: u64,
    size: u64,
    server_url: String,
    token: String,
    team: String,
) -> Result<serde_json::Value, String> {
    tokio::task::spawn_blocking(move || {
        upload_brains_file_impl(&username, &path, mtime_ms, size, &server_url, &token, &team)
    }).await.map_err(|e| e.to_string())?
}

fn upload_brains_file_impl(
    username: &str,
    path: &str,
    mtime_ms: u64,
    size: u64,
    server_url: &str,
    token: &str,
    team: &str,
) -> Result<serde_json::Value, String> {
    // Read and encode
    let base = brains_dir(username)?;
    if path.contains("..") {
        return Err("invalid path".to_string());
    }
    let full_path = base.join(path);
    let mut file = fs::File::open(&full_path).map_err(|e| e.to_string())?;
    let mut content = Vec::new();
    file.read_to_end(&mut content).map_err(|e| e.to_string())?;
    let encoded = base64::engine::general_purpose::STANDARD.encode(&content);

    // POST to server (blocking reqwest)
    let client = reqwest::blocking::Client::new();
    let body = serde_json::json!({
        "username": username,
        "files": [{ "path": path, "content": encoded, "mtime_ms": mtime_ms, "size": size }],
    });
    let url = format!("{}/api/brains/sync", server_url.trim_end_matches('/'));
    client
        .post(&url)
        .header("Content-Type", "application/json")
        .header("team", team)
        .header("X-Envoy-Token", token)
        .json(&body)
        .send()
        .map_err(|e| format!("Upload failed: {}", e))?;

    Ok(serde_json::json!({ "ok": true }))
}

#[tauri::command]
pub async fn restore_brains(username: String, files: Vec<serde_json::Value>) -> Result<serde_json::Value, String> {
    tokio::task::spawn_blocking(move || restore_brains_impl(username, files)).await.map_err(|e| e.to_string())?
}

fn restore_brains_impl(username: String, files: Vec<serde_json::Value>) -> Result<serde_json::Value, String> {
    let base = brains_dir(&username)?;
    fs::create_dir_all(&base).map_err(|e| e.to_string())?;

    let mut restored = 0u32;
    for entry in &files {
        let path = entry["path"].as_str().ok_or("Missing path field")?;
        if path.contains("..") {
            continue;
        }

        let full_path = base.join(path);
        if let Some(parent) = full_path.parent() {
            fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }

        let canonical_base = base.canonicalize().unwrap_or_else(|_| base.clone());
        let canonical_parent = full_path.parent()
            .unwrap_or(&base)
            .canonicalize()
            .unwrap_or_else(|_| base.clone());
        if !canonical_parent.starts_with(&canonical_base) {
            continue;
        }

        let content_b64 = entry["content"].as_str().ok_or("Missing content field")?;
        let decoded = base64::engine::general_purpose::STANDARD
            .decode(content_b64)
            .map_err(|e| format!("Base64 decode error: {}", e))?;
        fs::write(&full_path, decoded).map_err(|e| e.to_string())?;

        // Preserve original mtime
        if let Some(mtime_ms) = entry["mtime_ms"].as_u64() {
            let mtime = SystemTime::UNIX_EPOCH + std::time::Duration::from_millis(mtime_ms);
            let ft = filetime::FileTime::from_system_time(mtime);
            filetime::set_file_mtime(&full_path, ft).ok();
        }

        restored += 1;
    }

    Ok(serde_json::json!({ "restored": restored }))
}

/// Write (create or overwrite) a single file in the brains directory.
#[tauri::command]
pub async fn write_brains_file(username: String, path: String, content: String) -> Result<serde_json::Value, String> {
    tokio::task::spawn_blocking(move || write_brains_file_impl(&username, &path, &content)).await.map_err(|e| e.to_string())?
}

fn write_brains_file_impl(username: &str, path: &str, content: &str) -> Result<serde_json::Value, String> {
    let base = brains_dir(username)?;
    if path.contains("..") {
        return Err("invalid path".to_string());
    }

    let full_path = base.join(path);

    // Validate path stays within brains directory
    let canonical_base = base.canonicalize().unwrap_or_else(|_| base.clone());
    if let Some(parent) = full_path.parent() {
        // Ensure parent dir exists before canonicalizing
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        let canonical_parent = parent.canonicalize().unwrap_or_else(|_| parent.to_path_buf());
        if !canonical_parent.starts_with(&canonical_base) {
            return Err("invalid path".to_string());
        }
        // Write to canonical path to avoid TOCTOU issues
        let file_name = full_path.file_name().ok_or("invalid file name")?;
        let safe_path = canonical_parent.join(file_name);
        let mut file = fs::File::create(&safe_path).map_err(|e| e.to_string())?;
        file.write_all(content.as_bytes()).map_err(|e| e.to_string())?;
    } else {
        let mut file = fs::File::create(&full_path).map_err(|e| e.to_string())?;
        file.write_all(content.as_bytes()).map_err(|e| e.to_string())?;
    }

    Ok(serde_json::json!({ "success": true }))
}

/// Delete a single file from the brains directory.
#[tauri::command]
pub async fn delete_brains_file(username: String, path: String) -> Result<serde_json::Value, String> {
    tokio::task::spawn_blocking(move || delete_brains_file_impl(&username, &path)).await.map_err(|e| e.to_string())?
}

fn delete_brains_file_impl(username: &str, path: &str) -> Result<serde_json::Value, String> {
    let base = brains_dir(username)?;
    if path.contains("..") {
        return Err("invalid path".to_string());
    }

    let full_path = base.join(path);

    let canonical_base = base.canonicalize().unwrap_or_else(|_| base.clone());
    let canonical_full = full_path.canonicalize().unwrap_or_else(|_| full_path.clone());
    if !canonical_full.starts_with(&canonical_base) {
        return Err("invalid path".to_string());
    }

    if canonical_full.exists() {
        fs::remove_file(&canonical_full).map_err(|e| e.to_string())?;
    } else {
        return Err("file not found".to_string());
    }

    Ok(serde_json::json!({ "success": true }))
}
