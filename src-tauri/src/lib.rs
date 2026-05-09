mod history;

use std::collections::HashMap;

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
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
