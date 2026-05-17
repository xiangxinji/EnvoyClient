use std::path::Path;

#[tauri::command]
pub fn create_shortcuts(install_path: String) -> Result<(), String> {
    let target = Path::new(&install_path);

    #[cfg(target_os = "windows")]
    {
        create_windows_shortcuts(target)?;
    }

    #[cfg(target_os = "macos")]
    {
        // macOS: no shortcuts needed, the .app bundle goes into /Applications
    }

    Ok(())
}

#[cfg(target_os = "windows")]
fn create_windows_shortcuts(install_dir: &Path) -> Result<(), String> {
    let exe_path = install_dir.join("Envoy.exe");
    if !exe_path.exists() {
        // Try lowercase
        let alt = install_dir.join("envoy.exe");
        if !alt.exists() {
            return Err(format!("找不到主程序: {}", exe_path.to_string_lossy()));
        }
    }

    let exe_path = if install_dir.join("Envoy.exe").exists() {
        install_dir.join("Envoy.exe")
    } else {
        install_dir.join("envoy.exe")
    };

    // Desktop shortcut
    if let Some(desktop) = dirs::desktop_dir() {
        let shortcut = desktop.join("Envoy.lnk");
        create_lnk(&exe_path, install_dir, &shortcut)?;
    }

    // Start Menu shortcut
    let app_data = dirs::data_dir().ok_or("无法确定应用数据目录")?;
    let start_menu = app_data
        .join("Microsoft")
        .join("Windows")
        .join("Start Menu")
        .join("Programs");
    let shortcut = start_menu.join("Envoy.lnk");
    create_lnk(&exe_path, install_dir, &shortcut)?;

    Ok(())
}

#[cfg(target_os = "windows")]
fn create_lnk(
    target: &std::path::Path,
    work_dir: &std::path::Path,
    shortcut_path: &std::path::Path,
) -> Result<(), String> {
    // Use PowerShell to create the shortcut (avoids adding a lnk crate dependency)
    let target_str = target.to_string_lossy().to_string();
    let work_dir_str = work_dir.to_string_lossy().to_string();
    let shortcut_str = shortcut_path.to_string_lossy().to_string();

    let script = format!(
        "$ws = New-Object -ComObject WScript.Shell; $sc = $ws.CreateShortcut('{}'); $sc.TargetPath = '{}'; $sc.WorkingDirectory = '{}'; $sc.Save()",
        shortcut_str, target_str, work_dir_str
    );

    let output = std::process::Command::new("powershell")
        .args(["-NoProfile", "-NonInteractive", "-Command", &script])
        .output()
        .map_err(|e| format!("无法创建快捷方式: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("创建快捷方式失败: {}", stderr));
    }

    Ok(())
}
