//! Lectura de la memoria compartida del SDK de iRacing y detección de procesos.
//! Solo `FILE_MAP_READ`. No hay escritura ni mensajes al simulador.

use tauri::AppHandle;

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
    use windows_sys::Win32::System::Memory::{OpenFileMappingW, FILE_MAP_READ};
    let mapping = unsafe { OpenFileMappingW(FILE_MAP_READ, 0, wide("Local\\IRSDKMemMapFileName").as_ptr()) };
    if !mapping.is_null() {
        unsafe { windows_sys::Win32::Foundation::CloseHandle(mapping); }
        return "on_track";
    }
    if is_process_running(&["iRacingSim64DX11.exe", "iRacingSim64.exe"]) {
        return "in_sim";
    }
    if is_process_running(&["iRacingUI.exe", "iRacingService64.exe", "iRacingService.exe"]) {
        return "ui_open";
    }
    "closed"
}

#[cfg(not(windows))]
pub fn current_status() -> &'static str {
    "closed"
}

#[cfg(windows)]
fn is_process_running(target_names: &[&str]) -> bool {
    use windows_sys::Win32::Foundation::{CloseHandle, INVALID_HANDLE_VALUE};
    use windows_sys::Win32::System::Diagnostics::ToolHelp::{
        CreateToolhelp32Snapshot, Process32FirstW, Process32NextW, PROCESSENTRY32W,
        TH32CS_SNAPPROCESS,
    };

    let snapshot = unsafe { CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0) };
    if snapshot == INVALID_HANDLE_VALUE {
        return false;
    }

    let mut entry: PROCESSENTRY32W = unsafe { std::mem::zeroed() };
    entry.dwSize = std::mem::size_of::<PROCESSENTRY32W>() as u32;

    let mut found = false;
    if unsafe { Process32FirstW(snapshot, &mut entry) } != 0 {
        loop {
            let len = entry
                .szExeFile
                .iter()
                .position(|&c| c == 0)
                .unwrap_or(entry.szExeFile.len());
            let name = String::from_utf16_lossy(&entry.szExeFile[..len]).to_lowercase();
            if target_names.iter().any(|target| target.to_lowercase() == name) {
                found = true;
                break;
            }
            if unsafe { Process32NextW(snapshot, &mut entry) } == 0 {
                break;
            }
        }
    }

    unsafe { CloseHandle(snapshot); }
    found
}

#[cfg(windows)]
fn windows_loop(app: AppHandle) {
    use std::time::{Duration, Instant};
    use tauri::Emitter;
    use windows_sys::Win32::Foundation::CloseHandle;
    use windows_sys::Win32::System::Memory::{
        MapViewOfFile, OpenFileMappingW, UnmapViewOfFile, VirtualQuery, FILE_MAP_READ,
        MEMORY_BASIC_INFORMATION,
    };
    use windows_sys::Win32::System::Threading::{OpenEventW, WaitForSingleObject};

    const SYNCHRONIZE: u32 = 0x0010_0000;
    const WAIT_OBJECT_0: u32 = 0;
    let mut last_status_check = Instant::now() - Duration::from_secs(5);

    loop {
        let mapping = unsafe { OpenFileMappingW(FILE_MAP_READ, 0, wide("Local\\IRSDKMemMapFileName").as_ptr()) };
        if mapping.is_null() {
            if last_status_check.elapsed() >= Duration::from_millis(1500) {
                let st = if is_process_running(&["iRacingSim64DX11.exe", "iRacingSim64.exe"]) {
                    "in_sim"
                } else if is_process_running(&["iRacingUI.exe", "iRacingService64.exe", "iRacingService.exe"]) {
                    "ui_open"
                } else {
                    "closed"
                };
                let _ = app.emit("mmt-iracing-status", st);
                last_status_check = Instant::now();
            }
            std::thread::sleep(Duration::from_millis(1000));
            continue;
        }

        let _ = app.emit("mmt-iracing-status", "on_track");
        let view = unsafe { MapViewOfFile(mapping, FILE_MAP_READ, 0, 0, 0) };
        if view.Value.is_null() {
            unsafe { CloseHandle(mapping); }
            std::thread::sleep(Duration::from_millis(500));
            continue;
        }
        let event_name = wide("Local\\IRSDKDataValidEvent");
        let event = unsafe { OpenEventW(SYNCHRONIZE, 0, event_name.as_ptr()) };
        let mut last_emit = Instant::now() - Duration::from_secs(1);
        loop {
            if !event.is_null() {
                let waited = unsafe { WaitForSingleObject(event, 1000) };
                if waited != WAIT_OBJECT_0 {
                    continue;
                }
            } else {
                std::thread::sleep(Duration::from_millis(16));
            }
            if last_emit.elapsed() < Duration::from_millis(50) {
                continue;
            }
            let mut info = unsafe { std::mem::zeroed::<MEMORY_BASIC_INFORMATION>() };
            let queried = unsafe {
                VirtualQuery(view.Value as *const _, &mut info, std::mem::size_of::<MEMORY_BASIC_INFORMATION>())
            };
            if queried == 0 || info.RegionSize < 112 {
                break;
            }
            let bytes = unsafe { std::slice::from_raw_parts(view.Value as *const u8, info.RegionSize) };
            if let Ok(sample) = mmt_sync_core::read_live_sample(bytes) {
                let _ = app.emit("mmt-live", &sample);
                let _ = app.emit("mmt-iracing-status", "on_track");
                last_emit = Instant::now();
            }
        }
        unsafe {
            UnmapViewOfFile(view);
            CloseHandle(mapping);
            if !event.is_null() {
                CloseHandle(event);
            }
        }
    }
}

#[cfg(windows)]
fn wide(value: &str) -> Vec<u16> {
    use std::ffi::OsStr;
    use std::os::windows::ffi::OsStrExt;
    OsStr::new(value).encode_wide().chain(std::iter::once(0)).collect()
}
