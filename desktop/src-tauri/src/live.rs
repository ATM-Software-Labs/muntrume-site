//! Lectura de la memoria compartida del SDK de iRacing y detección de procesos.
//! Solo `FILE_MAP_READ`. No hay escritura ni mensajes al simulador.

use std::sync::atomic::{AtomicBool, Ordering};
use tauri::AppHandle;

pub static MAIN_TELEMETRY_ENABLED: AtomicBool = AtomicBool::new(false);

pub fn spawn(app: AppHandle) {
    #[cfg(windows)]
    {
        std::thread::Builder::new()
            .name("mmt-irsdk".into())
            .spawn(move || windows_loop(app))
            .ok();
    }
    #[cfg(not(windows))]
    {
        let _ = app;
    }
}

#[cfg(windows)]
pub fn current_status() -> &'static str {
    let (sim_running, ui_running) = detect_iracing_processes();
    if sim_running {
        use windows_sys::Win32::System::Memory::{OpenFileMappingW, FILE_MAP_READ};
        let mapping = unsafe { OpenFileMappingW(FILE_MAP_READ, 0, wide("Local\\IRSDKMemMapFileName").as_ptr()) };
        if !mapping.is_null() {
            unsafe { windows_sys::Win32::Foundation::CloseHandle(mapping); }
            return "on_track";
        }
        return "in_sim";
    }
    if ui_running {
        return "ui_open";
    }
    "closed"
}

#[cfg(not(windows))]
pub fn current_status() -> &'static str {
    "closed"
}

#[cfg(windows)]
fn eq_utf16_ascii_ignore_case(wide_slice: &[u16], ascii_target: &str) -> bool {
    let target = ascii_target.as_bytes();
    if wide_slice.len() != target.len() {
        return false;
    }
    wide_slice
        .iter()
        .zip(target.iter())
        .all(|(&w, &b)| w <= 0x7F && (w as u8).eq_ignore_ascii_case(&b))
}

#[cfg(windows)]
fn detect_iracing_processes() -> (bool, bool) {
    use windows_sys::Win32::Foundation::{CloseHandle, INVALID_HANDLE_VALUE};
    use windows_sys::Win32::System::Diagnostics::ToolHelp::{
        CreateToolhelp32Snapshot, Process32FirstW, Process32NextW, PROCESSENTRY32W,
        TH32CS_SNAPPROCESS,
    };

    let snapshot = unsafe { CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0) };
    if snapshot == INVALID_HANDLE_VALUE {
        return (false, false);
    }

    let mut entry: PROCESSENTRY32W = unsafe { std::mem::zeroed() };
    entry.dwSize = std::mem::size_of::<PROCESSENTRY32W>() as u32;

    let mut sim_running = false;
    let mut ui_running = false;
    if unsafe { Process32FirstW(snapshot, &mut entry) } != 0 {
        loop {
            let len = entry
                .szExeFile
                .iter()
                .position(|&c| c == 0)
                .unwrap_or(entry.szExeFile.len());
            let name = &entry.szExeFile[..len];
            if !sim_running
                && (eq_utf16_ascii_ignore_case(name, "iRacingSim64DX11.exe")
                    || eq_utf16_ascii_ignore_case(name, "iRacingSim64.exe"))
            {
                sim_running = true;
            } else if !ui_running && eq_utf16_ascii_ignore_case(name, "iRacingUI.exe") {
                ui_running = true;
            }
            if sim_running && ui_running {
                break;
            }
            if unsafe { Process32NextW(snapshot, &mut entry) } == 0 {
                break;
            }
        }
    }

    unsafe { CloseHandle(snapshot); }
    (sim_running, ui_running)
}

#[cfg(windows)]
struct SdkMap {
    mapping: windows_sys::Win32::Foundation::HANDLE,
    view: windows_sys::Win32::System::Memory::MEMORY_MAPPED_VIEW_ADDRESS,
    event: windows_sys::Win32::Foundation::HANDLE,
}

#[cfg(windows)]
impl Drop for SdkMap {
    fn drop(&mut self) {
        use windows_sys::Win32::Foundation::CloseHandle;
        use windows_sys::Win32::System::Memory::UnmapViewOfFile;
        unsafe {
            if !self.view.Value.is_null() {
                UnmapViewOfFile(self.view);
            }
            if !self.mapping.is_null() {
                CloseHandle(self.mapping);
            }
            if !self.event.is_null() {
                CloseHandle(self.event);
            }
        }
    }
}

