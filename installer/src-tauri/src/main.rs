// Prevent console window from opening on Windows
#![cfg_attr(not(test), windows_subsystem = "windows")]

fn main() {
    envoy_installer_lib::run()
}
