use std::fs;
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
pub fn register_uninstaller(install_path: String) -> Result<(), String> {
    let install_dir = Path::new(&install_path);

    #[cfg(target_os = "windows")]
    {
        register_windows_uninstaller(install_dir)?;
    }

    Ok(())
}

#[cfg(target_os = "windows")]
fn register_windows_uninstaller(install_dir: &Path) -> Result<(), String> {
    let install_path_str = install_dir.to_string_lossy().to_string();
    let uninstall_bat = install_dir.join("uninstall.bat");

    let bat_content = format!(
        r#"@echo off
echo 正在卸载 Envoy...
taskkill /F /IM Envoy.exe 2>nul
taskkill /F /IM envoy.exe 2>nul
timeout /t 1 /nobreak >nul

del "%USERPROFILE%\Desktop\Envoy.lnk" 2>nul
del "%APPDATA%\Microsoft\Windows\Start Menu\Programs\Envoy.lnk" 2>nul

rd /s /q "{}"

reg delete "HKCU\Software\Microsoft\Windows\CurrentVersion\Uninstall\Envoy" /f 2>nul

echo 卸载完成
pause
"#,
        install_path_str
    );

    fs::write(&uninstall_bat, bat_content).map_err(|e| format!("无法创建卸载脚本: {}", e))?;

    let mut total_size: u64 = 0;
    if let Ok(size) = walk_dir(install_dir) {
        total_size = size;
    }

    let uninstall_path = uninstall_bat.to_string_lossy().to_string();
    let display_icon = {
        let exe = install_dir.join("Envoy.exe");
        if exe.exists() {
            exe.to_string_lossy().to_string()
        } else {
            install_dir.join("envoy.exe").to_string_lossy().to_string()
        }
    };

    let script = format!(
        r#"
$regPath = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\Envoy'
if (-not (Test-Path $regPath)) {{
    New-Item -Path $regPath -Force | Out-Null
}}
Set-ItemProperty -Path $regPath -Name 'DisplayName' -Value 'Envoy'
Set-ItemProperty -Path $regPath -Name 'DisplayVersion' -Value '0.1.0'
Set-ItemProperty -Path $regPath -Name 'Publisher' -Value 'Envoy'
Set-ItemProperty -Path $regPath -Name 'InstallLocation' -Value '{}'
Set-ItemProperty -Path $regPath -Name 'UninstallString' -Value '"{}"'
Set-ItemProperty -Path $regPath -Name 'DisplayIcon' -Value '{},0'
Set-ItemProperty -Path $regPath -Name 'EstimatedSize' -Value '{}'
Set-ItemProperty -Path $regPath -Name 'NoModify' -Value 1 -Type DWord
Set-ItemProperty -Path $regPath -Name 'NoRepair' -Value 1 -Type DWord
"#,
        install_path_str,
        uninstall_path,
        display_icon,
        total_size / 1024
    );

    let output = hidden_command("powershell")
        .args(["-NoProfile", "-NonInteractive", "-WindowStyle", "Hidden", "-Command", &script])
        .output()
        .map_err(|e| format!("无法注册卸载信息: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        eprintln!("Warning: registry write failed: {}", stderr);
    }

    Ok(())
}

fn walk_dir(dir: &Path) -> Result<u64, std::io::Error> {
    let mut total: u64 = 0;
    if dir.is_dir() {
        for entry in fs::read_dir(dir)? {
            let entry = entry?;
            let path = entry.path();
            if path.is_dir() {
                total += walk_dir(&path)?;
            } else {
                total += entry.metadata()?.len();
            }
        }
    }
    Ok(total)
}

#[tauri::command]
pub fn launch_app(install_path: String) -> Result<(), String> {
    let install_dir = Path::new(&install_path);

    #[cfg(target_os = "windows")]
    {
        let exe_path = install_dir.join("Envoy.exe");
        let exe_str = exe_path.to_string_lossy().to_string();

        let mut cmd = hidden_command("cmd");
        cmd.args(["/C", "start", "", &exe_str]);
        cmd.spawn().map_err(|e| format!("无法启动应用: {}", e))?;
    }

    #[cfg(target_os = "macos")]
    {
        let exe_path = install_dir.join("Envoy.app");
        std::process::Command::new("open")
            .arg(&exe_path)
            .spawn()
            .map_err(|e| format!("无法启动应用: {}", e))?;
    }

    Ok(())
}