#[cfg(windows)]
fn is_window_active(app: &AppHandle, label: &str) -> bool {
    use tauri::Manager;
    let Some(win) = app.get_webview_window(label) else {
        return false;
    };
    win.is_visible().unwrap_or(false) && !win.is_minimized().unwrap_or(false)
}

#[cfg(windows)]
fn is_window_focused(app: &AppHandle, label: &str) -> bool {
    use tauri::Manager;
    let Some(win) = app.get_webview_window(label) else {
        return false;
    };
    win.is_focused().unwrap_or(false)
}

#[cfg(windows)]
fn emit_status_if_changed(app: &AppHandle, last_status: &mut Option<&'static str>, next: &'static str) {
    use tauri::Emitter;
    if *last_status != Some(next) {
        *last_status = Some(next);
        let _ = app.emit("mmt-iracing-status", next);
    }
}

#[cfg(windows)]
fn windows_loop(app: AppHandle) {
    use std::time::{Duration, Instant};
    use mmt_sync_core::{
        read_live_irsdk_frame_with, read_live_sample_with, read_session_info_yaml,
        resolve_var_table, session_info_update, IbtError, VarTable,
    };
    use tauri::Emitter;
    use windows_sys::Win32::Foundation::CloseHandle;
    use windows_sys::Win32::System::Memory::{
        MapViewOfFile, OpenFileMappingW, VirtualQuery, FILE_MAP_READ, MEMORY_BASIC_INFORMATION,
    };
    use windows_sys::Win32::System::Threading::{OpenEventW, WaitForSingleObject};

    const SYNCHRONIZE: u32 = 0x0010_0000;
    const WAIT_OBJECT_0: u32 = 0;
    const FRAME_MS: u64 = 33;
    const MAIN_FRAME_MS: u64 = 100;
    const IRSDK_FRAME_MS: u64 = 200;
    let mut last_status: Option<&'static str> = None;

    loop {
        let (sim_running, ui_running) = detect_iracing_processes();
        if !sim_running {
            let st = if ui_running { "ui_open" } else { "closed" };
            emit_status_if_changed(&app, &mut last_status, st);
            std::thread::sleep(Duration::from_millis(2000));
            continue;
        }

        let mapping = unsafe { OpenFileMappingW(FILE_MAP_READ, 0, wide("Local\\IRSDKMemMapFileName").as_ptr()) };
        if mapping.is_null() {
            emit_status_if_changed(&app, &mut last_status, "in_sim");
            std::thread::sleep(Duration::from_millis(1200));
            continue;
        }
        let view = unsafe { MapViewOfFile(mapping, FILE_MAP_READ, 0, 0, 0) };
        if view.Value.is_null() {
            unsafe { CloseHandle(mapping); }
            std::thread::sleep(Duration::from_millis(500));
            continue;
        }
        let event = unsafe { OpenEventW(SYNCHRONIZE, 0, wide("Local\\IRSDKDataValidEvent").as_ptr()) };
        let mapped = SdkMap { mapping, view, event };
        emit_status_if_changed(&app, &mut last_status, "on_track");

        let mut vars: Option<VarTable> = None;
        let mut last_yaml_update: Option<i32> = None;
        let mut overlay_synced_yaml = false;
        let mut main_synced_yaml = false;
        let mut last_emit = Instant::now() - Duration::from_secs(1);
        let mut last_main_emit = Instant::now() - Duration::from_secs(1);
        let mut last_frame_emit = Instant::now() - Duration::from_secs(1);
        let mut last_yaml_emit = Instant::now() - Duration::from_secs(2);
        let mut last_proc = Instant::now();
        loop {
            let signaled = if mapped.event.is_null() {
                std::thread::sleep(Duration::from_millis(FRAME_MS));
                true
            } else {
                let waited = unsafe { WaitForSingleObject(mapped.event, FRAME_MS as u32) };
                if waited == WAIT_OBJECT_0 {
                    std::thread::sleep(Duration::from_millis(FRAME_MS));
                }
                waited == WAIT_OBJECT_0
            };
            if last_proc.elapsed() >= Duration::from_millis(2000) {
                last_proc = Instant::now();
                let (sim_alive, _) = detect_iracing_processes();
                if !sim_alive {
                    emit_status_if_changed(&app, &mut last_status, "closed");
                    break;
                }
            }
            if !signaled {
                continue;
            }
            if last_emit.elapsed() < Duration::from_millis(FRAME_MS) {
                continue;
            }
            let overlay_active = is_window_active(&app, "overlay");
            let main_active = MAIN_TELEMETRY_ENABLED.load(Ordering::Relaxed)
                && is_window_active(&app, "main")
                && (!overlay_active || is_window_focused(&app, "main"));
            if !overlay_active {
                overlay_synced_yaml = false;
            }
            if !main_active {
                main_synced_yaml = false;
            }
            // Skip shared-memory deserialization & IPC completely when no window is visible
            if !overlay_active && !main_active {
                last_emit = Instant::now();
                std::thread::sleep(Duration::from_millis(100));
                continue;
            }
            let mut info = unsafe { std::mem::zeroed::<MEMORY_BASIC_INFORMATION>() };
            let queried = unsafe {
                VirtualQuery(mapped.view.Value as *const _, &mut info, std::mem::size_of::<MEMORY_BASIC_INFORMATION>())
            };
            if queried == 0 || info.RegionSize < 112 {
                emit_status_if_changed(&app, &mut last_status, "in_sim");
                break;
            }
            let bytes = unsafe { std::slice::from_raw_parts(mapped.view.Value as *const u8, info.RegionSize) };
            let update = match session_info_update(bytes) {
                Ok(update) => update,
                Err(IbtError::NotConnected) => {
                    emit_status_if_changed(&app, &mut last_status, "in_sim");
                    vars = None;
                    std::thread::sleep(Duration::from_millis(50));
                    continue;
                }
                Err(_) => {
                    std::thread::sleep(Duration::from_millis(25));
                    continue;
                }
            };
            let stale = vars.as_ref().map(VarTable::session_info_update) != Some(update);
            if stale {
                match resolve_var_table(bytes) {
                    Ok(table) => vars = Some(table),
                    Err(IbtError::NotConnected) => {
                        emit_status_if_changed(&app, &mut last_status, "in_sim");
                        vars = None;
                        last_yaml_update = None;
                        std::thread::sleep(Duration::from_millis(50));
                        continue;
                    }
                    Err(_) => {
                        std::thread::sleep(Duration::from_millis(25));
                        continue;
                    }
                }
            }
            let yaml_changed = last_yaml_update != Some(update);
            let need_overlay_yaml = overlay_active && (yaml_changed || !overlay_synced_yaml);
            let need_main_yaml = main_active && (yaml_changed || !main_synced_yaml);
            if (need_overlay_yaml || need_main_yaml) && last_yaml_emit.elapsed() >= Duration::from_millis(1000) {
                if let Ok((u, yaml)) = read_session_info_yaml(bytes) {
                    let payload = serde_json::json!({ "update": u, "yaml": yaml });
                    if need_overlay_yaml {
                        let _ = app.emit_to("overlay", "mmt-session-info", &payload);
                        overlay_synced_yaml = true;
                    }
                    if need_main_yaml {
                        let _ = app.emit_to("main", "mmt-session-info", &payload);
                        main_synced_yaml = true;
                    }
                    last_yaml_update = Some(u);
                    last_yaml_emit = Instant::now();
                }
            }
            let mut clear_vars = false;
            if let Some(table) = vars.as_ref() {
                match read_live_sample_with(bytes, table) {
                    Ok(sample) => {
                        if overlay_active {
                            let _ = app.emit_to("overlay", "mmt-live", &sample);
                        }
                        if main_active && last_main_emit.elapsed() >= Duration::from_millis(MAIN_FRAME_MS) {
                            let _ = app.emit_to("main", "mmt-live", &sample);
                            last_main_emit = Instant::now();
                        }
                        emit_status_if_changed(&app, &mut last_status, "on_track");
                        last_emit = Instant::now();
                    }
                    Err(IbtError::NotConnected) => {
                        emit_status_if_changed(&app, &mut last_status, "in_sim");
                        clear_vars = true;
                        last_yaml_update = None;
                    }
                    Err(IbtError::StaleVars) => clear_vars = true,
                    Err(_) => {}
                }
            }
            if clear_vars {
                vars = None;
            }
            if last_frame_emit.elapsed() >= Duration::from_millis(IRSDK_FRAME_MS) {
                if let Some(table) = vars.as_ref() {
                    if let Ok(frame) = read_live_irsdk_frame_with(bytes, table) {
                        if overlay_active {
                            let _ = app.emit_to("overlay", "mmt-irsdk-frame", &frame);
                        }
                        if main_active {
                            let _ = app.emit_to("main", "mmt-irsdk-frame", &frame);
                        }
                        last_frame_emit = Instant::now();
                    }
                }
            }
        }
        drop(mapped);
    }
}

#[cfg(windows)]
fn wide(value: &str) -> Vec<u16> {
    use std::ffi::OsStr;
    use std::os::windows::ffi::OsStrExt;
    OsStr::new(value).encode_wide().chain(std::iter::once(0)).collect()
}
