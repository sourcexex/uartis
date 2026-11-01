//! Minimal file logger for release builds.
//!
//! Windows release binaries run without a console (`windows_subsystem =
//! "windows"`), so stderr logging is invisible. The app therefore writes its
//! `log` records to `<app_log_dir>/uartis.log`; this is what makes
//! "连接失败 / 读线程死亡 / 更新失败" diagnosable after the fact.

use log::{LevelFilter, Log, Metadata, Record};
use std::fs::{File, OpenOptions};
use std::io::Write;
use std::sync::Mutex;
use tauri::Manager;

struct FileLogger {
    file: Mutex<File>,
}

impl Log for FileLogger {
    fn enabled(&self, _metadata: &Metadata) -> bool {
        true
    }

    fn log(&self, record: &Record) {
        if !self.enabled(record.metadata()) {
            return;
        }
        let Ok(mut file) = self.file.lock() else {
            return;
        };
        let timestamp = chrono::Local::now().format("%Y-%m-%d %H:%M:%S%.3f");
        let _ = writeln!(
            file,
            "[{}] [{}] {}: {}",
            timestamp,
            record.level(),
            record.target(),
            record.args()
        );
        let _ = file.flush();
    }

    fn flush(&self) {
        if let Ok(mut file) = self.file.lock() {
            let _ = file.flush();
        }
    }
}

/// Initialise the file logger inside `app_log_dir`. Failures are non-fatal:
/// the app must still start even if the log directory is read-only.
pub fn init(app: &tauri::AppHandle) -> Result<(), String> {
    let log_dir = app
        .path()
        .app_log_dir()
        .map_err(|e| format!("Cannot resolve app log dir: {e}"))?;
    std::fs::create_dir_all(&log_dir)
        .map_err(|e| format!("Cannot create log dir {}: {e}", log_dir.display()))?;
    let log_path = log_dir.join("uartis.log");
    let file = OpenOptions::new()
        .create(true)
        .append(true)
        .open(&log_path)
        .map_err(|e| format!("Cannot open {}: {e}", log_path.display()))?;

    let logger = Box::new(FileLogger {
        file: Mutex::new(file),
    });
    log::set_boxed_logger(logger).map_err(|e| format!("Logger already installed: {e}"))?;
    log::set_max_level(LevelFilter::Info);
    log::info!("Uartis starting (log file: {})", log_path.display());
    Ok(())
}
