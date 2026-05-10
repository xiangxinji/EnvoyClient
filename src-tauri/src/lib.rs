mod history;
mod settings;

use std::collections::HashMap;
use std::process::Command;

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
fn get_settings() -> Result<serde_json::Value, String> {
    settings::get_settings()
}

#[tauri::command]
fn save_settings(settings: serde_json::Value) -> Result<(), String> {
    settings::save_settings(settings)
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

#[tauri::command]
fn file_read(path: String) -> Result<serde_json::Value, String> {
    let content = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
    Ok(serde_json::json!({ "content": content, "path": path }))
}

#[tauri::command]
fn file_write(path: String, content: String) -> Result<serde_json::Value, String> {
    // Ensure parent directory exists
    if let Some(parent) = std::path::Path::new(&path).parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    std::fs::write(&path, &content).map_err(|e| e.to_string())?;
    Ok(serde_json::json!({ "ok": true, "path": path }))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            save_message,
            load_history,
            load_all_history,
            export_history,
            import_history,
            get_settings,
            save_settings,
            shell_exec,
            file_read,
            file_write,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
