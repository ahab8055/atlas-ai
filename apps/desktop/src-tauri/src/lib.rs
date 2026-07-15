//! Atlas AI desktop — Tauri application entry (library target).

mod commands;
mod lifecycle;

use commands::system::{get_app_info, ping};
use tracing::{error, info};

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

    let builder_result = tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| lifecycle::on_setup(app))
        .invoke_handler(tauri::generate_handler![get_app_info, ping])
        .on_window_event(|window, event| {
            lifecycle::on_window_event(window.label(), event);
        })
        .build(tauri::generate_context!());

    let app = match builder_result {
        Ok(app) => app,
        Err(error) => {
            error!(
                service = "desktop-core",
                category = "application",
                error = %error,
                "Atlas desktop failed to build"
            );
            panic!("error while building Atlas AI: {error}");
        }
    };

    app.run(|handle, event| {
        lifecycle::on_run_event(handle, &event);
    });
}
