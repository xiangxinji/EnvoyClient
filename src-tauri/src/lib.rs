mod brains;
mod credentials;
mod history;
mod settings;

use std::collections::HashMap;
use std::process::Command;
use tauri::Manager;

/// Resolve a path string to a safe absolute path within `~/.envoy/`.
/// Expands `~` to `~/.envoy`, canonicalizes (resolving `..` and symlinks),
/// and verifies the result is inside the `~/.envoy/` sandbox.
fn resolve_safe_path(path: &str) -> Result<std::path::PathBuf, serde_json::Value> {
    let home = dirs::home_dir().ok_or_else(|| {
        serde_json::json!({ "error": "Cannot determine home directory" })
    })?;
    let sandbox = home.join(".envoy");

    // Ensure sandbox directory exists, then canonicalize for accurate comparison
    if !sandbox.exists() {
        std::fs::create_dir_all(&sandbox).map_err(|e| {
            serde_json::json!({ "error": format!("Failed to create sandbox directory: {}", e) })
        })?;
    }
    let sandbox = sandbox.canonicalize().map_err(|e| {
        serde_json::json!({ "error": format!("Failed to resolve sandbox path: {}", e) })
    })?;

    let expanded = if path.starts_with("~/") {
        sandbox.join(&path[2..])
    } else if path == "~" {
        sandbox.clone()
    } else {
        std::path::PathBuf::from(path)
    };

    // For non-existent paths, canonicalize won't work, so resolve the parent
    // and append the file name. For existent paths, canonicalize directly.
    let canonical = if expanded.exists() {
        expanded
            .canonicalize()
            .map_err(|e| serde_json::json!({ "error": format!("Failed to resolve path: {}", e) }))?
    } else {
        let file_name = expanded
            .file_name()
            .ok_or_else(|| serde_json::json!({ "error": "Invalid path" }))?;
        let parent = expanded.parent().ok_or_else(|| {
            serde_json::json!({ "error": "Invalid path" })
        })?;

        if parent.as_os_str().is_empty() {
            return Err(serde_json::json!({ "error": "Path outside allowed directory" }));
        }

        let canonical_parent = if parent.exists() {
            parent.canonicalize().map_err(|e| {
                serde_json::json!({ "error": format!("Failed to resolve path: {}", e) })
            })?
        } else {
            return Err(serde_json::json!({ "error": "Parent directory does not exist" }));
        };

        canonical_parent.join(file_name)
    };

    let canonical_str = canonical.to_string_lossy();
    let sandbox_str = sandbox.to_string_lossy();

    // On Windows, canonicalize returns UNC prefix (\\?\), strip it for comparison
    let canonical_clean = canonical_str
        .strip_prefix(r"\\?\")
        .unwrap_or(&canonical_str);
    let sandbox_clean = sandbox_str.strip_prefix(r"\\?\").unwrap_or(&sandbox_str);

    if !canonical_clean.starts_with(sandbox_clean) {
        return Err(serde_json::json!({ "error": "Path outside allowed directory (~/.envoy/)" }));
    }

    Ok(canonical)
}

#[tauri::command]
fn file_read(path: String, working_dir: Option<String>) -> Result<serde_json::Value, String> {
    let safe_path = if working_dir.is_some() {
        // Agent workspace mode: validate against workspace
        let workspace = resolve_workspace(working_dir)?;
        validate_workspace_path(&path, &workspace).map_err(|e| e.to_string())?
    } else {
        // Default mode: validate against ~/.envoy/
        resolve_safe_path(&path).map_err(|v| {
            serde_json::to_string(&v).unwrap_or_else(|_| r#"{"error":"Unknown error"}"#.to_string())
        })?
    };

    if !safe_path.exists() {
        return Err(
            serde_json::to_string(&serde_json::json!({ "error": "File not found" }))
                .unwrap_or_else(|_| r#"{"error":"File not found"}"#.to_string()),
        );
    }

    // Read first 8KB to check for binary content
    let mut file = std::fs::File::open(&safe_path).map_err(|e| e.to_string())?;
    let mut probe = [0u8; 8192];
    let bytes_read = std::io::Read::read(&mut file, &mut probe).map_err(|e| e.to_string())?;

    if probe[..bytes_read].contains(&0) {
        return Err(
            serde_json::to_string(&serde_json::json!({ "error": "Cannot read binary file" }))
                .unwrap_or_else(|_| r#"{"error":"Cannot read binary file"}"#.to_string()),
        );
    }

    let content = std::fs::read_to_string(&safe_path).map_err(|e| e.to_string())?;
    Ok(serde_json::json!({ "content": content }))
}

#[tauri::command]
fn file_write(path: String, content: String, working_dir: Option<String>) -> Result<serde_json::Value, String> {
    let safe_path = if working_dir.is_some() {
        // Agent workspace mode: validate against workspace
        let workspace = resolve_workspace(working_dir)?;
        validate_workspace_path(&path, &workspace).map_err(|e| e.to_string())?
    } else {
        // Default mode: validate against ~/.envoy/
        resolve_safe_path(&path).map_err(|v| {
            serde_json::to_string(&v).unwrap_or_else(|_| r#"{"error":"Unknown error"}"#.to_string())
        })?
    };

    // Ensure parent directory exists
    if let Some(parent) = safe_path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    std::fs::write(&safe_path, &content).map_err(|e| e.to_string())?;
    Ok(serde_json::json!({ "success": true }))
}

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
fn delete_history(my_id: &str, peer_id: &str) -> Result<(), String> {
    history::delete_history(my_id, peer_id)
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
fn init_workspace(username: String) -> Result<serde_json::Value, String> {
    let home = dirs::home_dir().ok_or("Cannot determine home directory")?;
    let workspace_dir = home.join(".envoy").join("workspace").join(&username);
    if !workspace_dir.exists() {
        std::fs::create_dir_all(&workspace_dir).map_err(|e| e.to_string())?;
    }
    Ok(serde_json::json!({ "workspace_dir": workspace_dir.to_string_lossy() }))
}

/// Parse YAML-like frontmatter from a markdown file.
/// Returns a map of key-value pairs from the `---` delimited block.
fn parse_frontmatter(content: &str) -> HashMap<String, String> {
    let mut map = HashMap::new();
    let trimmed = content.trim_start();
    if !trimmed.starts_with("---") {
        return map;
    }
    let rest = &trimmed[3..];
    let end = rest.find("---").unwrap_or(rest.len());
    for line in rest[..end].lines() {
        let line = line.trim();
        if line.is_empty() || line.starts_with('#') {
            continue;
        }
        if let Some((k, v)) = line.split_once(':') {
            let key = k.trim().to_string();
            let val = v.trim().trim_matches('"').trim_matches('\'').to_string();
            map.insert(key, val);
        }
    }
    map
}

#[tauri::command]
fn load_skill_catalog(username: String) -> Result<serde_json::Value, String> {
    let home = dirs::home_dir().ok_or("Cannot determine home directory")?;
    let skills_dir = home.join(".envoy").join("brains").join(&username).join("skills");

    if !skills_dir.exists() {
        return Ok(serde_json::json!({ "skills": [] }));
    }

    let mut skills = Vec::new();
    let entries = std::fs::read_dir(&skills_dir).map_err(|e| e.to_string())?;

    for entry in entries {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        if path.extension().and_then(|e| e.to_str()) != Some("md") {
            continue;
        }
        let filename = path.file_stem().and_then(|s| s.to_str()).unwrap_or("").to_string();
        let content = match std::fs::read_to_string(&path) {
            Ok(c) => c,
            Err(_) => continue,
        };
        let fm = parse_frontmatter(&content);
        skills.push(serde_json::json!({
            "name": fm.get("name").cloned().unwrap_or_else(|| filename.clone()),
            "description": fm.get("description").cloned().unwrap_or_default(),
            "filename": filename,
        }));
    }

    Ok(serde_json::json!({ "skills": skills }))
}

const BLOCKED_COMMANDS: &[&str] = &[
    "rm -rf",
    "rmdir",
    "del /",
    "format",
    "mkfs",
    "shutdown",
    "reboot",
    "reg ",
    "regedit",
    "net user",
    "net localgroup",
];

const BLOCKED_SHELLS: &[&str] = &["bash", "sh", "cmd", "powershell", "pwsh"];

fn validate_command(command: &str) -> Result<(), String> {
    let lower = command.to_lowercase();

    for blocked in BLOCKED_COMMANDS {
        if lower.contains(blocked) {
            return Err(format!("Command blocked: contains '{}'", blocked));
        }
    }

    // Block direct shell invocations (bash -c "...", cmd /c "...")
    let first_word = lower.split_whitespace().next().unwrap_or("");
    if BLOCKED_SHELLS.contains(&first_word) {
        return Err(format!("Command blocked: direct shell invocation '{}'", first_word));
    }

    // Block pipe to shell (with or without spaces)
    for shell in BLOCKED_SHELLS {
        if lower.contains(&format!("|{}", shell)) || lower.contains(&format!("| {}", shell)) {
            return Err("Command blocked: pipe to shell not allowed".into());
        }
    }

    Ok(())
}

/// Resolve the workspace directory for a given working_dir override and username.
/// Priority: working_dir param > ENVOY_WORKSPACE env > ~/.envoy/workspace/
fn resolve_workspace(working_dir: Option<String>) -> Result<std::path::PathBuf, String> {
    let raw = working_dir
        .or_else(|| std::env::var("ENVOY_WORKSPACE").ok())
        .or_else(|| {
            dirs::home_dir().map(|h| h.join(".envoy").join("workspace").to_string_lossy().to_string())
        })
        .ok_or_else(|| "Cannot determine workspace directory".to_string())?;

    let expanded = if raw.starts_with("~/") {
        dirs::home_dir()
            .map(|h| h.join(&raw[2..]))
            .ok_or_else(|| "Cannot determine home directory".to_string())?
    } else {
        std::path::PathBuf::from(&raw)
    };

    // Ensure workspace exists then canonicalize
    if !expanded.exists() {
        std::fs::create_dir_all(&expanded).map_err(|e| e.to_string())?;
    }
    expanded.canonicalize().map_err(|e| e.to_string())
}

/// Strip Windows UNC prefix (\\?\) from a path for clean comparison.
fn clean_path(p: &std::path::Path) -> std::path::PathBuf {
    let s = p.to_string_lossy();
    std::path::PathBuf::from(s.strip_prefix(r"\\?\").unwrap_or(&s))
}

/// Validate that cd targets in a command do not escape the workspace.
/// Splits command by &&, ||, |, ; and checks each cd target.
fn validate_cd_paths(command: &str, workspace: &std::path::Path) -> Result<(), String> {
    let ws_clean = clean_path(workspace);

    // Split by shell operators
    let segments = command.split(&['&', '|', ';'][..]);

    for seg in segments {
        let seg = seg.trim();
        // Match cd with a target (handle quoted and unquoted paths)
        // Pattern: cd <path> or cd "<path>"
        let rest = if let Some(s) = seg.strip_prefix("cd ") {
            s.trim()
        } else {
            continue;
        };

        // Skip cd without args or cd alone (no-op)
        if rest.is_empty() || rest == "~" {
            return Err("Command rejected: cd target escapes workspace".to_string());
        }

        let target_str = if (rest.starts_with('"') && rest.ends_with('"'))
            || (rest.starts_with('\'') && rest.ends_with('\''))
        {
            &rest[1..rest.len() - 1]
        } else {
            // Take first token (stop at whitespace for unquoted paths)
            rest.split_whitespace().next().unwrap_or(rest)
        };

        // Resolve the cd target
        let target = if target_str.starts_with("~/") {
            dirs::home_dir()
                .map(|h| h.join(&target_str[2..]))
                .ok_or_else(|| "Cannot resolve home directory".to_string())?
        } else if target_str == "~" {
            dirs::home_dir()
                .ok_or_else(|| "Cannot resolve home directory".to_string())?
        } else if std::path::Path::new(target_str).is_absolute() {
            std::path::PathBuf::from(target_str)
        } else {
            // Relative path — resolve from workspace
            workspace.join(target_str)
        };

        // Canonicalize (target must exist for canonicalize to work)
        // For non-existent targets, resolve via parent
        let canonical = if target.exists() {
            target.canonicalize().map_err(|e| e.to_string())?
        } else {
            // For relative paths like "src", resolve against workspace
            let parent = target.parent();
            let file_name = target.file_name();
            match (parent, file_name) {
                (Some(p), Some(f)) if p.exists() => {
                    p.canonicalize().map_err(|e| e.to_string())?.join(f)
                }
                _ => target.clone(),
            }
        };

        let target_clean = clean_path(&canonical);
        if !target_clean.starts_with(&ws_clean) {
            return Err(format!(
                "Command rejected: cd target escapes workspace ({} -> {})",
                target_str,
                target_clean.display()
            ));
        }
    }

    Ok(())
}

/// Validate that a file path is within the workspace.
fn validate_workspace_path(path: &str, workspace: &std::path::Path) -> Result<std::path::PathBuf, String> {
    let ws_clean = clean_path(workspace);

    let expanded = if path.starts_with("~/") {
        dirs::home_dir()
            .map(|h| h.join(&path[2..]))
            .ok_or_else(|| "Cannot determine home directory".to_string())?
    } else if path == "~" {
        dirs::home_dir()
            .ok_or_else(|| "Cannot determine home directory".to_string())?
    } else {
        std::path::PathBuf::from(path)
    };

    // Canonicalize: for existing paths do it directly; for new files resolve parent
    let canonical = if expanded.exists() {
        expanded.canonicalize().map_err(|e| e.to_string())?
    } else {
        let file_name = expanded
            .file_name()
            .ok_or_else(|| "Invalid path".to_string())?;
        let parent = expanded.parent().ok_or_else(|| "Invalid path".to_string())?;
        if parent.as_os_str().is_empty() {
            return Err("Path outside workspace".to_string());
        }
        let canonical_parent = if parent.exists() {
            parent.canonicalize().map_err(|e| e.to_string())?
        } else {
            return Err("Parent directory does not exist".to_string());
        };
        canonical_parent.join(file_name)
    };

    let canonical_clean = clean_path(&canonical);
    if !canonical_clean.starts_with(&ws_clean) {
        return Err(format!("Path outside workspace: {}", canonical_clean.display()));
    }

    Ok(canonical)
}

#[tauri::command]
fn shell_exec(command: String, working_dir: Option<String>) -> Result<serde_json::Value, String> {
    validate_command(&command)?;

    let workspace = resolve_workspace(working_dir)?;

    // Validate cd targets don't escape workspace
    validate_cd_paths(&command, &workspace)?;

    let ws_str = workspace.to_string_lossy().to_string();

    let output = if cfg!(target_os = "windows") {
        let full_cmd = format!("cd /d \"{}\" && {}", ws_str, command);
        let mut cmd = Command::new("cmd");
        cmd.args(["/C", &full_cmd]);
        cmd.output()
    } else {
        let full_cmd = format!("cd \"{}\" && {}", ws_str, command);
        let mut cmd = Command::new("sh");
        cmd.arg("-c").arg(&full_cmd);
        cmd.output()
    }
    .map_err(|e| e.to_string())?;

    Ok(serde_json::json!({
        "stdout": String::from_utf8_lossy(&output.stdout).to_string(),
        "stderr": String::from_utf8_lossy(&output.stderr).to_string(),
        "exit_code": output.status.code().unwrap_or(-1),
    }))
}


#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            if let Some(window) = app.get_webview_window("main") {
                let icon = tauri::image::Image::from_bytes(include_bytes!("../icons/icon.png"))
                    .expect("failed to load icon");
                window.set_icon(icon).ok();
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            save_message,
            load_history,
            load_all_history,
            delete_history,
            export_history,
            import_history,
            get_settings,
            save_settings,
            shell_exec,
            file_read,
            file_write,
            brains::init_brains,
            init_workspace,
            load_skill_catalog,
            credentials::get_credential,
            credentials::save_credential,
            credentials::delete_credential,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
