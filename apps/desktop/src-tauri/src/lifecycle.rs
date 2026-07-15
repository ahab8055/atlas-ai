//! Application lifecycle hooks for the Atlas desktop shell.
//!
//! Foundation phases: Initialize → Ready → Running → Shutdown
//! (Architecture/11-Desktop-Application-Architecture.md).

use tauri::{App, AppHandle, Manager, RunEvent, WindowEvent};
use tracing::info;

pub fn on_setup(app: &mut App) -> Result<(), Box<dyn std::error::Error>> {
    info!(
        service = "desktop-core",
        category = "application",
        phase = "initialize",
        "Atlas desktop lifecycle: initialize"
    );

    if let Some(window) = app.get_webview_window("main") {
        let _ = window.set_focus();
    }

    info!(
        service = "desktop-core",
        category = "application",
        phase = "ready",
        "Atlas desktop lifecycle: ready"
    );

    Ok(())
}

pub fn on_run_event(_app: &AppHandle, event: &RunEvent) {
    match event {
        RunEvent::Ready => {
            info!(
                service = "desktop-core",
                category = "application",
                phase = "running",
                "Atlas desktop lifecycle: running"
            );
        }
        RunEvent::ExitRequested { .. } => {
            info!(
                service = "desktop-core",
                category = "application",
                phase = "shutdown",
                "Atlas desktop lifecycle: exit requested"
            );
        }
        RunEvent::Exit => {
            info!(
                service = "desktop-core",
                category = "application",
                phase = "shutdown",
                "Atlas desktop lifecycle: exit"
            );
        }
        _ => {}
    }
}

pub fn on_window_event(label: &str, event: &WindowEvent) {
    if let WindowEvent::CloseRequested { .. } = event {
        info!(
            service = "desktop-core",
            category = "application",
            phase = "shutdown",
            window = label,
            "Atlas desktop window close requested"
        );
    }
}
