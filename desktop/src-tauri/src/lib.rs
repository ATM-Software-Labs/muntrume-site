mod advisor;
mod api;
mod credentials;
mod folders;
mod hardware;
mod history;
mod hotlaps;
mod ibt_parser;
mod live;
mod privacy;
mod settings;
mod state;
mod syncer;

use std::fs;
use std::path::Path;
use std::time::{Duration, Instant};

use serde::Serialize;
use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Emitter, Manager, State, WindowEvent};

use mmt_sync_core::{
    allowed_verify_url, canonical_link_url, load_index, sanitize_filename, save_index, validate_upload,
    MAX_STO_BYTES,
};

use api::{ApiError, Pilot};
use state::{AppState, PendingAuth, StagedFile, StagedMeta};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct Snapshot {
    mock: bool,
    offline: bool,
    pilot: Option<Pilot>,
    settings: settings::Settings,
    library: Vec<syncer::LibraryItem>,
    last_sync_rfc3339: Option<String>,
    last_downloaded: u32,
    last_cars: Vec<String>,
    staged: Option<StagedMeta>,
    update_version: Option<String>,
    folder_exists: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct AuthStartView {
    user_code: String,
    verify_url: String,
    interval: u64,
    expires_in: u64,
}

#[derive(Serialize)]
#[serde(tag = "status")]
enum PollView {
    #[serde(rename = "pending")]
    Pending,
    #[serde(rename = "ready")]
    Ready { pilot: Pilot },
    #[serde(rename = "expired")]
    Expired,
}

pub fn run() {
    let mock = std::env::var("MMT_MOCK").ok().as_deref() == Some("1");
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, args, _cwd| {
            if !handle_cli_or_deep_link(app, &args) {
                show_main(app);
            }
        }))
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec!["--minimized"]),
        ))
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .manage(AppState::new(mock).expect("cliente HTTP"))
        .setup(|app| {
            install_tray(app.handle())?;
            register_mmtsync_protocol();
            let startup_args: Vec<String> = std::env::args().collect();
            let launched_by_deeplink = handle_cli_or_deep_link(app.handle(), &startup_args);
            if startup_args.iter().any(|arg| arg == "--minimized") || launched_by_deeplink {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.hide();
                }
            }
            if let Ok(current) = settings::load() {
                let _ = apply_autostart(app.handle(), current.start_with_windows);
            }
            spawn_scheduler(app.handle().clone());
            spawn_update_check(app.handle().clone());
            live::spawn(app.handle().clone());
            spawn_overlay_hotkeys(app.handle().clone());
            spawn_local_bridge(app.handle().clone());
            Ok(())
        })
        .on_window_event(|window, event| match event {
            WindowEvent::CloseRequested { api, .. } => {
                if window.label() == "main" {
                    api.prevent_close();
                    let _ = window.hide();
                    trim_working_set();
                }
            }
            WindowEvent::DragDrop(tauri::DragDropEvent::Drop { paths, .. }) => {
                match stage_paths(window.app_handle(), paths) {
                    Ok(Some(meta)) => {
                        let _ = window.emit("mmt-staged", meta);
                    }
                    Ok(None) => {}
                    Err(message) => {
                        let _ = window.emit("mmt-notice", message);
                    }
                }
            }
            _ => {}
        })
        .invoke_handler(tauri::generate_handler![
            snapshot,
            auth_start,
            auth_cancel,
            auth_poll,
            open_verify,
            logout,
            sync_now,
            save_settings,
            pick_folder,
            detect_folder,
            detect_iracing_paths,
            pick_sto,
            clear_staged,
            upload_staged,
            install_update,
            inspect_config,
            check_iracing_status,
            detect_hardware,
            toggle_overlay,
            recenter_overlay,
            set_overlay_edit,
            set_main_telemetry,
            parse_ibt_telemetry,
            read_latest_ibt,
            list_ibt_sessions,
            read_ibt_file,
            get_ibt_storage_stats,
            cleanup_old_ibt_files,
            redact_session_info,
            get_race_history,
            record_race_session,
            toggle_favorite_session,
            find_reference_hotlap,
            find_latest_replay_clip,
            pick_videos_folder,
            send_iracing_pit_fuel,
            quit
        ])
        .run(tauri::generate_context!())
        .expect("MMT Sync no pudo abrir la ventana");
}

fn install_tray(app: &AppHandle) -> tauri::Result<()> {
    let menu = Menu::with_items(
        app,
        &[
            &MenuItem::with_id(app, "open", "Abrir MMT Sync", true, None::<&str>)?,
            &MenuItem::with_id(app, "toggle_overlays", "Activar/Pausar Overlays", true, None::<&str>)?,
            &MenuItem::with_id(app, "edit_hud", "Modo Edición HUD", true, None::<&str>)?,
            &MenuItem::with_id(app, "sync", "Sincronizar setups", true, None::<&str>)?,
            &MenuItem::with_id(app, "quit", "Salir completamente", true, None::<&str>)?,
        ],
    )?;
    let icon = tauri::image::Image::from_bytes(include_bytes!("../icons/32x32.png"))?;
    TrayIconBuilder::with_id("mmt")
        .icon(icon)
        .menu(&menu)
        .tooltip("MMT Sync")
        .on_menu_event(|app, event| match event.id.as_ref() {
            "sync" => {
                let app = app.clone();
                tauri::async_runtime::spawn(async move {
                    if let Ok(report) = syncer::synchronize(&app).await {
                        if report.downloaded > 0 {
                            let _ = app.emit_to("overlay", "mmt-setup-updated", report.downloaded);
                        }
                    }
                    let _ = app.emit("mmt-refresh", ());
                });
            }
            "toggle_overlays" => {
                let app_clone = app.clone();
                let show = app.get_webview_window("overlay").is_none();
                tauri::async_runtime::spawn(async move {
                    let _ = toggle_overlay(app_clone, show).await;
                });
            }
            "edit_hud" => {
                if let Some(window) = app.get_webview_window("overlay") {
                    let next = !OVERLAY_EDITING.load(std::sync::atomic::Ordering::Relaxed);
                    apply_overlay_edit_state(app, &window, next);
                }
            }
            "open" => show_main(app),
            "quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                show_main(tray.app_handle());
            }
        })
        .build(app)?;
    Ok(())
}

