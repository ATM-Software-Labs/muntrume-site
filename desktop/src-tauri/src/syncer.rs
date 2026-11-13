use std::fs;
use std::path::Path;
use std::sync::OnceLock;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};

use mmt_sync_core::{
    file_state, hash_bytes, install_allowed, load_index, locate_mmt_file, plan_sync_cars,
    prepare_mmt_destination, save_index, toast_message, Action, IndexFile, LocalSetup, PlaceError,
    SeriesWeek, MAX_STO_BYTES,
};

use crate::api::{ApiError, ManifestFetch};
use crate::state::AppState;
use crate::settings;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncReport {
    pub downloaded: u32,
    pub unchanged: u32,
    pub deleted: u32,
    pub kept_retired: u32,
    pub rejected: u32,
    pub not_modified: bool,
    pub cars: Vec<String>,
    pub errors: Vec<String>,
    pub message: String,
    pub at: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LibraryItem {
    pub id: String,
    pub car: String,
    pub car_folder: String,
    pub track: String,
    pub season: String,
    pub kind: String,
    pub filename: String,
    pub size: u64,
    pub updated_at: String,
    pub state: String,
}

pub fn library_of(index: &IndexFile) -> Vec<LibraryItem> {
    use std::collections::HashMap;
    let local_map: HashMap<&str, &str> = index
        .files
        .iter()
        .map(|file| (file.id.as_str(), file.sha256.as_str()))
        .collect();

    index
        .manifest
        .iter()
        .map(|setup| {
            let local_sha = local_map.get(setup.id.as_str()).copied();
            let state = file_state(&setup.sha256, local_sha);
            LibraryItem {
                id: setup.id.clone(),
                car: setup.car.clone(),
                car_folder: setup.car_folder.clone(),
                track: setup.track.clone(),
                season: setup.season.clone(),
                kind: setup.kind.clone(),
                filename: setup.filename.clone(),
                size: setup.size,
                updated_at: setup.updated_at.clone(),
                state: state.as_str().into(),
            }
        })
        .collect()
}

pub async fn synchronize(app: &AppHandle) -> Result<SyncReport, String> {
    let state = app.state::<AppState>();
    if state
        .syncing
        .compare_exchange(false, true, std::sync::atomic::Ordering::SeqCst, std::sync::atomic::Ordering::SeqCst)
        .is_err()
    {
        return Err("Ya hay una sincronización en curso.".into());
    }
    let result = run(app).await;
    state.syncing.store(false, std::sync::atomic::Ordering::SeqCst);
    result
}

async fn run(app: &AppHandle) -> Result<SyncReport, String> {
    let state = app.state::<AppState>();
    let settings = settings::load()?;
    let root = std::path::PathBuf::from(&settings.setups_dir);
    if !root.is_dir() {
        return Err("Elige la carpeta de setups de iRacing.".into());
    }
    let token = state.token()?;
    let index_path = crate::folders::app_data_dir().join("index.json");
    let mut index = load_index(&index_path).map_err(|err| err.to_string())?;
    rehash_local(&root, &mut index);

    let fetched = state.api.manifest(&token, index.etag.as_deref()).await.map_err(explain)?;
    let not_modified = matches!(fetched, ManifestFetch::NotModified);
    if let ManifestFetch::Fresh { manifest, etag } = fetched {
        index.generated_at = manifest.generated_at;
        index.manifest = manifest.setups;
        index.etag = etag;
    }

    let plan = plan_sync_cars(
        &index.manifest,
        &index.files,
        settings.delete_retired,
        &settings.disabled_cars,
    );
    let mut downloaded_cars = Vec::new();
    let mut downloaded = 0u32;
    let mut errors = Vec::new();
    let mut unchanged = 0u32;
    let mut deleted = 0u32;
    let mut kept_retired = 0u32;

    for action in &plan.actions {
        match action {
            Action::Unchanged { .. } => unchanged += 1,
            Action::KeepRetired { .. } => kept_retired += 1,
            Action::Skipped { .. } => kept_retired += 1,
            Action::Download(item) => {
                let track = index
                    .manifest
                    .iter()
                    .find(|setup| setup.id == item.id)
                    .map(|setup| setup.track.clone())
                    .unwrap_or_default();
                let filename = item.relative.rsplit('/').next().unwrap_or(item.relative.as_str());
                if item.relative.to_ascii_lowercase().contains("fixed") {
                    continue;
                }
                let car_pairs = season_pairs_for_car(&item.car);
                let weeks: Vec<SeriesWeek<'_>> = car_pairs
                    .iter()
                    .map(|(name, track_name)| SeriesWeek { name, track: track_name })
                    .collect();
                if let Err(reason) = install_allowed(&track, filename, &weeks, None) {
                    if reason == "serie fixed" {
                        continue;
                    }
                    errors.push(format!("{}: {reason}", item.relative));
                    continue;
                }
                match fetch_one(&state, &token, &root, item).await {
                    Ok(local) => {
                        index.files.retain(|file| file.id != local.id && file.relative_path != local.relative_path);
                        downloaded_cars.push(item.car.clone());
                        index.files.push(local);
                        downloaded += 1;
                    }
                    Err(err) => errors.push(format!("{}: {err}", item.relative)),
                }
            }
            Action::Delete(item) => match remove_one(&root, &item.relative) {
                Ok(()) => {
                    index.files.retain(|file| file.id != item.id);
                    deleted += 1;
                }
                Err(err) => errors.push(format!("{}: {err}", item.relative)),
            },
        }
    }
    for rejected in &plan.rejected {
        errors.push(format!("{}: {}", rejected.id, rejected.reason));
    }

    let at = chrono::Utc::now().to_rfc3339();
    index.last_sync_rfc3339 = Some(at.clone());
    index.last_downloaded = downloaded;
    index.last_cars = unique_cars(&downloaded_cars);
    save_index(&index_path, &index).map_err(|err| err.to_string())?;
    cleanup_legacy_empty_dirs(&root);

    let message = if let Some(first) = errors.first() {
        format!("Sincronización incompleta. {first}")
    } else if downloaded == 0 && deleted == 0 {
        if kept_retired > 0 {
            format!("Todo al día. {kept_retired} setups retirados siguen en el disco.")
        } else {
            "Todo al día.".into()
        }
    } else {
        toast_message(downloaded as usize, &downloaded_cars).unwrap_or_else(|| "Sincronización hecha.".into())
    };

    if downloaded > 0 {
        if let Some(body) = toast_message(downloaded as usize, &downloaded_cars) {
            use tauri_plugin_notification::NotificationExt;
            let _ = app.notification().builder().title("MMT Sync").body(body).show();
        }
    }

    Ok(SyncReport {
        downloaded,
        unchanged,
        deleted,
        kept_retired,
        rejected: plan.rejected.len() as u32,
        not_modified,
        cars: unique_cars(&downloaded_cars),
        errors,
        message,
        at,
    })
}

async fn fetch_one(
    state: &AppState,
    token: &str,
    root: &Path,
    item: &mmt_sync_core::Download,
) -> Result<LocalSetup, String> {
    let dest = prepare_mmt_destination(root, &item.relative).map_err(|err| err.to_string())?;

    let mut local_bytes: Option<Vec<u8>> = None;
    if let Ok(b) = fs::read(&dest) {
        if b.len() as u64 == item.size && hash_bytes(&b) == item.sha256 {
            local_bytes = Some(b);
        }
    }
    if local_bytes.is_none() {
        let parts: Vec<&str> = item.relative.split('/').collect();
        if let (Some(&car), Some(&file)) = (parts.first(), parts.last()) {
            let legacy_path = root.join(car).join("MMT").join("26S4").join(file);
            if let Ok(b) = fs::read(&legacy_path) {
                if b.len() as u64 == item.size && hash_bytes(&b) == item.sha256 {
                    mmt_sync_core::atomic_write(&dest, &b).map_err(|err| err.to_string())?;
                    let _ = fs::remove_file(&legacy_path);
                    local_bytes = Some(b);
                }
            }
            if local_bytes.is_none() {
                let legacy_path2 = root.join(car).join("MMT").join(file);
                if let Ok(b) = fs::read(&legacy_path2) {
                    if b.len() as u64 == item.size && hash_bytes(&b) == item.sha256 {
                        mmt_sync_core::atomic_write(&dest, &b).map_err(|err| err.to_string())?;
                        let _ = fs::remove_file(&legacy_path2);
                        local_bytes = Some(b);
                    }
                }
            }
        }
    }

    let _bytes = match local_bytes {
        Some(b) => b,
        None => {
            let bytes = state.api.download(token, &item.id).await.map_err(explain)?;
            if bytes.len() as u64 != item.size {
                return Err("el tamaño no coincide con el manifiesto".into());
            }
            if hash_bytes(&bytes) != item.sha256 {
                return Err("el sha256 no coincide con el manifiesto".into());
            }
            if bytes.len() as u64 > MAX_STO_BYTES {
                return Err("el archivo supera 1 MB".into());
            }
            mmt_sync_core::atomic_write(&dest, &bytes).map_err(|err| err.to_string())?;
            bytes
        }
    };

    Ok(LocalSetup {
        id: item.id.clone(),
        relative_path: item.relative.clone(),
        sha256: item.sha256.clone(),
        size: item.size,
    })
}

fn remove_one(root: &Path, relative: &str) -> Result<(), String> {
    let dest = match locate_mmt_file(root, relative) {
        Ok(path) => path,
        Err(PlaceError::MissingRoot) => return Ok(()),
        Err(err) => return Err(err.to_string()),
    };
    let meta = match fs::symlink_metadata(&dest) {
        Ok(meta) => meta,
        Err(err) if err.kind() == std::io::ErrorKind::NotFound => return Ok(()),
        Err(err) => return Err(err.to_string()),
    };
    if meta.file_type().is_symlink() || meta.is_file() {
        fs::remove_file(&dest).map_err(|err| err.to_string())?;
        if let Some(parent) = dest.parent() {
            let _ = fs::remove_dir(parent);
            if let Some(grandparent) = parent.parent() {
                let _ = fs::remove_dir(grandparent);
            }
        }
        return Ok(());
    }
    Err("no borro nada que no sea un archivo dentro de MMT".into())
}

fn cleanup_legacy_empty_dirs(root: &Path) {
    if let Ok(entries) = fs::read_dir(root) {
        for entry in entries.flatten() {
            let mmt_old = entry.path().join("MMT");
            if mmt_old.is_dir() {
                let s4 = mmt_old.join("26S4");
                let _ = fs::remove_dir(&s4);
                let _ = fs::remove_dir(&mmt_old);
            }
        }
    }
}

fn rehash_local(root: &Path, index: &mut IndexFile) {
    for file in &mut index.files {
        let Ok(path) = locate_mmt_file(root, &file.relative_path) else {
            file.sha256.clear();
            continue;
        };
        let Ok(meta) = fs::symlink_metadata(&path) else {
            file.sha256.clear();
            continue;
        };
        if meta.file_type().is_symlink() || !meta.is_file() || meta.len() > MAX_STO_BYTES {
            file.sha256.clear();
            continue;
        }
        match fs::read(&path) {
            Ok(bytes) => {
                file.size = bytes.len() as u64;
                file.sha256 = hash_bytes(&bytes);
            }
            Err(_) => file.sha256.clear(),
        }
    }
}

fn unique_cars(cars: &[String]) -> Vec<String> {
    let mut out = Vec::new();
    for car in cars {
        let name = car.trim();
        if !name.is_empty() && !out.iter().any(|seen: &String| seen == name) {
            out.push(name.to_string());
        }
    }
    out
}

fn explain(err: ApiError) -> String {
    err.to_string()
}

#[derive(Deserialize)]
struct SeasonFile {
    #[serde(default)]
    series: Vec<SeasonSeries>,
}

#[derive(Deserialize)]
struct SeasonSeries {
    #[serde(default)]
    name: String,
    #[serde(default)]
    cars: Vec<String>,
    #[serde(default)]
    weeks: Vec<SeasonWeek>,
}

#[derive(Deserialize)]
struct SeasonWeek {
    #[serde(default)]
    track_name: String,
}

struct SeasonEntry {
    name: String,
    cars_norm: String,
    track: String,
}

fn norm_token(value: &str) -> String {
    value
        .bytes()
        .filter(u8::is_ascii_alphanumeric)
        .map(|b| b.to_ascii_lowercase() as char)
        .collect()
}

fn season_entries() -> &'static Vec<SeasonEntry> {
    static CACHE: OnceLock<Vec<SeasonEntry>> = OnceLock::new();
    CACHE.get_or_init(|| {
        let raw = include_str!("../../src/season_schedule_2026_s4.json");
        let doc: SeasonFile = serde_json::from_str(raw).unwrap_or(SeasonFile { series: Vec::new() });
        let mut entries = Vec::new();
        for series in doc.series {
            let cars_norm = norm_token(&series.cars.join(" "));
            for week in series.weeks {
                if !week.track_name.is_empty() {
                    entries.push(SeasonEntry {
                        name: series.name.clone(),
                        cars_norm: cars_norm.clone(),
                        track: week.track_name,
                    });
                }
            }
        }
        entries
    })
}

fn season_pairs_for_car(car_folder: &str) -> Vec<(&'static str, &'static str)> {
    let entries = season_entries();
    let car_norm = norm_token(car_folder);
    if !car_norm.is_empty() {
        let matched: Vec<(&'static str, &'static str)> = entries
            .iter()
            .filter(|e| e.cars_norm.contains(&car_norm))
            .map(|e| (e.name.as_str(), e.track.as_str()))
            .collect();
        if !matched.is_empty() {
            return matched;
        }
    }
    entries
        .iter()
        .map(|e| (e.name.as_str(), e.track.as_str()))
        .collect()
}
