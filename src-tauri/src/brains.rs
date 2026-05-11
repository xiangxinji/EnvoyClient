use std::fs;
use std::path::Path;
use tauri::Manager;

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
