//! Atlas AI desktop — Tauri application entry (library target).

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {name}! Atlas Rust core is ready.")
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![greet])
        .run(tauri::generate_context!())
        .expect("error while running Atlas AI");
}
