use serde::Serialize;
use std::path::Path;

#[derive(Serialize)]
pub struct DiskInfo {
    pub free_gb: f64,
    pub total_gb: f64,
}

#[tauri::command]
pub fn get_default_install_path() -> Result<String, String> {
    let local_app_data = dirs::data_local_dir().ok_or("无法确定本地数据目录")?;
    let install_path = local_app_data.join("Envoy");
    Ok(install_path.to_string_lossy().to_string())
}

#[tauri::command]
pub fn get_disk_info(path: String) -> Result<DiskInfo, String> {
    let target = Path::new(&path);

    // Walk up to find an existing ancestor for the disk query
    let mut check_path = target;
    while !check_path.exists() {
        check_path = check_path.parent().ok_or("无法确定磁盘路径")?;
    }

    let drive_letter = check_path
        .to_string_lossy()
        .chars()
        .next()
        .unwrap_or('C');

    // Use fsutil to get disk free space on Windows
    #[cfg(target_os = "windows")]
    {
        let drive = format!("{}:", drive_letter);
        let output = std::process::Command::new("fsutil")
            .args(["volume", "diskfree", &drive])
            .output()
            .map_err(|e| format!("无法获取磁盘空间: {}", e))?;

        let stdout = String::from_utf8_lossy(&output.stdout);
        let mut free_bytes: u64 = 0;
        let mut total_bytes: u64 = 0;

        for line in stdout.lines() {
            if let Some((key, val)) = line.split_once(':') {
                let val = val.trim().replace(',', "");
                if let Ok(num) = val.parse::<u64>() {
                    if key.contains("可用") || key.contains("free") || key.contains("Free") {
                        free_bytes = num;
                    } else if key.contains("total") || key.contains("Total") || key.contains("总计") {
                        total_bytes = num;
                    }
                }
            }
        }

        if free_bytes == 0 && total_bytes == 0 {
            // Fallback: parse the numeric lines directly
            let nums: Vec<u64> = stdout
                .lines()
                .filter_map(|l| {
                    l.split(':')
                        .nth(1)
                        .and_then(|v| v.trim().replace(',', "").parse::<u64>().ok())
                })
                .collect();
            if nums.len() >= 3 {
                total_bytes = nums[0];
                free_bytes = nums[2];
            }
        }

        Ok(DiskInfo {
            free_gb: free_bytes as f64 / 1_073_741_824.0,
            total_gb: total_bytes as f64 / 1_073_741_824.0,
        })
    }

    #[cfg(not(target_os = "windows"))]
    {
        let path_str = check_path.to_string_lossy();
        let output = std::process::Command::new("df")
            .args(["-k", &path_str])
            .output()
            .map_err(|e| format!("无法获取磁盘空间: {}", e))?;

        let stdout = String::from_utf8_lossy(&output.stdout);
        // df -k output: Filesystem 1K-blocks Used Available Use% Mounted
        if let Some(line) = stdout.lines().nth(1) {
            let parts: Vec<&str> = line.split_whitespace().collect();
            if parts.len() >= 4 {
                let total_kb: u64 = parts[1].parse().unwrap_or(0);
                let avail_kb: u64 = parts[3].parse().unwrap_or(0);
                return Ok(DiskInfo {
                    free_gb: avail_kb as f64 / 1_048_576.0,
                    total_gb: total_kb as f64 / 1_048_576.0,
                });
            }
        }
        Ok(DiskInfo {
            free_gb: 0.0,
            total_gb: 0.0,
        })
    }
}
