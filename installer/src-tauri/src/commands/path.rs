#[tauri::command]
pub fn get_default_install_path() -> Result<String, String> {
    let local_app_data = dirs::data_local_dir().ok_or("无法确定本地数据目录")?;
    let install_path = local_app_data.join("Envoy");
    Ok(install_path.to_string_lossy().to_string())
}