fn show_main(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

fn spawn_scheduler(app: AppHandle) {
    std::thread::Builder::new()
        .name("mmt-scheduler".into())
        .spawn(move || {
            let mut last = Instant::now()
                .checked_sub(Duration::from_secs(24 * 60 * 60))
                .unwrap_or_else(Instant::now);
            loop {
                std::thread::sleep(Duration::from_secs(20));
                let Ok(current) = settings::load() else {
                    continue;
                };
                if !current.auto_sync {
                    continue;
                }
                let wait = Duration::from_secs(u64::from(current.interval_minutes.clamp(5, 720)) * 60);
                if last.elapsed() < wait {
                    continue;
                }
                if app.state::<AppState>().token().is_err() {
                    continue;
                }
                last = Instant::now();
                let handle = app.clone();
                tauri::async_runtime::spawn(async move {
                    if let Err(err) = syncer::synchronize(&handle).await {
                        if err.contains("Acceso restringido a pilotos autorizados de Muntrume Motorsport") {
                            if let Ok(mut cfg) = settings::load() {
                                cfg.auto_sync = false;
                                let _ = settings::save(&cfg);
                            }
                            let _ = handle.emit("mmt-notice", err);
                        }
                    }
                    let _ = handle.emit("mmt-refresh", ());
                });
            }
        })
        .ok();
}

fn spawn_update_check(app: AppHandle) {
    tauri::async_runtime::spawn(async move {
        tokio::time::sleep(Duration::from_secs(3)).await;
        if live::current_status() == "on_track" {
            return;
        }
        use tauri_plugin_updater::UpdaterExt;
        let Ok(updater) = app.updater() else {
            return;
        };
        let Ok(Some(update)) = updater.check().await else {
            return;
        };
        let version = update.version.clone();
        let notes = update.body.clone().unwrap_or_default();
        if let Ok(mut slot) = app.state::<AppState>().update_version.lock() {
            *slot = Some(version.clone());
        }
        let _ = app.emit("mmt-update", version);
        if !notes.trim().is_empty() {
            let _ = app.emit("mmt-update-notes", notes);
        }
    });
}

fn apply_autostart(app: &AppHandle, enabled: bool) -> Result<(), String> {
    use tauri_plugin_autostart::ManagerExt;
    let auto = app.autolaunch();
    let result = if enabled { auto.enable() } else { auto.disable() };
    result.map_err(|err| err.to_string())
}

fn index_file() -> std::path::PathBuf {
    folders::app_data_dir().join("index.json")
}

#[tauri::command]
async fn snapshot(state: State<'_, AppState>) -> Result<Snapshot, String> {
    let current = settings::load()?;
    let path = index_file();
    let mut index = load_index(&path).map_err(|err| err.to_string())?;
    let (pilot, offline) = session_pilot(&state, &mut index).await;
    if pilot.is_some() {
        let _ = save_index(&path, &index);
    }
    let staged = state
        .staged
        .lock()
        .map_err(|_| "No se pudo leer el archivo elegido.".to_string())?
        .as_ref()
        .map(|file| StagedMeta {
            filename: file.filename.clone(),
            size: file.bytes.len() as u64,
        });
    let update_version = state
        .update_version
        .lock()
        .map_err(|_| "No se pudo leer la actualización.".to_string())?
        .clone();
    Ok(Snapshot {
        mock: state.api.mock,
        offline,
        pilot,
        folder_exists: Path::new(&current.setups_dir).is_dir(),
        settings: current,
        library: syncer::library_of(&index),
        last_sync_rfc3339: index.last_sync_rfc3339,
        last_downloaded: index.last_downloaded,
        last_cars: index.last_cars,
        staged,
        update_version,
    })
}

async fn session_pilot(state: &AppState, index: &mut mmt_sync_core::IndexFile) -> (Option<Pilot>, bool) {
    let Ok(token) = state.token() else {
        return (None, false);
    };
    match state.api.me(&token).await {
        Ok(pilot) => {
            index.pilot_slug = Some(pilot.slug.clone());
            index.pilot_name = Some(pilot.name.clone());
            (Some(pilot), false)
        }
        Err(ApiError::Unauthorized) => {
            let _ = state.clear_session();
            (None, false)
        }
        Err(_) => {
            let cached = match (&index.pilot_slug, &index.pilot_name) {
                (Some(slug), Some(name)) => Some(Pilot {
                    slug: slug.clone(),
                    name: name.clone(),
                }),
                _ => None,
            };
            (cached, true)
        }
    }
}

#[tauri::command]
async fn auth_start(state: State<'_, AppState>) -> Result<AuthStartView, String> {
    let started = state.api.start().await.map_err(|err| err.to_string())?;
    let verify_url = allowed_verify_url(&started.verify_url)
        .or_else(|| canonical_link_url(&started.user_code))
        .ok_or_else(|| "El API no devolvió una página de muntru.me.".to_string())?;
    let interval = started.interval.clamp(1, 30);
    *state.pending.lock().map_err(|_| "No se pudo iniciar la vinculación.".to_string())? = Some(PendingAuth {
        device_code: started.device_code,
        user_code: started.user_code.clone(),
        verify_url,
        interval: Duration::from_secs(interval),
        expires_at: Instant::now() + Duration::from_secs(started.expires_in.min(1800)),
        next_poll: Instant::now(),
        polls: 0,
    });
    let pending = state.pending.lock().map_err(|_| "No se pudo iniciar la vinculación.".to_string())?;
    let pending = pending.as_ref().expect("recién guardado");
    Ok(AuthStartView {
        user_code: pending.user_code.clone(),
        verify_url: pending.verify_url.clone(),
        interval,
        expires_in: started.expires_in.min(1800),
    })
}

#[tauri::command]
fn auth_cancel(state: State<'_, AppState>) -> Result<(), String> {
    *state.pending.lock().map_err(|_| "No se pudo cancelar.".to_string())? = None;
    Ok(())
}

#[tauri::command]
async fn auth_poll(state: State<'_, AppState>) -> Result<PollView, String> {
    let pending = state
        .pending
        .lock()
        .map_err(|_| "No se pudo consultar la vinculación.".to_string())?
        .as_ref()
        .map(|item| (item.device_code.clone(), item.expires_at, item.next_poll, item.polls, item.interval))
        .ok_or_else(|| "No hay una vinculación en curso.".to_string())?;
    let (device_code, expires_at, next_poll, polls, interval) = pending;
    if Instant::now() >= expires_at {
        *state.pending.lock().map_err(|_| "bloqueo".to_string())? = None;
        return Ok(PollView::Expired);
    }
    if polls > 0 && Instant::now() < next_poll {
        return Ok(PollView::Pending);
    }
    if state.api.mock && polls == 0 {
        let mut guard = state.pending.lock().map_err(|_| "bloqueo".to_string())?;
        if let Some(item) = guard.as_mut() {
            item.polls = 1;
            item.next_poll = Instant::now() + interval;
        }
        return Ok(PollView::Pending);
    }
    match state.api.poll(&device_code).await {
        Ok(ready) => {
            state.store_session(&ready.token)?;
            *state.pending.lock().map_err(|_| "bloqueo".to_string())? = None;
            Ok(PollView::Ready { pilot: ready.pilot })
        }
        Err(ApiError::Pending) => {
            let mut guard = state.pending.lock().map_err(|_| "bloqueo".to_string())?;
            if let Some(item) = guard.as_mut() {
                item.polls = item.polls.saturating_add(1);
                item.next_poll = Instant::now() + interval;
            }
            Ok(PollView::Pending)
        }
        Err(ApiError::Expired) => {
            *state.pending.lock().map_err(|_| "bloqueo".to_string())? = None;
            Ok(PollView::Expired)
        }
        Err(err) => Err(err.to_string()),
    }
}

#[tauri::command]
fn open_verify(state: State<'_, AppState>) -> Result<(), String> {
    let guard = state.pending.lock().map_err(|_| "No hay un código para abrir.".to_string())?;
    let pending = guard.as_ref().ok_or_else(|| "No hay un código para abrir.".to_string())?;
    let url = allowed_verify_url(&pending.verify_url)
        .or_else(|| canonical_link_url(&pending.user_code))
        .ok_or_else(|| "Solo abro páginas https://muntru.me.".to_string())?;
    drop(guard);
    open::that(url).map_err(|_| "No pude abrir el navegador.".to_string())
}

#[tauri::command]
async fn logout(state: State<'_, AppState>) -> Result<(), String> {
    if let Ok(token) = state.token() {
        let _ = state.api.logout(&token).await;
    }
    state.clear_session()?;
    *state.pending.lock().map_err(|_| "bloqueo".to_string())? = None;
    Ok(())
}

#[tauri::command]
async fn sync_now(app: AppHandle) -> Result<syncer::SyncReport, String> {
    let report = syncer::synchronize(&app).await?;
    if report.downloaded > 0 {
        let _ = app.emit_to("overlay", "mmt-setup-updated", report.downloaded);
    }
    let _ = app.emit("mmt-refresh", ());
    Ok(report)
}

#[tauri::command]
fn save_settings(app: AppHandle, patch: settings::SettingsPatch) -> Result<settings::Settings, String> {
    let saved = settings::update(patch)?;
    apply_autostart(&app, saved.start_with_windows)?;
    Ok(saved)
}

#[tauri::command]
async fn pick_folder() -> Result<Option<settings::Settings>, String> {
    let picked = tauri::async_runtime::spawn_blocking(|| {
        rfd::FileDialog::new()
            .set_title("Carpeta de setups de iRacing")
            .pick_folder()
    })
    .await
    .map_err(|err| err.to_string())?;
    let Some(path) = picked else {
        return Ok(None);
    };
    settings::set_setups_dir(&path, true).map(Some)
}

#[tauri::command]
fn detect_folder() -> Result<settings::Settings, String> {
    let dir = folders::detect_setups_dir()
        .ok_or_else(|| "No encuentro la carpeta Documentos. Elige la de iRacing a mano.".to_string())?;
    settings::set_setups_dir(&dir, false)
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct IracingPathsStatus {
    base_path: String,
    base_exists: bool,
    setups_path: String,
    setups_exists: bool,
    telemetry_path: String,
    telemetry_exists: bool,
}

#[tauri::command]
fn detect_iracing_paths() -> IracingPathsStatus {
    let setups = folders::detect_setups_dir();
    let telemetry = folders::detect_telemetry_dir();
    let base = setups
        .as_ref()
        .and_then(|p| p.parent().map(|d| d.to_path_buf()))
        .or_else(|| telemetry.as_ref().and_then(|p| p.parent().map(|d| d.to_path_buf())));

    IracingPathsStatus {
        base_path: base.as_ref().map(|p| p.display().to_string()).unwrap_or_default(),
        base_exists: base.as_ref().map(|p| p.exists()).unwrap_or(false),
        setups_path: setups.as_ref().map(|p| p.display().to_string()).unwrap_or_default(),
        setups_exists: setups.as_ref().map(|p| p.exists()).unwrap_or(false),
        telemetry_path: telemetry.as_ref().map(|p| p.display().to_string()).unwrap_or_default(),
        telemetry_exists: telemetry.as_ref().map(|p| p.exists()).unwrap_or(false),
    }
}

#[tauri::command]
async fn pick_sto(state: State<'_, AppState>) -> Result<Option<StagedMeta>, String> {
    let picked = tauri::async_runtime::spawn_blocking(|| {
        rfd::FileDialog::new()
            .set_title("Elegir setup .sto")
            .add_filter("Setup iRacing", &["sto"])
            .pick_file()
    })
    .await
    .map_err(|err| err.to_string())?;
    let Some(path) = picked else {
        return Ok(None);
    };
    let (name, bytes) = read_sto(&path)?;
    stage_bytes(&state, &name, bytes).map(Some)
}

#[tauri::command]
fn clear_staged(state: State<'_, AppState>) -> Result<(), String> {
    *state.staged.lock().map_err(|_| "No se pudo quitar el archivo.".to_string())? = None;
    Ok(())
}

#[tauri::command]
async fn upload_staged(
    state: State<'_, AppState>,
    car_folder: String,
    track: String,
    kind: String,
    notes: String,
) -> Result<String, String> {
    let staged = state
        .staged
        .lock()
        .map_err(|_| "No se pudo leer el archivo.".to_string())?
        .as_ref()
        .map(|file| (file.filename.clone(), file.bytes.clone()))
        .ok_or_else(|| "Elige un archivo .sto.".to_string())?;
    let (filename, bytes) = staged;
    let kind = validate_upload(&filename, bytes.len() as u64, &car_folder, &track, &kind, &notes)
        .map_err(|err| err.to_string())?;
    let token = state.token()?;
    state
        .api
        .upload(
            &token,
            api::UploadRequest {
                filename,
                bytes,
                car_folder,
                track,
                kind: kind.to_string(),
                notes,
            },
        )
        .await
        .map_err(|err| err.to_string())?;
    *state.staged.lock().map_err(|_| "No se pudo cerrar el envío.".to_string())? = None;
    Ok("Enviado a revisión en la Sala de ingenieros".into())
}

#[tauri::command]
async fn install_update(app: AppHandle) -> Result<(), String> {
    use tauri_plugin_updater::UpdaterExt;
    let updater = app.updater().map_err(|err| err.to_string())?;
    let Some(update) = updater.check().await.map_err(|err| err.to_string())? else {
        return Err("No hay una actualización publicada.".into());
    };
    let mut downloaded: usize = 0;
    let app_prog = app.clone();
    update
        .download_and_install(
            move |chunk, total| {
                downloaded = downloaded.saturating_add(chunk);
                if let Some(total_bytes) = total {
                    if total_bytes > 0 {
                        let pct = ((downloaded as f64 / total_bytes as f64) * 100.0).round() as u32;
                        let _ = app_prog.emit_to("main", "mmt-update-progress", pct.min(100));
                    }
                }
            },
            || {},
        )
        .await
        .map_err(|err| err.to_string())?;
    app.restart();
}

#[tauri::command]
fn inspect_config() -> Result<advisor::IracingAnalysis, String> {
    Ok(advisor::analyze())
}

#[tauri::command]
fn check_iracing_status() -> &'static str {
    live::current_status()
}

#[tauri::command]
fn detect_hardware() -> Result<hardware::HardwareReport, String> {
    Ok(hardware::detect())
}

const LOW_MEM_WEBVIEW_ARGS: &str = "--disable-gpu-vsync --disable-features=msWebOOUI,msPdfOOUI,Translate,BackForwardCache --disable-extensions --disable-background-networking --disable-sync --disable-translate --disable-default-apps --renderer-process-limit=1 --js-flags=--max-old-space-size=256";

#[cfg(windows)]
pub(crate) fn trim_working_set() {
    use windows_sys::Win32::System::ProcessStatus::K32EmptyWorkingSet;
    use windows_sys::Win32::System::Threading::GetCurrentProcess;
    unsafe {
        let _ = K32EmptyWorkingSet(GetCurrentProcess());
    }
}

#[cfg(not(windows))]
pub(crate) fn trim_working_set() {}

static OVERLAY_EDITING: std::sync::atomic::AtomicBool = std::sync::atomic::AtomicBool::new(false);
static LAST_EXT_CMD_MS: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(0);

#[cfg(windows)]
fn register_mmtsync_protocol() {
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x0800_0000;
    let Ok(exe) = std::env::current_exe() else {
        return;
    };
    let exe_str = exe.to_string_lossy();
    let cmd_val = format!("\"{}\" \"%1\"", exe_str);
    std::thread::spawn(move || {
        let _ = std::process::Command::new("reg")
            .args(["add", "HKCU\\Software\\Classes\\mmtsync", "/ve", "/d", "URL:MMT Sync Protocol", "/f"])
            .creation_flags(CREATE_NO_WINDOW)
            .status();
        let _ = std::process::Command::new("reg")
            .args(["add", "HKCU\\Software\\Classes\\mmtsync", "/v", "URL Protocol", "/d", "", "/f"])
            .creation_flags(CREATE_NO_WINDOW)
            .status();
        let _ = std::process::Command::new("reg")
            .args([
                "add",
                "HKCU\\Software\\Classes\\mmtsync\\shell\\open\\command",
                "/ve",
                "/d",
                &cmd_val,
                "/f",
            ])
            .creation_flags(CREATE_NO_WINDOW)
            .status();
    });
}

#[cfg(not(windows))]
fn register_mmtsync_protocol() {}

fn sanitize_deeplink_action(raw: &str) -> Option<&'static str> {
    let trimmed = raw.trim().trim_matches('"');
    let without_scheme = trimmed.strip_prefix("mmtsync://").unwrap_or(trimmed);
    let action = without_scheme
        .split(&['/', '?', '#', '&'][..])
        .find(|s| !s.is_empty())?;
    match action {
        "launch-overlay" => Some("launch-overlay"),
        "edit-hud" => Some("edit-hud"),
        "sync-week" => Some("sync-week"),
        _ => None,
    }
}

