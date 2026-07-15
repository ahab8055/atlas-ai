//! System IPC commands for the desktop shell foundation.
//! Future Atlas modules (agents, tools, memory) register additional command modules.

use serde::Serialize;
use tracing::{info, instrument};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppInfo {
    pub name: String,
    pub version: String,
    pub phase: String,
    pub runtime: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PingResponse {
    pub ok: bool,
    pub message: String,
}

#[tauri::command]
#[instrument(fields(category = "application"))]
pub fn get_app_info() -> AppInfo {
    info!(service = "desktop-core", "get_app_info invoked");
    AppInfo {
        name: "Atlas AI".into(),
        version: env!("CARGO_PKG_VERSION").into(),
        phase: "foundation".into(),
        runtime: "tauri".into(),
    }
}

#[tauri::command]
#[instrument(fields(category = "application"))]
pub fn ping(message: Option<String>) -> PingResponse {
    let message = message.unwrap_or_else(|| "pong".into());
    info!(service = "desktop-core", %message, "ping invoked");
    PingResponse {
        ok: true,
        message,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn app_info_reports_foundation_phase() {
        let info = get_app_info();
        assert_eq!(info.phase, "foundation");
        assert_eq!(info.name, "Atlas AI");
        assert!(!info.version.is_empty());
    }

    #[test]
    fn ping_defaults_message() {
        let response = ping(None);
        assert!(response.ok);
        assert_eq!(response.message, "pong");
    }
}
