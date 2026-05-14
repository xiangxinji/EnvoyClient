use std::fs;
use std::path::PathBuf;

fn settings_path() -> Option<PathBuf> {
    dirs::home_dir().map(|h| h.join(".envoy").join("settings.yml"))
}

pub fn get_settings() -> Result<serde_json::Value, String> {
    let path = settings_path().ok_or("Cannot determine home directory")?;
    if !path.exists() {
        let dir = path.parent().ok_or("Invalid path")?;
        fs::create_dir_all(dir).map_err(|e| e.to_string())?;
        let default = serde_json::json!({ "env": { "MANAGER_URL": "http://localhost:8080" } });
        let yaml_str = serde_yaml::to_string(&default).map_err(|e| e.to_string())?;
        fs::write(&path, yaml_str).map_err(|e| e.to_string())?;
        return Ok(default);
    }
    let raw = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let value: serde_json::Value = serde_yaml::from_str(&raw).map_err(|e| e.to_string())?;
    Ok(value)
}

pub fn save_settings(settings: serde_json::Value) -> Result<(), String> {
    let path = settings_path().ok_or("Cannot determine home directory")?;
    let dir = path.parent().ok_or("Invalid path")?;
    fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    let yaml_str = serde_yaml::to_string(&settings).map_err(|e| e.to_string())?;
    fs::write(&path, yaml_str).map_err(|e| e.to_string())
}
