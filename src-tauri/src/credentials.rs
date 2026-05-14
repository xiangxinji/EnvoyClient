use keyring::Entry;

const SERVICE: &str = "com.envoy.client";

fn make_entry(account: &str) -> Result<Entry, String> {
    Entry::new(SERVICE, account).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_credential(account: String) -> Result<String, String> {
    let entry = make_entry(&account)?;
    entry.get_password().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn save_credential(account: String, password: String) -> Result<(), String> {
    let entry = make_entry(&account)?;
    entry.set_password(&password).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_credential(account: String) -> Result<(), String> {
    let entry = make_entry(&account)?;
    entry.delete_credential().map_err(|e| e.to_string())
}
