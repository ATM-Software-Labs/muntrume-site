//! Lectura de la memoria compartida del SDK de iRacing.
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
fn windows_loop(app: AppHandle) {
    use std::time::{Duration, Instant};
    use tauri::Emitter;
    use windows_sys::Win32::Foundation::CloseHandle;
    use windows_sys::Win32::System::Memory::{
        MapViewOfFile, OpenFileMappingW, UnmapViewOfFile, VirtualQuery, FILE_MAP_READ,
        MEMORY_BASIC_INFORMATION,
    };
    use windows_sys::Win32::System::Threading::{OpenEventW, WaitForSingleObject, WAIT_OBJECT_0};

    const SYNCHRONIZE: u32 = 0x0010_0000;
    loop {
        if !overlays_enabled() {
            std::thread::sleep(Duration::from_secs(1));
            continue;
        }
        let mapping = unsafe { OpenFileMappingW(FILE_MAP_READ, 0, wide("Local\\IRSDKMemMapFileName").as_ptr()) };
        if mapping.is_null() {
            std::thread::sleep(Duration::from_secs(1));
            continue;
        }
        let view = unsafe { MapViewOfFile(mapping, FILE_MAP_READ, 0, 0, 0) };
        if view.is_null() {
            unsafe { CloseHandle(mapping); }
            std::thread::sleep(Duration::from_secs(1));
            continue;
        }
        let event_name = wide("Local\\IRSDKDataValidEvent");
        let event = unsafe { OpenEventW(SYNCHRONIZE, 0, event_name.as_ptr()) };
        let mut last_emit = Instant::now() - Duration::from_secs(1);
        loop {
            if !overlays_enabled() {
                break;
            }
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
                VirtualQuery(view, &mut info, std::mem::size_of::<MEMORY_BASIC_INFORMATION>())
            };
            if queried == 0 || info.RegionSize < 112 {
                break;
            }
            let bytes = unsafe { std::slice::from_raw_parts(view as *const u8, info.RegionSize) };
            if let Ok(sample) = mmt_sync_core::read_live_sample(bytes) {
                let _ = app.emit("mmt-live", &sample);
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

#[cfg(windows)]
fn overlays_enabled() -> bool {
    crate::settings::load()
        .map(|settings| settings.modules.overlays)
        .unwrap_or(false)
}
