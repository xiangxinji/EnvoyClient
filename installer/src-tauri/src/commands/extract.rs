use crate::CANCELLED;
use crate::PAYLOAD;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::Ordering;
use tauri::Emitter;

#[tauri::command]
pub async fn start_install(
    app: tauri::AppHandle,
    target_path: String,
) -> Result<(), String> {
    CANCELLED.store(false, Ordering::SeqCst);

    let target = PathBuf::from(&target_path);

    // Collect file list upfront (fast, just reads the embedded dir tree)
    let files: Vec<_> = PAYLOAD
        .files()
        .filter(|f| !f.path().as_os_str().is_empty())
        .collect();
    let total = files.len().max(1);

    // Spawn blocking work on a background thread so the UI stays responsive
    let handle = app.clone();
    let result = tokio::task::spawn_blocking(move || -> Result<(), String> {
        // Create target directory
        fs::create_dir_all(&target).map_err(|e| format!("无法创建安装目录: {}", e))?;

        for (i, file) in files.iter().enumerate() {
            if CANCELLED.load(Ordering::SeqCst) {
                let _ = fs::remove_dir_all(&target);
                return Err("安装已取消".to_string());
            }

            let relative = file.path();
            if relative.to_string_lossy().is_empty() {
                continue;
            }

            let dest = target.join(relative);

            if let Some(parent) = dest.parent() {
                fs::create_dir_all(parent).map_err(|e| format!("无法创建目录: {}", e))?;
            }

            let contents = file.contents();
            fs::write(&dest, contents).map_err(|e| {
                format!("无法写入文件 {}: {}", relative.to_string_lossy(), e)
            })?;

            let percent = ((i + 1) as f64 / total as f64 * 100.0) as i32;
            let _ = handle.emit(
                "install-progress",
                serde_json::json!({
                    "percent": percent,
                    "file": relative.to_string_lossy().to_string(),
                }),
            );
        }

        Ok(())
    })
    .await
    .map_err(|e| format!("安装线程异常: {}", e))?;

    result
}

#[tauri::command]
pub async fn cancel_install() -> Result<(), String> {
    CANCELLED.store(true, Ordering::SeqCst);
    Ok(())
}
