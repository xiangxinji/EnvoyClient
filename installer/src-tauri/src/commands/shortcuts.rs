use std::path::Path;

#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x08000000;

#[cfg(target_os = "windows")]
fn hidden_command(program: &str) -> std::process::Command {
    use std::os::windows::process::CommandExt;
    let mut cmd = std::process::Command::new(program);
    cmd.creation_flags(CREATE_NO_WINDOW);
    cmd
}

#[cfg(not(target_os = "windows"))]
fn hidden_command(program: &str) -> std::process::Command {
    std::process::Command::new(program)
}

#[tauri::command]
pub fn create_shortcuts(install_path: String) -> Result<(), String> {
    let target = Path::new(&install_path);

    #[cfg(target_os = "windows")]
    {
        create_windows_shortcuts(target)?;
    }

    Ok(())
}

#[cfg(target_os = "windows")]
fn create_windows_shortcuts(install_dir: &Path) -> Result<(), String> {
    let exe_path = if install_dir.join("Envoy.exe").exists() {
        install_dir.join("Envoy.exe")
    } else if install_dir.join("envoy.exe").exists() {
        install_dir.join("envoy.exe")
    } else {
        return Err(format!("找不到主程序: {}", install_dir.to_string_lossy()));
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

fn create_lnk(
    target: &std::path::Path,
    work_dir: &std::path::Path,
    shortcut_path: &std::path::Path,
) -> Result<(), String> {
    let target_str = target.to_string_lossy().to_string();
    let work_dir_str = work_dir.to_string_lossy().to_string();
    let shortcut_str = shortcut_path.to_string_lossy().to_string();

    let script = format!(
        "$ws = New-Object -ComObject WScript.Shell; $sc = $ws.CreateShortcut('{}'); $sc.TargetPath = '{}'; $sc.WorkingDirectory = '{}'; $sc.Save()",
        shortcut_str, target_str, work_dir_str
    );

    let output = hidden_command("powershell")
        .args(["-NoProfile", "-NonInteractive", "-WindowStyle", "Hidden", "-Command", &script])
        .output()
        .map_err(|e| format!("无法创建快捷方式: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("创建快捷方式失败: {}", stderr));
    }

    Ok(())
}
