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
fn is_irsdk_mapped() -> bool {
    use windows_sys::Win32::Foundation::CloseHandle;
    use windows_sys::Win32::System::Memory::{OpenFileMappingW, FILE_MAP_READ};
    let mapping = unsafe { OpenFileMappingW(FILE_MAP_READ, 0, wide("Local\\IRSDKMemMapFileName").as_ptr()) };
    if !mapping.is_null() {
        unsafe { CloseHandle(mapping); }
        true
    } else {
        false
    }
}

#[cfg(windows)]
pub fn current_status() -> &'static str {
    if is_irsdk_mapped() {
        "on_track"
    } else {
        "closed"
    }
}

#[cfg(not(windows))]
pub fn current_status() -> &'static str {
    "closed"
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
fn extract_yaml_scalar(yaml: &str, key: &str) -> String {
    for line in yaml.lines() {
        let t = line.trim();
        if let Some(rest) = t.strip_prefix(key) {
            return rest.trim().trim_matches('"').trim_matches('\'').to_string();
        }
    }
    String::new()
}

#[cfg(windows)]
#[derive(Default)]
struct LiveSessionTracker {
    sub_session_id: i64,
    track_name: String,
    car_name: String,
    session_type: String,
    last_lap: i32,
    start_pos: i32,
    finish_pos: i32,
    valid_laps: Vec<f64>,
    was_on_track: bool,
    saved_on_finish: bool,
}

#[cfg(windows)]
impl LiveSessionTracker {
    fn update_from_yaml(&mut self, yaml: &str) {
        if let Ok(sid) = extract_yaml_scalar(yaml, "SubSessionID:").parse::<i64>() {
            if sid > 0 && sid != self.sub_session_id {
                self.sub_session_id = sid;
                self.last_lap = 0;
                self.start_pos = 0;
                self.finish_pos = 0;
                self.valid_laps.clear();
                self.saved_on_finish = false;
            }
        }
        let track = extract_yaml_scalar(yaml, "TrackDisplayName:");
        if !track.is_empty() {
            self.track_name = track;
        }
        let car = extract_yaml_scalar(yaml, "CarScreenName:");
        if !car.is_empty() {
            self.car_name = car;
        }
        let stype = extract_yaml_scalar(yaml, "SessionType:");
        if !stype.is_empty() {
            self.session_type = stype;
        }
    }

