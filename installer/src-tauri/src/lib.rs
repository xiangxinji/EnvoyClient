use include_dir::{include_dir, Dir};
use std::sync::atomic::AtomicBool;

mod commands;

// Embed the payload directory (populated by build-installer.ps1 before cargo build)
// If the directory doesn't exist at compile time, this will fail — that's intentional.
static PAYLOAD: Dir = include_dir!("$CARGO_MANIFEST_DIR/payload");

static CANCELLED: AtomicBool = AtomicBool::new(false);

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|_app| Ok(()))
        .invoke_handler(tauri::generate_handler![
            commands::get_default_install_path,
            commands::start_install,
            commands::cancel_install,
            commands::create_shortcuts,
            commands::register_uninstaller,
            commands::launch_app,
        ])
        .run(tauri::generate_context!())
        .expect("error while running installer");
}
