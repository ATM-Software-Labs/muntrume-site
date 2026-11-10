use std::fs;
use std::path::{Component, Path, PathBuf};

use serde::{Deserialize, Serialize};

use mmt_sync_core::atomic_write;

use crate::folders;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Settings {
    pub setups_dir: String,
    pub interval_minutes: u32,
    pub auto_sync: bool,
    pub delete_retired: bool,
    pub start_with_windows: bool,
    pub theme: String,
    #[serde(default)]
    pub disabled_cars: Vec<String>,
    #[serde(default)]
    pub favourites: Vec<String>,
    #[serde(default = "default_modules")]
    pub modules: Modules,
    #[serde(default = "default_checklist")]
    pub checklist: Vec<CheckItem>,
}

fn default_modules() -> Modules {
    Modules::default()
}

fn default_checklist() -> Vec<CheckItem> {
    CheckItem::defaults()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Modules {
    pub overlays: bool,
    pub analysis: bool,
    pub reference_laps: bool,
    pub weekly: bool,
    pub strategy: bool,
    pub team: bool,
    pub review_alerts: bool,
}

impl Default for Modules {
    fn default() -> Self {
        Self {
            overlays: true,
            analysis: true,
            reference_laps: false,
            weekly: true,
            strategy: true,
            team: false,
            review_alerts: false,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CheckItem {
    pub label: String,
    pub done: bool,
}

impl CheckItem {
    fn defaults() -> Vec<Self> {
        ["Revisar el setup de MMT instalado", "Anotar combustible y presiones", "Repasar el mapa antes de salir"]
            .into_iter()
            .map(|label| Self {
                label: label.into(),
                done: false,
            })
            .collect()
    }
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            setups_dir: folders::detect_setups_dir()
                .map(|path| path.to_string_lossy().to_string())
                .unwrap_or_default(),
            interval_minutes: 30,
            auto_sync: true,
            delete_retired: false,
            start_with_windows: false,
            theme: "dark".into(),
            disabled_cars: Vec::new(),
            favourites: Vec::new(),
            modules: Modules::default(),
            checklist: CheckItem::defaults(),
        }
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SettingsPatch {
    pub interval_minutes: u32,
    pub auto_sync: bool,
    pub delete_retired: bool,
    pub start_with_windows: bool,
    pub theme: String,
    #[serde(default)]
    pub disabled_cars: Vec<String>,
    #[serde(default)]
    pub favourites: Vec<String>,
    #[serde(default = "default_modules")]
    pub modules: Modules,
    #[serde(default = "default_checklist")]
    pub checklist: Vec<CheckItem>,
}

fn path() -> PathBuf {
    folders::app_data_dir().join("settings.json")
}

pub fn load() -> Result<Settings, String> {
    let path = path();
    if !path.exists() {
        return Ok(Settings::default());
    }
    let bytes = fs::read(&path).map_err(|err| err.to_string())?;
    serde_json::from_slice(&bytes).map_err(|_| "Los ajustes locales están dañados.".to_string())
}

pub fn save(settings: &Settings) -> Result<(), String> {
    let bytes = serde_json::to_vec_pretty(settings).map_err(|err| err.to_string())?;
    atomic_write(&path(), &bytes).map_err(|err| err.to_string())
}

pub fn update(patch: SettingsPatch) -> Result<Settings, String> {
    let mut settings = load()?;
    settings.interval_minutes = patch.interval_minutes.clamp(5, 720);
    settings.auto_sync = patch.auto_sync;
    settings.delete_retired = patch.delete_retired;
    settings.start_with_windows = patch.start_with_windows;
    settings.theme = if patch.theme == "light" {
        "light".into()
    } else {
        "dark".into()
    };
    settings.disabled_cars = patch.disabled_cars;
    settings.favourites = patch.favourites;
    settings.modules = patch.modules;
    settings.checklist = patch.checklist;
    save(&settings)?;
    Ok(settings)
}

pub fn set_setups_dir(dir: &Path, must_exist: bool) -> Result<Settings, String> {
    if !dir.is_absolute() || dir.components().any(|c| matches!(c, Component::ParentDir)) {
        return Err("La carpeta no es válida.".into());
    }
    if must_exist && !dir.is_dir() {
        return Err("Esa carpeta no existe.".into());
    }
    let mut settings = load()?;
    settings.setups_dir = dir.to_string_lossy().into_owned();
    save(&settings)?;
    Ok(settings)
}