fn handle_external_command(app: &AppHandle, action: &str) -> bool {
    let Some(clean) = sanitize_deeplink_action(action) else {
        return false;
    };
    let now_ms = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0);
    let prev = LAST_EXT_CMD_MS.load(std::sync::atomic::Ordering::Relaxed);
    if now_ms.saturating_sub(prev) < 1500 {
        return true;
    }
    LAST_EXT_CMD_MS.store(now_ms, std::sync::atomic::Ordering::Relaxed);

    let app_clone = app.clone();
    match clean {
        "launch-overlay" => {
            tauri::async_runtime::spawn(async move {
                let _ = toggle_overlay(app_clone, true).await;
            });
        }
        "edit-hud" => {
            tauri::async_runtime::spawn(async move {
                if toggle_overlay(app_clone.clone(), true).await.is_ok() {
                    if let Some(window) = app_clone.get_webview_window("overlay") {
                        apply_overlay_edit_state(&app_clone, &window, true);
                    }
                }
            });
        }
        "sync-week" => {
            tauri::async_runtime::spawn(async move {
                if let Ok(report) = syncer::synchronize(&app_clone).await {
                    if report.downloaded > 0 {
                        let _ = app_clone.emit_to("overlay", "mmt-setup-updated", report.downloaded);
                    }
                }
                let _ = app_clone.emit("mmt-refresh", ());
            });
        }
        _ => return false,
    }
    true
}

