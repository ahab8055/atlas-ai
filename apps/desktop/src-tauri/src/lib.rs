//! Atlas AI desktop — Tauri application entry (library target).

use tracing::{error, info, instrument};

#[tauri::command]
#[instrument(fields(category = "application"))]
fn greet(name: &str) -> String {
    info!(service = "desktop-core", message = "greet invoked", name);
    format!("Hello, {name}! Atlas Rust core is ready.")
}

fn init_logging() {
    use tracing_subscriber::EnvFilter;

    let filter = EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| EnvFilter::new("info,atlas_desktop=debug"));

    tracing_subscriber::fmt()
        .with_env_filter(filter)
        .json()
        .with_target(true)
        .with_current_span(true)
        .try_init()
        .ok();
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    init_logging();
    info!(
        service = "desktop-core",
        category = "application",
        "Atlas desktop core starting"
    );

    let result = tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![greet])
        .run(tauri::generate_context!());

    if let Err(error) = result {
        error!(
            service = "desktop-core",
            category = "application",
            error = %error,
            "Atlas desktop failed to start"
        );
        panic!("error while running Atlas AI: {error}");
    }
}
