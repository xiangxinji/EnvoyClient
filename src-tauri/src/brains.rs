use std::collections::hash_map::DefaultHasher;
use std::fs;
use std::hash::{Hash, Hasher};
use std::io::Read;
use std::path::Path;
use tauri::Manager;

fn brains_dir(username: &str) -> Result<std::path::PathBuf, String> {
    Ok(dirs::home_dir()
        .ok_or("Cannot determine home directory")?
        .join(".envoy")
        .join("brains")
        .join(username))
}

fn compute_hash(content: &[u8]) -> String {
    let mut hasher = DefaultHasher::new();
    content.hash(&mut hasher);
    format!("{:016x}", hasher.finish())
}

fn is_hidden(name: &str) -> bool {
    name.starts_with('.') && name != "."
}

#[tauri::command]
pub fn init_brains(app_handle: tauri::AppHandle, username: &str) -> Result<serde_json::Value, String> {
    // 1. Get resource directory and build template path
    let resource_dir = app_handle
        .path()
        .resource_dir()
        .map_err(|e| e.to_string())?;
    let template_dir = resource_dir.join("brains");

    // 2. Build destination path: ~/.envoy/brains/{username}
    let dest_dir = dirs::home_dir()
        .ok_or("Cannot determine home directory")?
        .join(".envoy")
        .join("brains")
        .join(username);

    // 3. Ensure destination root exists
    fs::create_dir_all(&dest_dir).map_err(|e| e.to_string())?;

    // 4. Recursively copy template files that don't exist in destination
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
            // Recurse into subdirectory
            fs::create_dir_all(&dest_path).map_err(|e| e.to_string())?;
            copy_dir_recursive(&src_path, &dest_path)?;
        } else {
            // Copy file only if it doesn't exist at destination
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
pub fn scan_brains_files(username: String) -> Result<serde_json::Value, String> {
    let base = brains_dir(&username)?;
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
        let name = path
            .file_name()
            .ok_or("Invalid file name")?
            .to_string_lossy()
            .to_string();

        if is_hidden(&name) {
            continue;
        }
        if name == ".sync_manifest.json" {
            continue;
        }

        if path.is_dir() {
            scan_dir_recursive(base, &path, results)?;
        } else {
            let mut file = fs::File::open(&path).map_err(|e| e.to_string())?;
            let mut content = Vec::new();
            file.read_to_end(&mut content).map_err(|e| e.to_string())?;

            // Skip binary files
            if content.contains(&0) {
                continue;
            }

            let relative = path
                .strip_prefix(base)
                .map_err(|e| e.to_string())?
                .to_string_lossy()
                .to_string();
            let hash = compute_hash(&content);
            let size = content.len() as u64;

            results.push(serde_json::json!({
                "path": relative,
                "hash": hash,
                "size": size,
            }));
        }
    }
    Ok(())
}

#[tauri::command]
pub fn restore_brains(username: String, files: Vec<serde_json::Value>) -> Result<serde_json::Value, String> {
    let base = brains_dir(&username)?;
    fs::create_dir_all(&base).map_err(|e| e.to_string())?;

    let mut restored = 0u32;
    for entry in &files {
        let path = entry["path"].as_str().ok_or("Missing path field")?;
        let content = entry["content"].as_str().ok_or("Missing content field")?;

        let full_path = base.join(path);
        if let Some(parent) = full_path.parent() {
            fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
        fs::write(&full_path, content).map_err(|e| e.to_string())?;
        restored += 1;
    }

    Ok(serde_json::json!({ "restored": restored }))
}