fn handle_cli_or_deep_link(app: &AppHandle, args: &[String]) -> bool {
    for arg in args {
        if arg.starts_with("mmtsync://") && handle_external_command(app, arg) {
            return true;
        }
    }
    false
}

fn spawn_local_bridge(app: AppHandle) {
    use std::io::{Read, Write};
    use std::net::TcpListener;
    std::thread::Builder::new()
        .name("mmt-local-bridge".into())
        .spawn(move || {
            let Ok(listener) = TcpListener::bind("127.0.0.1:38421") else {
                return;
            };
            for stream in listener.incoming().flatten() {
                let mut stream = stream;
                let _ = stream.set_read_timeout(Some(Duration::from_millis(400)));
                let _ = stream.set_write_timeout(Some(Duration::from_millis(400)));
                let mut buf = [0u8; 2048];
                let Ok(n) = stream.read(&mut buf) else {
                    continue;
                };
                if n == 0 {
                    continue;
                }
                let req = String::from_utf8_lossy(&buf[..n]);
                let first_line = req.lines().next().unwrap_or("");
                let origin = req
                    .lines()
                    .find_map(|l| {
                        let (k, v) = l.split_once(':')?;
                        if k.eq_ignore_ascii_case("origin") {
                            Some(v.trim())
                        } else {
                            None
                        }
                    })
                    .unwrap_or("https://muntru.me");
                let allowed_origin = if origin == "https://muntru.me"
                    || origin == "https://www.muntru.me"
                    || origin.starts_with("http://localhost:")
                    || origin.starts_with("http://127.0.0.1:")
                {
                    origin
                } else {
                    "https://muntru.me"
                };

                let cors_headers = format!(
                    "Access-Control-Allow-Origin: {allowed_origin}\r\nAccess-Control-Allow-Methods: GET, POST, OPTIONS\r\nAccess-Control-Allow-Headers: Content-Type\r\nAccess-Control-Allow-Private-Network: true\r\nConnection: close\r\n"
                );

                if first_line.starts_with("OPTIONS ") {
                    let resp = format!("HTTP/1.1 204 No Content\r\n{cors_headers}\r\n");
                    let _ = stream.write_all(resp.as_bytes());
                    continue;
                }

                if first_line.starts_with("GET /ping") {
                    let in_track = live::current_status() == "on_track";
                    let body = format!(
                        "{{\"status\":\"ready\",\"version\":\"{}\",\"inTrack\":{}}}",
                        env!("CARGO_PKG_VERSION"),
                        in_track
                    );
                    let resp = format!(
                        "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\n{cors_headers}\r\n{body}",
                        body.len()
                    );
                    let _ = stream.write_all(resp.as_bytes());
                    continue;
                }

                if first_line.starts_with("POST /command") {
                    let body_part = req.split("\r\n\r\n").nth(1).unwrap_or("");
                    let action = if body_part.contains("edit-hud") {
                        "edit-hud"
                    } else if body_part.contains("sync-week") {
                        "sync-week"
                    } else {
                        "launch-overlay"
                    };
                    let ok = handle_external_command(&app, action);
                    let resp_body = if ok {
                        "{\"ok\":true,\"message\":\"Overlays activados en MMT Sync\"}"
                    } else {
                        "{\"ok\":false,\"message\":\"Comando ignorado\"}"
                    };
                    let resp = format!(
                        "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\n{cors_headers}\r\n{resp_body}",
                        resp_body.len()
                    );
                    let _ = stream.write_all(resp.as_bytes());
                    continue;
                }

                let not_found = format!("HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\n{cors_headers}\r\n");
                let _ = stream.write_all(not_found.as_bytes());
            }
        })
        .ok();
}