    fn flush_to_history(&self) {
        if self.valid_laps.is_empty() {
            return;
        }
        let best = self.valid_laps.iter().copied().fold(f64::INFINITY, f64::min);
        let sum: f64 = self.valid_laps.iter().sum();
        let mean = sum / self.valid_laps.len() as f64;
        let sid = if self.sub_session_id > 0 {
            self.sub_session_id
        } else {
            (std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|d| d.as_secs())
                .unwrap_or(1) / 300) as i64
        };
        let fecha = format!(
            "{}",
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|d| d.as_secs())
                .unwrap_or(0)
        );
        let entry = crate::history::RaceSessionEntry {
            sub_session_id: sid,
            fecha,
            circuito: if self.track_name.is_empty() { "iRacing Track".into() } else { self.track_name.clone() },
            coche: if self.car_name.is_empty() { "iRacing Car".into() } else { self.car_name.clone() },
            tipo_sesion: if self.session_type.is_empty() { "Practice".into() } else { self.session_type.clone() },
            pos_salida: self.start_pos,
            pos_final: self.finish_pos,
            incidentes: 0,
            delta_i_rating: 0,
            mejor_vuelta: if best.is_finite() { (best * 1000.0).round() / 1000.0 } else { 0.0 },
            vuelta_media: (mean * 1000.0).round() / 1000.0,
            consistencia_pct: 98.0,
            vueltas_validas: self.valid_laps.len() as i32,
            favorite: false,
            ibt_path: String::new(),
            laps_s: self.valid_laps.clone(),
        };
        let _ = crate::history::record_entry(entry);
    }
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
    const CAPTURE_MS: u64 = 16; // 60 Hz IRSDK live capture
    const FRAME_MS: u64 = 33;
    const MAIN_FRAME_MS: u64 = 100;
    const IRSDK_FRAME_MS: u64 = 100;
    let mut last_status: Option<&'static str> = None;

    loop {
        let mapping = unsafe { OpenFileMappingW(FILE_MAP_READ, 0, wide("Local\\IRSDKMemMapFileName").as_ptr()) };
        if mapping.is_null() {
            emit_status_if_changed(&app, &mut last_status, "closed");
            std::thread::sleep(Duration::from_millis(1000));
            continue;
        }
        let view = unsafe { MapViewOfFile(mapping, FILE_MAP_READ, 0, 0, 0) };
        if view.Value.is_null() {
            unsafe { CloseHandle(mapping); }
            emit_status_if_changed(&app, &mut last_status, "closed");
            std::thread::sleep(Duration::from_millis(1000));
            continue;
        }
        let event = unsafe { OpenEventW(SYNCHRONIZE, 0, wide("Local\\IRSDKDataValidEvent").as_ptr()) };
        let mapped = SdkMap { mapping, view, event };
        emit_status_if_changed(&app, &mut last_status, "on_track");

        // Lazy WebView2: create overlay window only when entering session if overlays enabled
        let should_auto_overlay = crate::settings::load().map(|s| s.modules.overlays).unwrap_or(true);
        if should_auto_overlay && !is_window_active(&app, "overlay") {
            let app_open = app.clone();
            tauri::async_runtime::spawn(async move {
                let _ = crate::set_overlay_visible(app_open, true).await;
            });
        }

        let mut vars: Option<VarTable> = None;
        let mut last_yaml_update: Option<i32> = None;
        let mut overlay_synced_yaml = false;
        let mut main_synced_yaml = false;
        let mut last_emit = Instant::now() - Duration::from_secs(1);
        let mut last_main_emit = Instant::now() - Duration::from_secs(1);
        let mut last_frame_emit = Instant::now() - Duration::from_secs(1);
        let mut last_yaml_emit = Instant::now() - Duration::from_secs(2);
        let mut last_proc = Instant::now();
        let mut last_frame_json = String::new();
        let mut race_finished_emitted = false;
        let mut tracker = LiveSessionTracker::default();
        let mut recorder = crate::live_capture::LiveTelemetryRecorder::default();
        let mut last_capture = Instant::now() - Duration::from_secs(1);
        loop {
            let signaled = if mapped.event.is_null() {
                std::thread::sleep(Duration::from_millis(CAPTURE_MS));
                true
            } else {
                let waited = unsafe { WaitForSingleObject(mapped.event, CAPTURE_MS as u32) };
                waited == WAIT_OBJECT_0
            };
            if last_proc.elapsed() >= Duration::from_millis(1000) {
                last_proc = Instant::now();
                if !is_irsdk_mapped() {
                    recorder.flush_on_disconnect(&app);
                    emit_status_if_changed(&app, &mut last_status, "closed");
                    if is_window_active(&app, "overlay") {
                        let app_close = app.clone();
                        tauri::async_runtime::spawn(async move {
                            let _ = crate::set_overlay_visible(app_close, false).await;
                        });
                    }
                    crate::trim_working_set();
                    break;
                }
            }
            if !signaled {
                continue;
            }
            if last_capture.elapsed() < Duration::from_millis(CAPTURE_MS) {
                continue;
            }
            last_capture = Instant::now();
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
            let mut info = unsafe { std::mem::zeroed::<MEMORY_BASIC_INFORMATION>() };
            let queried = unsafe {
                VirtualQuery(mapped.view.Value as *const _, &mut info, std::mem::size_of::<MEMORY_BASIC_INFORMATION>())
            };
            if queried == 0 || info.RegionSize < 112 {
                recorder.flush_on_disconnect(&app);
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
            if (yaml_changed || need_overlay_yaml || need_main_yaml) && last_yaml_emit.elapsed() >= Duration::from_millis(1000) {
                if let Ok(Ok((u, yaml))) = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
                    read_session_info_yaml(bytes)
                })) {
                    tracker.update_from_yaml(&yaml);
                    recorder.update_from_yaml(&yaml);
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
            let mut latest_sample = None;
            if let Some(table) = vars.as_ref() {
                match std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
                    read_live_sample_with(bytes, table)
                })) {
                    Ok(Ok(sample)) => {
                        if last_emit.elapsed() >= Duration::from_millis(FRAME_MS) {
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
                        latest_sample = Some(sample);
                    }
                    Ok(Err(IbtError::NotConnected)) => {
                        emit_status_if_changed(&app, &mut last_status, "in_sim");
                        clear_vars = true;
                        last_yaml_update = None;
                    }
                    Ok(Err(IbtError::StaleVars)) => clear_vars = true,
                    Ok(Err(_)) | Err(_) => {}
                }
            }
            if clear_vars {
                vars = None;
            }
            if let Some(table) = vars.as_ref() {
                if let Ok(Ok(frame)) = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
                    read_live_irsdk_frame_with(bytes, table)
                })) {
                    if let Some(sample) = latest_sample.as_ref() {
                        recorder.push_frame(&app, sample, &frame);
                    }
                    if last_frame_emit.elapsed() >= Duration::from_millis(IRSDK_FRAME_MS) {
                        let p_idx = frame.player_car_idx.max(0) as usize;
                        let cur_lap = frame.car_idx_lap.get(p_idx).copied().unwrap_or(0);
                        let cur_pos = frame.car_idx_position.get(p_idx).copied().unwrap_or(0);
                        if tracker.start_pos <= 0 && cur_pos > 0 {
                            tracker.start_pos = cur_pos;
                        }
                        if cur_pos > 0 {
                            tracker.finish_pos = cur_pos;
                        }
                        if cur_lap > tracker.last_lap && tracker.last_lap >= 0 {
                            let last_t = frame.car_idx_last_lap_time.get(p_idx).copied().unwrap_or(0.0);
                            if last_t > 5.0 && last_t < 600.0 {
                                tracker.valid_laps.push((last_t * 1000.0).round() / 1000.0);
                                tracker.flush_to_history();
                            }
                        }
                        tracker.last_lap = cur_lap;
                        let left_track = tracker.was_on_track && !frame.is_on_track;
                        tracker.was_on_track = frame.is_on_track;
                        if (frame.session_state == 5 || left_track) && !tracker.saved_on_finish && !tracker.valid_laps.is_empty() {
                            tracker.flush_to_history();
                            tracker.saved_on_finish = true;
                        }

                        if crate::HIDE_OFF_TRACK.load(Ordering::Relaxed) {
                            let editing = crate::OVERLAY_EDITING.load(Ordering::Relaxed);
                            let in_action = frame.is_on_track || frame.is_replay_playing;
                            if overlay_active && !in_action && !editing {
                                crate::OVERLAY_AUTO_HIDDEN_OFF_TRACK.store(true, Ordering::Relaxed);
                                let app_close = app.clone();
                                tauri::async_runtime::spawn(async move {
                                    let _ = crate::set_overlay_visible(app_close, false).await;
                                });
                            } else if !overlay_active
                                && in_action
                                && crate::OVERLAY_AUTO_HIDDEN_OFF_TRACK.load(Ordering::Relaxed)
                            {
                                crate::OVERLAY_AUTO_HIDDEN_OFF_TRACK.store(false, Ordering::Relaxed);
                                let app_open = app.clone();
                                tauri::async_runtime::spawn(async move {
                                    let _ = crate::set_overlay_visible(app_open, true).await;
                                });
                            }
                        }
                        let checkered = (frame.session_flags & 0x0000_0001) != 0;
                        let cooldown = frame.session_state == 5;
                        if !race_finished_emitted && (cooldown || (checkered && frame.on_pit_road)) {
                            race_finished_emitted = true;
                            let _ = app.emit_to("main", "mmt-race-finished", &frame);
                        }
                        if let Ok(json_str) = serde_json::to_string(&frame) {
                            if json_str != last_frame_json {
                                last_frame_json = json_str;
                                if overlay_active {
                                    let _ = app.emit_to("overlay", "mmt-irsdk-frame", &frame);
                                }
                                if main_active {
                                    let _ = app.emit_to("main", "mmt-irsdk-frame", &frame);
                                }
                            }
                        }
                        last_frame_emit = Instant::now();
                    }
                }
            }
        }
        recorder.flush_on_disconnect(&app);
        drop(mapped);
        std::thread::sleep(Duration::from_millis(1000));
    }
}

#[cfg(windows)]
fn wide(value: &str) -> Vec<u16> {
    use std::ffi::OsStr;
    use std::os::windows::ffi::OsStrExt;
    OsStr::new(value).encode_wide().chain(std::iter::once(0)).collect()
}
