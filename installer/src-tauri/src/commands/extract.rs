use crate::CANCELLED;
use crate::PAYLOAD;
use std::fs;
use std::path::Path;
use std::sync::atomic::Ordering;
use tauri::Emitter;

#[tauri::command]
pub async fn start_install(
    app: tauri::AppHandle,
    target_path: String,
) -> Result<(), String> {
    CANCELLED.store(false, Ordering::SeqCst);

    let target = Path::new(&target_path);

    // Create target directory
    fs::create_dir_all(target).map_err(|e| format!("无法创建安装目录: {}", e))?;

    // Collect files for progress tracking
    let files: Vec<_> = PAYLOAD
        .files()
        .filter(|f| !f.path().as_os_str().is_empty())
        .collect();
    let total = files.len().max(1);

    for (i, file) in files.iter().enumerate() {
        if CANCELLED.load(Ordering::SeqCst) {
            let _ = fs::remove_dir_all(target);
            return Err("安装已取消".to_string());
        }

        let relative = file.path();

        // Skip directories — they have no contents
        if relative.to_string_lossy().is_empty() {
            continue;
        }

        let dest = target.join(relative);

        // Create parent directories
        if let Some(parent) = dest.parent() {
            fs::create_dir_all(parent).map_err(|e| format!("无法创建目录: {}", e))?;
        }

        // include_dir::DirEntry::contents() returns &[u8] directly (not Option)
        let contents = file.contents();
        fs::write(&dest, contents).map_err(|e| {
            format!(
                "无法写入文件 {}: {}",
                relative.to_string_lossy(),
                e
            )
        })?;

        let percent = ((i + 1) as f64 / total as f64 * 100.0) as i32;
        let _ = app.emit(
            "install-progress",
            serde_json::json!({
                "percent": percent,
                "file": relative.to_string_lossy().to_string(),
            }),
        );
    }

    Ok(())
}

#[tauri::command]
pub async fn cancel_install() -> Result<(), String> {
    CANCELLED.store(true, Ordering::SeqCst);
    Ok(())
}