fn apply_overlay_edit_state(app: &AppHandle, window: &tauri::WebviewWindow, editing: bool) {
    OVERLAY_EDITING.store(editing, std::sync::atomic::Ordering::Relaxed);
    if editing {
        fit_overlay(window);
        let _ = window.set_ignore_cursor_events(false);
        let _ = window.set_focus();
    } else {
        let _ = window.set_ignore_cursor_events(true);
    }
    let _ = window.set_always_on_top(true);
    let _ = window.emit("mmt-overlay-edit", editing);
    let _ = app.emit_to("main", "mmt-overlay-edit", editing);
}

#[cfg(windows)]
fn spawn_overlay_hotkeys(app: AppHandle) {
    use windows_sys::Win32::UI::Input::KeyboardAndMouse::{
        GetAsyncKeyState, VK_F10, VK_F9, VK_MENU,
    };
    std::thread::spawn(move || {
        let mut prev_f9 = false;
        let mut prev_f10 = false;
        let mut prev_alt_e = false;
        let mut prev_alt_h = false;
        let mut prev_alt_r = false;
        loop {
            std::thread::sleep(std::time::Duration::from_millis(60));
            let f9_down = unsafe { (GetAsyncKeyState(VK_F9 as i32) as u16 & 0x8000) != 0 };
            let f10_down = unsafe { (GetAsyncKeyState(VK_F10 as i32) as u16 & 0x8000) != 0 };
            let alt_down = unsafe { (GetAsyncKeyState(VK_MENU as i32) as u16 & 0x8000) != 0 };
            let alt_e = alt_down && unsafe { (GetAsyncKeyState(b'E' as i32) as u16 & 0x8000) != 0 };
            let alt_h = alt_down && unsafe { (GetAsyncKeyState(b'H' as i32) as u16 & 0x8000) != 0 };
            let alt_r = alt_down && unsafe { (GetAsyncKeyState(b'R' as i32) as u16 & 0x8000) != 0 };

            if (f9_down && !prev_f9) || (alt_e && !prev_alt_e) {
                if let Some(window) = app.get_webview_window("overlay") {
                    let next = !OVERLAY_EDITING.load(std::sync::atomic::Ordering::Relaxed);
                    apply_overlay_edit_state(&app, &window, next);
                }
            }
            if (f10_down && !prev_f10) || (alt_h && !prev_alt_h) {
                let app_clone = app.clone();
                let show = app.get_webview_window("overlay").is_none();
                tauri::async_runtime::spawn(async move {
                    let _ = toggle_overlay(app_clone, show).await;
                });
            }
            if alt_r && !prev_alt_r {
                let _ = app.emit_to("overlay", "mmt-reset-delta", ());
            }
            prev_f9 = f9_down;
            prev_f10 = f10_down;
            prev_alt_e = alt_e;
            prev_alt_h = alt_h;
            prev_alt_r = alt_r;
        }
    });
}

