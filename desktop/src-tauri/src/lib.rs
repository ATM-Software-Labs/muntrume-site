mod api;
mod credentials;
mod folders;
mod live;
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
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            show_main(app);
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
            if std::env::args().any(|arg| arg == "--minimized") {
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
            Ok(())
        })
        .on_window_event(|window, event| match event {
            WindowEvent::CloseRequested { api, .. } => {
                api.prevent_close();
                let _ = window.hide();
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
            pick_sto,
            clear_staged,
            upload_staged,
            install_update,
            quit
        ])
        .run(tauri::generate_context!())
        .expect("MMT Sync no pudo abrir la ventana");
}

fn install_tray(app: &AppHandle) -> tauri::Result<()> {
    let menu = Menu::with_items(
        app,
        &[
            &MenuItem::with_id(app, "sync", "Sincronizar ahora", true, None::<&str>)?,
            &MenuItem::with_id(app, "open", "Abrir", true, None::<&str>)?,
            &MenuItem::with_id(app, "quit", "Salir", true, None::<&str>)?,
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
                    let _ = syncer::synchronize(&app).await;
                    let _ = app.emit("mmt-refresh", ());
                });
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
                    let _ = syncer::synchronize(&handle).await;
                    let _ = handle.emit("mmt-refresh", ());
                });
            }
        })
        .ok();
}

fn spawn_update_check(app: AppHandle) {
    tauri::async_runtime::spawn(async move {
        tokio::time::sleep(Duration::from_secs(4)).await;
        use tauri_plugin_updater::UpdaterExt;
        let Ok(updater) = app.updater() else {
            return;
        };
        let Ok(Some(update)) = updater.check().await else {
            return;
        };
        let version = update.version.clone();
        if let Ok(mut slot) = app.state::<AppState>().update_version.lock() {
            *slot = Some(version.clone());
        }
        let _ = app.emit("mmt-update", version);
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
    update
        .download_and_install(|_chunk, _total| {}, || {})
        .await
        .map_err(|err| err.to_string())?;
    app.restart();
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
