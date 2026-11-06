// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::collections::HashMap;
use std::sync::Mutex;
use tauri::{Manager, State};

mod bus;
mod framing;
mod logger;
mod serial_manager;
mod types;
mod updater;

use serial_manager::SerialManager;
use std::sync::atomic::{AtomicBool, Ordering as AtomicOrdering};
use types::*;

// ── Hex send parsing (audit B-04, S1-15) ────────────────────────────

/// Hard cap on a single send, so a hostile or broken paste cannot pin the
/// writer for minutes.
const MAX_SEND_BYTES: usize = 1024 * 1024;

/// Parse user-entered hex text into bytes.
///
/// Pure and panic-free: works on raw ASCII bytes, tolerates spaces, tabs,
/// CR/LF and commas as separators, accepts an optional `0x` prefix where a
/// byte starts, and rejects everything else with a descriptive error. The old
/// implementation sliced `&str` by byte offset and could panic on inputs
/// containing multi-byte characters (`byte index is not a char boundary`).
pub(crate) fn parse_hex_input(input: &str) -> Result<Vec<u8>, String> {
    let bytes = input.as_bytes();
    let mut out = Vec::with_capacity(bytes.len() / 2 + 1);
    let mut high: Option<u8> = None;

    let mut index = 0;
    while index < bytes.len() {
        let byte = bytes[index];
        if byte.is_ascii_whitespace() || byte == b',' {
            index += 1;
            continue;
        }
        // Optional `0x`/`0X` prefix, only where a new byte starts.
        if byte == b'0' && index + 1 < bytes.len() && matches!(bytes[index + 1], b'x' | b'X') {
            if high.is_some() {
                return Err(format!(
                    "Invalid hex input: '0x' prefix at byte {} splits a byte in half",
                    index
                ));
            }
            index += 2;
            continue;
        }
        let value = match byte {
            b'0'..=b'9' => byte - b'0',
            b'a'..=b'f' => byte - b'a' + 10,
            b'A'..=b'F' => byte - b'A' + 10,
            _ => {
                return Err(format!(
                    "Invalid hex input: {} at byte {} is not a hex digit",
                    describe_byte(byte),
                    index
                ));
            }
        };
        match high.take() {
            None => high = Some(value),
            Some(high_nibble) => {
                out.push((high_nibble << 4) | value);
                if out.len() > MAX_SEND_BYTES {
                    return Err(format!(
                        "Hex input too large: a single send is limited to {} bytes",
                        MAX_SEND_BYTES
                    ));
                }
            }
        }
        index += 1;
    }

    if high.is_some() {
        return Err(
            "Invalid hex input: odd number of hex digits (each byte needs two)".to_string(),
        );
    }
    Ok(out)
}

/// Render one input byte for an error message without assuming UTF-8.
fn describe_byte(byte: u8) -> String {
    if byte.is_ascii_graphic() {
        format!("'{}'", byte as char)
    } else {
        format!("byte 0x{byte:02X}")
    }
}

// ── RFC #3 Step 4: event push bridge ─────────────────────────────────
/// Wire DTO for `serial://frames`: the hot path carries no raw bytes
/// (seq/dir/len + decorated display text); raw bytes remain available via
/// the snapshot command and export.
#[derive(Clone, serde::Serialize)]
struct FrameDto {
    session: u64,
    seq: u64,
    direction: Direction,
    len: usize,
    timestamp: chrono::DateTime<chrono::Utc>,
    display_text: String,
    timestamp_formatted: Option<String>,
}

#[derive(Clone, serde::Serialize)]
struct FrameBatchDto {
    session: u64,
    first_seq: u64,
    dropped_before: u64,
    frames: Vec<FrameDto>,
}

/// Bridge contract: a plain pump thread with bounded blocking recv; the
/// subscription lives for the app's lifetime (sessions come and go).
fn spawn_frame_pump(app: &tauri::App) {
    use tauri::{Emitter, Manager};
    let app_handle = app.handle().clone();
    let state = app.state::<AppState>();
    let (bus, disp, tz) = {
        let manager = state.serial_manager.lock().unwrap();
        (
            manager.bus(),
            manager.display_settings_handle(),
            manager.timezone_offset_handle(),
        )
    };
    std::thread::spawn(move || {
        let sub = bus.subscribe(bus::GUI_DEFAULT);
        loop {
            let Some(batch) = sub.recv_batch() else {
                continue; // quiet timeout tick
            };
            let settings = disp.lock().map(|g| g.clone()).unwrap_or_default();
            let tz_offset = *tz.lock().unwrap_or_else(|e| e.into_inner());
            let frames: Vec<FrameDto> = batch
                .frames
                .iter()
                .map(|f| FrameDto {
                    session: f.session,
                    seq: f.seq,
                    direction: f.dir,
                    len: f.data.len(),
                    timestamp: f.t_wall,
                    display_text: serial_manager::format_data_for_display(&f.data, &settings),
                    timestamp_formatted: if settings.show_timestamps {
                        Some(serial_manager::format_timestamp_with_offset(tz_offset))
                    } else {
                        None
                    },
                })
                .collect();
            let dto = FrameBatchDto {
                session: batch.session,
                first_seq: batch.first_seq,
                dropped_before: batch.dropped_before,
                frames,
            };
            let _ = app_handle.emit("serial://frames", dto);
        }
    });
}