#[cfg(not(windows))]
fn spawn_overlay_hotkeys(_app: AppHandle) {}

#[tauri::command]
async fn toggle_overlay(app: AppHandle, show: bool) -> Result<bool, String> {
    set_overlay_visible(app, show).await
}

pub(crate) async fn set_overlay_visible(app: AppHandle, show: bool) -> Result<bool, String> {
    if show {
        OVERLAY_EDITING.store(false, std::sync::atomic::Ordering::Relaxed);
        if let Some(window) = app.get_webview_window("overlay") {
            fit_overlay(&window);
            let _ = window.set_always_on_top(true);
            let _ = window.set_ignore_cursor_events(true);
            let _ = window.show();
            let _ = app.emit_to("main", "mmt-overlay-visibility", true);
            return Ok(true);
        }
        let builder = tauri::WebviewWindowBuilder::new(
            &app,
            "overlay",
            tauri::WebviewUrl::App("index.html?overlay=1".into()),
        )
        .title("MMT Sync")
        .inner_size(1920.0, 1080.0)
        .transparent(true)
        .always_on_top(true)
        .decorations(false)
        .skip_taskbar(true)
        .visible(false)
        .shadow(false)
        .resizable(true)
        .maximized(true)
        .additional_browser_args(LOW_MEM_WEBVIEW_ARGS);
        let window = builder
            .build()
            .map_err(|e| format!("No se pudo abrir el overlay: {e}"))?;
        fit_overlay(&window);
        let _ = window.set_ignore_cursor_events(true);
        let _ = window.show();
        let _ = app.emit_to("main", "mmt-overlay-visibility", true);
        Ok(true)
    } else {
        OVERLAY_EDITING.store(false, std::sync::atomic::Ordering::Relaxed);
        if let Some(window) = app.get_webview_window("overlay") {
            let _ = window.close();
        }
        trim_working_set();
        let _ = app.emit_to("main", "mmt-overlay-visibility", false);
        Ok(false)
    }
}

#[tauri::command]
async fn set_overlay_edit(app: AppHandle, editing: bool) -> Result<(), String> {
    let window = app.get_webview_window("overlay").ok_or("Ventana de overlay no encontrada")?;
    apply_overlay_edit_state(&app, &window, editing);
    Ok(())
}

#[tauri::command]
fn set_main_telemetry(enabled: bool) {
    live::MAIN_TELEMETRY_ENABLED.store(enabled, std::sync::atomic::Ordering::Relaxed);
}

#[tauri::command]
async fn recenter_overlay(app: AppHandle) -> Result<bool, String> {
    if let Some(window) = app.get_webview_window("overlay") {
        fit_overlay(&window);
        let _ = window.set_always_on_top(true);
        let _ = window.set_ignore_cursor_events(true);
        return Ok(true);
    }
    Ok(false)
}

fn fit_overlay(window: &tauri::WebviewWindow) {
    use tauri::{PhysicalPosition, PhysicalSize};
    let monitor = window.current_monitor().ok().flatten().or_else(|| window.primary_monitor().ok().flatten());
    if let Some(monitor) = monitor {
        let size = monitor.size();
        let pos = monitor.position();
        let _ = window.set_position(PhysicalPosition::new(pos.x, pos.y));
        let _ = window.set_size(PhysicalSize::new(size.width, size.height));
    }
}

#[tauri::command]
async fn parse_ibt_telemetry(path: String) -> Result<Vec<ibt_parser::TelemetrySample>, String> {
    let pb = std::path::PathBuf::from(path);
    tauri::async_runtime::spawn_blocking(move || ibt_parser::parse_ibt_channels(&pb))
        .await
        .map_err(|e| format!("Error en tarea de telemetría: {e}"))?
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct IbtStorageStats {
    total_files: usize,
    total_bytes: u64,
    old_files_count: usize,
    old_bytes: u64,
    deleted_count: usize,
    freed_bytes: u64,
}

#[tauri::command]
async fn get_ibt_storage_stats(max_age_days: u32) -> Result<IbtStorageStats, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let Some(dir) = folders::detect_telemetry_dir() else {
            return Ok(IbtStorageStats { total_files: 0, total_bytes: 0, old_files_count: 0, old_bytes: 0, deleted_count: 0, freed_bytes: 0 });
        };
        let Ok(entries) = fs::read_dir(&dir) else {
            return Ok(IbtStorageStats { total_files: 0, total_bytes: 0, old_files_count: 0, old_bytes: 0, deleted_count: 0, freed_bytes: 0 });
        };
        let now = std::time::SystemTime::now();
        let cutoff = std::time::Duration::from_secs(u64::from(max_age_days.max(1)) * 24 * 3600);
        let mut total_files = 0usize;
        let mut total_bytes = 0u64;
        let mut old_files_count = 0usize;
        let mut old_bytes = 0u64;
        for entry in entries.flatten() {
            let p = entry.path();
            if p.extension().and_then(|e| e.to_str()).is_some_and(|e| e.eq_ignore_ascii_case("ibt")) {
                if let Ok(meta) = entry.metadata() {
                    let len = meta.len();
                    total_files += 1;
                    total_bytes += len;
                    if max_age_days > 0 {
                        if let Ok(modified) = meta.modified() {
                            if now.duration_since(modified).map_or(false, |d| d > cutoff) {
                                old_files_count += 1;
                                old_bytes += len;
                            }
                        }
                    }
                }
            }
        }
        Ok(IbtStorageStats { total_files, total_bytes, old_files_count, old_bytes, deleted_count: 0, freed_bytes: 0 })
    })
    .await
    .map_err(|e| format!("Error leyendo espacio .ibt: {e}"))?
}

#[tauri::command]
async fn cleanup_old_ibt_files(max_age_days: u32) -> Result<IbtStorageStats, String> {
    if max_age_days == 0 {
        return get_ibt_storage_stats(0).await;
    }
    tauri::async_runtime::spawn_blocking(move || {
        let Some(dir) = folders::detect_telemetry_dir() else {
            return Ok(IbtStorageStats { total_files: 0, total_bytes: 0, old_files_count: 0, old_bytes: 0, deleted_count: 0, freed_bytes: 0 });
        };
        let Ok(entries) = fs::read_dir(&dir) else {
            return Ok(IbtStorageStats { total_files: 0, total_bytes: 0, old_files_count: 0, old_bytes: 0, deleted_count: 0, freed_bytes: 0 });
        };
        let now = std::time::SystemTime::now();
        let cutoff = std::time::Duration::from_secs(u64::from(max_age_days) * 24 * 3600);
        let mut total_files = 0usize;
        let mut total_bytes = 0u64;
        let mut deleted_count = 0usize;
        let mut freed_bytes = 0u64;
        for entry in entries.flatten() {
            let p = entry.path();
            if p.extension().and_then(|e| e.to_str()).is_some_and(|e| e.eq_ignore_ascii_case("ibt")) {
                if let Ok(meta) = entry.metadata() {
                    let len = meta.len();
                    let is_old = meta.modified().ok().and_then(|m| now.duration_since(m).ok()).is_some_and(|d| d > cutoff);
                    if is_old && fs::remove_file(&p).is_ok() {
                        deleted_count += 1;
                        freed_bytes += len;
                    } else {
                        total_files += 1;
                        total_bytes += len;
                    }
                }
            }
        }
        Ok(IbtStorageStats { total_files, total_bytes, old_files_count: 0, old_bytes: 0, deleted_count, freed_bytes })
    })
    .await
    .map_err(|e| format!("Error limpiando .ibt antiguos: {e}"))?
}

#[tauri::command]
async fn list_ibt_sessions() -> Result<Vec<ibt_parser::IbtSessionMeta>, String> {
    tauri::async_runtime::spawn_blocking(|| {
        let Some(dir) = folders::detect_telemetry_dir() else {
            return Ok(Vec::new());
        };
        if !dir.is_dir() {
            return Ok(Vec::new());
        }
        let Ok(entries) = fs::read_dir(&dir) else {
            return Ok(Vec::new());
        };
        let mut files: Vec<(std::time::SystemTime, std::path::PathBuf)> = Vec::new();
        for entry in entries.flatten() {
            let p = entry.path();
            if p.extension().and_then(|e| e.to_str()).is_some_and(|e| e.eq_ignore_ascii_case("ibt")) {
                if let Ok(modified) = entry.metadata().and_then(|m| m.modified()) {
                    files.push((modified, p));
                }
            }
        }
        files.sort_by(|a, b| b.0.cmp(&a.0));
        let mut out = Vec::new();
        for (_, p) in files.into_iter().take(60) {
            if let Ok(meta) = ibt_parser::read_ibt_meta(&p) {
                out.push(meta);
            }
        }
        Ok(out)
    })
    .await
    .map_err(|e| format!("Error listando sesiones .ibt: {e}"))?
}

#[tauri::command]
async fn read_ibt_file(path: String) -> Result<Option<ibt_parser::IbtSessionReport>, String> {
    let pb = std::path::PathBuf::from(path);
    if !pb.is_file() {
        return Ok(None);
    }
    tauri::async_runtime::spawn_blocking(move || ibt_parser::parse_ibt_report(&pb).map(Some))
        .await
        .map_err(|e| format!("Error leyendo .ibt: {e}"))?
}