// Application state
struct AppState {
    serial_manager: Mutex<SerialManager>,
    sessions: Mutex<HashMap<String, SerialConfig>>,
    update_downloading: AtomicBool,
    /// Path returned by the last successful `download_update`. The installer
    /// launcher only accepts this path, so a compromised webview cannot hand
    /// an arbitrary executable to the launcher (audit S-02).
    downloaded_installer: Mutex<Option<std::path::PathBuf>>,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            serial_manager: Mutex::new(SerialManager::new()),
            sessions: Mutex::new(HashMap::new()),
            update_downloading: AtomicBool::new(false),
            downloaded_installer: Mutex::new(None),
        }
    }
}

// Tauri commands
#[tauri::command]
async fn list_serial_ports() -> Result<Vec<SerialPortInfo>, String> {
    SerialManager::list_available_ports().map_err(|e| e.to_string())
}

#[tauri::command]
async fn connect_to_port(
    state: State<'_, AppState>,
    port_name: String,
    config: SerialConfig,
) -> Result<(), String> {
    let mut manager = state.serial_manager.lock().unwrap();
    manager
        .connect(&port_name, config)
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn disconnect_port(state: State<'_, AppState>) -> Result<(), String> {
    // Fast state cleanup under the lock; the (bounded) reader join happens
    // AFTER the lock is released so polling commands are never blocked
    // behind a thread wait (RFC #3 Step 3).
    let handle = {
        let mut manager = state.serial_manager.lock().unwrap();
        manager.disconnect().map_err(|e| e.to_string())?
    };
    if let Some(h) = handle {
        SerialManager::join_reader_bounded(h);
    }
    Ok(())
}

#[tauri::command]
async fn send_data(
    state: State<'_, AppState>,
    data: String,
    format: DataFormat,
    encoding: Option<TextEncoding>,
) -> Result<(), String> {
    let text_encoding = encoding.unwrap_or_default();

    // Process data conversion in a separate task to avoid blocking UI
    let bytes = tokio::task::spawn_blocking(move || {
        match format {
            DataFormat::Text => {
                // Encode text using the specified encoding
                match text_encoding {
                    TextEncoding::Utf8 => Ok(data.into_bytes()),
                    TextEncoding::Gbk => {
                        let (encoded, _, had_errors) = encoding_rs::GBK.encode(&data);
                        if had_errors {
                            // If encoding fails for some characters, still send what we can
                            log::warn!("Some characters could not be encoded to GBK");
                        }
                        Ok(encoded.into_owned())
                    }
                }
            }
            DataFormat::Hex => parse_hex_input(&data),
        }
    })
    .await
    .map_err(|e| e.to_string())??;

    if bytes.is_empty() {
        return Err("No data to send".to_string());
    }

    let mut manager = state.serial_manager.lock().unwrap();
    manager.send_data(bytes).map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_connection_status(state: State<'_, AppState>) -> Result<ConnectionStatus, String> {
    let mut manager = state.serial_manager.lock().unwrap();
    Ok(manager.get_status())
}

#[tauri::command]
async fn get_logs(state: State<'_, AppState>) -> Result<Vec<LogEntry>, String> {
    let manager = state.serial_manager.lock().unwrap();
    Ok(manager.get_logs())
}

/// Initial alignment for the event-driven log view (RFC #3 Step 4).
#[tauri::command]
async fn get_logs_snapshot(state: State<'_, AppState>) -> Result<LogsSnapshot, String> {
    let manager = state.serial_manager.lock().unwrap();
    Ok(manager.get_logs_snapshot())
}

/// Returns the new log epoch; the frontend uses it to discard snapshots
/// that raced this clear.
#[tauri::command]
async fn clear_logs(state: State<'_, AppState>) -> Result<u64, String> {
    let mut manager = state.serial_manager.lock().unwrap();
    Ok(manager.clear_logs())
}

#[tauri::command]
async fn export_logs(
    state: State<'_, AppState>,
    file_path: String,
    format: ExportFormat,
    timezone_offset_minutes: Option<i32>,
) -> Result<(), String> {
    let manager = state.serial_manager.lock().unwrap();
    manager
        .export_logs(&file_path, format, timezone_offset_minutes.unwrap_or(0))
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn save_session(
    state: State<'_, AppState>,
    name: String,
    config: SerialConfig,
) -> Result<(), String> {
    let mut sessions = state.sessions.lock().unwrap();
    sessions.insert(name, config);
    Ok(())
}

#[tauri::command]
async fn load_session(state: State<'_, AppState>, name: String) -> Result<SerialConfig, String> {
    let sessions = state.sessions.lock().unwrap();
    sessions
        .get(&name)
        .cloned()
        .ok_or_else(|| "Session not found".to_string())
}

#[tauri::command]
async fn list_sessions(state: State<'_, AppState>) -> Result<Vec<String>, String> {
    let sessions = state.sessions.lock().unwrap();
    Ok(sessions.keys().cloned().collect())
}

#[tauri::command]
async fn set_log_limit(state: State<'_, AppState>, limit: usize) -> Result<(), String> {
    let manager = state.serial_manager.lock().unwrap();
    manager.set_max_log_entries(limit);
    Ok(())
}

#[tauri::command]
async fn get_log_limit(state: State<'_, AppState>) -> Result<usize, String> {
    let manager = state.serial_manager.lock().unwrap();
    Ok(manager.get_max_log_entries())
}

#[tauri::command]
async fn set_frame_segmentation(
    state: State<'_, AppState>,
    config: FrameSegmentationConfig,
) -> Result<(), String> {
    let manager = state.serial_manager.lock().unwrap();
    manager.set_frame_segmentation_config(config);
    Ok(())
}

#[tauri::command]
async fn get_frame_segmentation(
    state: State<'_, AppState>,
) -> Result<FrameSegmentationConfig, String> {
    let manager = state.serial_manager.lock().unwrap();
    Ok(manager.get_frame_segmentation_config())
}

// Recording commands

#[tauri::command]
async fn set_log_directory(state: State<'_, AppState>, path: String) -> Result<(), String> {
    let manager = state.serial_manager.lock().unwrap();
    manager.set_log_directory(path);
    Ok(())
}

#[tauri::command]
async fn get_log_directory(state: State<'_, AppState>) -> Result<String, String> {
    let manager = state.serial_manager.lock().unwrap();
    Ok(manager.get_log_directory())
}

#[tauri::command]
async fn set_timezone_offset(
    state: State<'_, AppState>,
    offset_minutes: i32,
) -> Result<(), String> {
    let manager = state.serial_manager.lock().unwrap();
    manager.set_timezone_offset(offset_minutes);
    Ok(())
}

#[tauri::command]
async fn start_text_recording(state: State<'_, AppState>) -> Result<String, String> {
    let manager = state.serial_manager.lock().unwrap();
    manager.start_text_recording().map_err(|e| e.to_string())
}

#[tauri::command]
async fn stop_text_recording(state: State<'_, AppState>) -> Result<(), String> {
    let manager = state.serial_manager.lock().unwrap();
    manager.stop_text_recording().map_err(|e| e.to_string())
}

#[tauri::command]
async fn start_raw_recording(state: State<'_, AppState>) -> Result<String, String> {
    let manager = state.serial_manager.lock().unwrap();
    manager.start_raw_recording().map_err(|e| e.to_string())
}

#[tauri::command]
async fn stop_raw_recording(state: State<'_, AppState>) -> Result<(), String> {
    let manager = state.serial_manager.lock().unwrap();
    manager.stop_raw_recording().map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_recording_status(state: State<'_, AppState>) -> Result<RecordingStatus, String> {
    let manager = state.serial_manager.lock().unwrap();
    Ok(manager.get_recording_status())
}

/// Encode text string to bytes using the specified encoding
#[tauri::command]
async fn encode_text(text: String, encoding: TextEncoding) -> Result<Vec<u8>, String> {
    match encoding {
        TextEncoding::Utf8 => Ok(text.into_bytes()),
        TextEncoding::Gbk => {
            let (encoded, _, had_errors) = encoding_rs::GBK.encode(&text);
            if had_errors {
                log::warn!("Some characters could not be encoded to GBK");
            }
            Ok(encoded.into_owned())
        }
    }
}

/// Decode bytes to text string using the specified encoding
#[tauri::command]
async fn decode_bytes(bytes: Vec<u8>, encoding: TextEncoding) -> Result<String, String> {
    match encoding {
        TextEncoding::Utf8 => {
            String::from_utf8(bytes).map_err(|e| format!("Invalid UTF-8 sequence: {}", e))
        }
        TextEncoding::Gbk => {
            let (decoded, _, had_errors) = encoding_rs::GBK.decode(&bytes);
            if had_errors {
                log::warn!("Some bytes could not be decoded from GBK");
            }
            Ok(decoded.into_owned())
        }
    }
}

// Display settings commands

#[tauri::command]
async fn set_display_format(
    state: State<'_, AppState>,
    format: ReceiveDisplayFormat,
) -> Result<(), String> {
    let manager = state.serial_manager.lock().unwrap();
    manager.set_display_format(format);
    Ok(())
}

#[tauri::command]
async fn set_text_encoding_display(
    state: State<'_, AppState>,
    encoding: TextEncoding,
) -> Result<(), String> {
    let manager = state.serial_manager.lock().unwrap();
    manager.set_text_encoding(encoding);
    Ok(())
}

#[tauri::command]
async fn set_special_char_config(
    state: State<'_, AppState>,
    config: SpecialCharConfig,
) -> Result<(), String> {
    let manager = state.serial_manager.lock().unwrap();
    manager.set_special_char_config(config);
    Ok(())
}

#[tauri::command]
async fn set_show_timestamps(state: State<'_, AppState>, show: bool) -> Result<(), String> {
    let manager = state.serial_manager.lock().unwrap();
    manager.set_show_timestamps(show);
    Ok(())
}

#[tauri::command]
async fn get_display_settings(state: State<'_, AppState>) -> Result<DisplaySettings, String> {
    let manager = state.serial_manager.lock().unwrap();
    Ok(manager.get_display_settings())
}

// Modem control / break commands (S1-10)

#[tauri::command]
async fn set_dtr(state: State<'_, AppState>, level: bool) -> Result<(), String> {
    let mut manager = state
        .serial_manager
        .lock()
        .map_err(|_| "Serial manager lock poisoned".to_string())?;
    manager.set_dtr(level).map_err(|e| e.to_string())
}

#[tauri::command]
async fn set_rts(state: State<'_, AppState>, level: bool) -> Result<(), String> {
    let mut manager = state
        .serial_manager
        .lock()
        .map_err(|_| "Serial manager lock poisoned".to_string())?;
    manager.set_rts(level).map_err(|e| e.to_string())
}

/// Assert BREAK for `duration_ms` (clamped 1..=5000).
///
/// The manager lock is NOT held while sleeping: a long break must not freeze
/// the other commands. If the port goes away during the sleep, closing it
/// already cleared the BREAK line, so the clear failure is only logged.
#[tauri::command]
async fn send_break(state: State<'_, AppState>, duration_ms: u64) -> Result<(), String> {
    let duration = serial_manager::clamp_break_ms(duration_ms);

    {
        let mut manager = state
            .serial_manager
            .lock()
            .map_err(|_| "Serial manager lock poisoned".to_string())?;
        manager.set_break_level(true).map_err(|e| e.to_string())?;
    }

    tokio::time::sleep(std::time::Duration::from_millis(duration)).await;

    let mut manager = state
        .serial_manager
        .lock()
        .map_err(|_| "Serial manager lock poisoned".to_string())?;
    if let Err(e) = manager.set_break_level(false) {
        log::warn!("Failed to clear break: {}", e);
    }
    Ok(())
}

#[tauri::command]
async fn get_pin_states(state: State<'_, AppState>) -> Result<PinStates, String> {
    let mut manager = state
        .serial_manager
        .lock()
        .map_err(|_| "Serial manager lock poisoned".to_string())?;
    manager.get_pin_states().map_err(|e| e.to_string())
}

// Update checker commands

#[tauri::command]
async fn check_for_updates() -> Result<updater::UpdateCheckResult, String> {
    let current_version = env!("CARGO_PKG_VERSION");
    updater::check_for_updates(current_version).await
}

#[tauri::command]
async fn download_update(
    app_handle: tauri::AppHandle,
    state: State<'_, AppState>,
    download_url: String,
    asset_name: String,
) -> Result<String, String> {
    // Prevent multiple simultaneous downloads
    if state.update_downloading.swap(true, AtomicOrdering::SeqCst) {
        return Err("Download already in progress".to_string());
    }

    let result = updater::download_update(&app_handle, &download_url, &asset_name).await;

    state
        .update_downloading
        .store(false, AtomicOrdering::SeqCst);

    match result {
        Ok(path) => {
            if let Ok(mut slot) = state.downloaded_installer.lock() {
                *slot = Some(path.clone());
            }
            Ok(path.to_string_lossy().to_string())
        }
        Err(error) => Err(error),
    }
}

#[tauri::command]
async fn launch_installer_and_exit(
    state: State<'_, AppState>,
    installer_path: String,
) -> Result<(), String> {
    let requested = std::path::PathBuf::from(&installer_path);
    let allowed = state
        .downloaded_installer
        .lock()
        .map(|slot| slot.clone())
        .unwrap_or(None)
        .ok_or_else(|| "No update has been downloaded in this session".to_string())?;

    let matches = match (requested.canonicalize(), allowed.canonicalize()) {
        (Ok(a), Ok(b)) => a == b,
        _ => requested == allowed,
    };
    if !matches {
        return Err(
            "Refusing to launch an installer that was not downloaded by this app".to_string(),
        );
    }
    if !allowed.is_file() {
        return Err("Downloaded installer is missing".to_string());
    }
    updater::launch_installer_and_exit(&installer_path)
}

#[tauri::command]
fn open_url(url: String) -> Result<(), String> {
    updater::open_url(&url)
}

fn main() {
    tauri::Builder::default()
        .manage(AppState::default())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            // Release builds have no visible stderr; keep diagnostics on disk.
            if let Err(error) = logger::init(app.handle()) {
                eprintln!("failed to initialise file logger: {error}");
            }
            // T1 spike: Windows/Linux use the self-drawn title bar. macOS keeps
            // native decorations with titleBarStyle=Overlay so the traffic
            // lights remain native. The real implementation should move this
            // to platform-specific Tauri config to avoid a one-frame flash.
            #[cfg(not(target_os = "macos"))]
            if let Some(window) = app.get_webview_window("main") {
                if let Err(error) = window.set_decorations(false) {
                    eprintln!("failed to remove native window decorations: {error}");
                }
            }
            spawn_frame_pump(app);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            list_serial_ports,
            connect_to_port,
            disconnect_port,
            send_data,
            get_connection_status,
            get_logs,
            get_logs_snapshot,
            clear_logs,
            export_logs,
            save_session,
            load_session,
            list_sessions,
            set_log_limit,
            get_log_limit,
            set_frame_segmentation,
            get_frame_segmentation,
            set_log_directory,
            get_log_directory,
            set_timezone_offset,
            start_text_recording,
            stop_text_recording,
            start_raw_recording,
            stop_raw_recording,
            get_recording_status,
            encode_text,
            decode_bytes,
            set_display_format,
            set_text_encoding_display,
            set_special_char_config,
            set_show_timestamps,
            get_display_settings,
            set_dtr,
            set_rts,
            send_break,
            get_pin_states,
            check_for_updates,
            download_update,
            launch_installer_and_exit,
            open_url
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn hex_parser_accepts_common_formats() {
        assert_eq!(
            parse_hex_input("48 65 6C 6C 6F").unwrap(),
            b"Hello".to_vec()
        );
        assert_eq!(parse_hex_input("0d0a").unwrap(), vec![0x0D, 0x0A]);
        assert_eq!(parse_hex_input("0D, 0A").unwrap(), vec![0x0D, 0x0A]);
        assert_eq!(parse_hex_input("0x0D 0x0A").unwrap(), vec![0x0D, 0x0A]);
        assert_eq!(parse_hex_input("\t0D\r\n0A\n").unwrap(), vec![0x0D, 0x0A]);
        assert!(parse_hex_input("").unwrap().is_empty());
        assert!(parse_hex_input("   \r\n\t").unwrap().is_empty());
    }

    #[test]
    fn hex_parser_reports_errors_without_panicking() {
        let odd = parse_hex_input("0D0").unwrap_err();
        assert!(odd.contains("odd number"), "{odd}");

        let invalid = parse_hex_input("0G").unwrap_err();
        assert!(invalid.contains("not a hex digit"), "{invalid}");

        // Multi-byte UTF-8 used to panic on the old byte-slicing parser.
        let multibyte = parse_hex_input("0€").unwrap_err();
        assert!(multibyte.contains("not a hex digit"), "{multibyte}");
    }

    #[test]
    fn hex_parser_rejects_oversized_payloads() {
        let oversized = "00".repeat(MAX_SEND_BYTES + 1);
        assert!(parse_hex_input(&oversized).is_err());
    }

    #[test]
    fn hex_parser_accepts_exactly_the_size_limit() {
        let at_limit = "00".repeat(MAX_SEND_BYTES);
        assert_eq!(parse_hex_input(&at_limit).unwrap().len(), MAX_SEND_BYTES);
    }
}