#[tauri::command]
async fn read_latest_ibt() -> Result<Option<ibt_parser::IbtSessionReport>, String> {
    tauri::async_runtime::spawn_blocking(|| {
        let Some(dir) = folders::detect_telemetry_dir() else {
            return Ok(None);
        };
        if !dir.is_dir() {
            return Ok(None);
        }
        let Ok(entries) = fs::read_dir(&dir) else {
            return Ok(None);
        };
        let now = std::time::SystemTime::now();
        let cutoff = std::time::Duration::from_secs(48 * 3600);
        let mut newest: Option<(std::time::SystemTime, std::path::PathBuf)> = None;
        for entry in entries.flatten() {
            let p = entry.path();
            if p.extension().and_then(|e| e.to_str()).is_some_and(|e| e.eq_ignore_ascii_case("ibt")) {
                if let Ok(meta) = entry.metadata() {
                    if let Ok(modified) = meta.modified() {
                        let is_recent = now.duration_since(modified).map_or(false, |d| d <= cutoff);
                        if is_recent && newest.as_ref().is_none_or(|(t, _)| modified > *t) {
                            newest = Some((modified, p));
                        }
                    }
                }
            }
        }
        match newest {
            Some((_, path)) => ibt_parser::parse_ibt_report(&path).map(Some),
            None => Ok(None),
        }
    })
    .await
    .map_err(|e| format!("Error leyendo último .ibt: {e}"))?
}

#[tauri::command]
fn redact_session_info(raw_yaml: String) -> String {
    privacy::redact_session_yaml(&raw_yaml)
}

#[tauri::command]
fn get_race_history() -> history::RaceHistoryResponse {
    history::get_history()
}

#[tauri::command]
fn record_race_session(entry: history::RaceSessionEntry) -> Result<history::RaceHistoryResponse, String> {
    history::record_entry(entry)
}

#[tauri::command]
fn toggle_favorite_session(sub_session_id: i64) -> Result<history::RaceHistoryResponse, String> {
    history::toggle_favorite(sub_session_id)
}

#[tauri::command]
async fn find_reference_hotlap(car: String, track: String, season: String) -> Result<hotlaps::HotlapRefResult, String> {
    hotlaps::find_reference_hotlap(car, track, season).await
}

#[tauri::command]
fn find_latest_replay_clip(dir: String) -> Option<hotlaps::ReplayClipInfo> {
    hotlaps::find_latest_replay_clip(&dir)
}

#[tauri::command]
async fn pick_videos_folder() -> Result<Option<settings::Settings>, String> {
    let picked = tauri::async_runtime::spawn_blocking(|| {
        rfd::FileDialog::new()
            .set_title("Carpeta de clips / repeticiones (ShadowPlay / OBS)")
            .pick_folder()
    })
    .await
    .map_err(|_| "No se pudo abrir el selector.".to_string())?;
    let Some(path) = picked else {
        return Ok(None);
    };
    let mut cfg = settings::load()?;
    cfg.videos_dir = path.to_string_lossy().into_owned();
    settings::save(&cfg)?;
    Ok(Some(cfg))
}

#[tauri::command]
fn quit(app: AppHandle) {
    app.exit(0);
}

fn stage_paths(app: &AppHandle, paths: &[std::path::PathBuf]) -> Result<Option<StagedMeta>, String> {
    let Some(path) = paths.iter().find(|path| {
        path.extension().and_then(|ext| ext.to_str()).is_some_and(|ext| ext.eq_ignore_ascii_case("sto"))
    }) else {
        return Err("Arrastra un archivo .sto de como máximo 1 MB.".into());
    };
    let (name, bytes) = read_sto(path)?;
    let state = app.state::<AppState>();
    stage_bytes(&state, &name, bytes).map(Some)
}

fn read_sto(path: &Path) -> Result<(String, Vec<u8>), String> {
    let name = path
        .file_name()
        .and_then(|value| value.to_str())
        .ok_or_else(|| "El nombre del archivo no es válido.".to_string())?;
    sanitize_filename(name).map_err(|_| "El archivo tiene que ser .sto.".to_string())?;
    let meta = fs::symlink_metadata(path).map_err(|err| err.to_string())?;
    if meta.file_type().is_symlink() || !meta.is_file() {
        return Err("Elige un archivo .sto.".into());
    }
    if meta.len() == 0 || meta.len() > MAX_STO_BYTES {
        return Err("El archivo tiene que pesar como máximo 1 MB.".into());
    }
    let bytes = fs::read(path).map_err(|err| err.to_string())?;
    Ok((name.to_string(), bytes))
}

fn stage_bytes(state: &AppState, filename: &str, bytes: Vec<u8>) -> Result<StagedMeta, String> {
    let size = bytes.len() as u64;
    *state.staged.lock().map_err(|_| "No se pudo preparar el archivo.".to_string())? = Some(StagedFile {
        filename: filename.to_string(),
        bytes,
    });
    Ok(StagedMeta {
        filename: filename.to_string(),
        size,
    })
}

/// Envía `irsdk_BroadcastPitCommand(irsdk_PitCommand_Fuel, liters)` al simulador iRacing.
#[tauri::command]
fn send_iracing_pit_fuel(liters: i32) -> Result<(), String> {
    #[cfg(windows)]
    {
        use std::ffi::OsStr;
        use std::os::windows::ffi::OsStrExt;
        use windows_sys::Win32::UI::WindowsAndMessaging::{
            RegisterWindowMessageW, SendNotifyMessageW, HWND_BROADCAST,
        };
        let wide_name: Vec<u16> = OsStr::new("IRSDK_BROADCAST_MSG")
            .encode_wide()
            .chain(std::iter::once(0))
            .collect();
        let msg_id = unsafe { RegisterWindowMessageW(wide_name.as_ptr()) };
        if msg_id == 0 {
            return Err("No se pudo registrar IRSDK_BROADCAST_MSG".into());
        }
        // MAKEWPARAM(irsdk_BroadcastPitCommand = 2, irsdk_PitCommand_Fuel = 2)
        let wparam: usize = (2usize & 0xFFFF) | ((2usize & 0xFFFF) << 16);
        let lparam: isize = liters.clamp(0, 200) as isize;
        let ok = unsafe { SendNotifyMessageW(HWND_BROADCAST, msg_id, wparam, lparam) };
        if ok == 0 {
            return Err("Error al enviar comando de combustible a iRacing".into());
        }
        Ok(())
    }
    #[cfg(not(windows))]
    {
        let _ = liters;
        Ok(())
    }
}
