use std::path::PathBuf;

pub fn detect_setups_dir() -> Option<PathBuf> {
    #[cfg(windows)]
    {
        if let Some(docs) = known_folders::get_known_folder_path(known_folders::KnownFolder::Documents)
        {
            return Some(docs.join("iRacing").join("setups"));
        }
        if let Ok(profile) = std::env::var("USERPROFILE") {
            return Some(PathBuf::from(profile).join("Documents").join("iRacing").join("setups"));
        }
        None
    }
    #[cfg(not(windows))]
    {
        None
    }
}

pub fn detect_telemetry_dir() -> Option<PathBuf> {
    detect_setups_dir().and_then(|p| p.parent().map(|root| root.join("telemetry")))
}

pub fn app_data_dir() -> PathBuf {
    #[cfg(windows)]
    {
        if let Some(roaming) =
            known_folders::get_known_folder_path(known_folders::KnownFolder::RoamingAppData)
        {
            return roaming.join("MMT Sync");
        }
        if let Ok(appdata) = std::env::var("APPDATA") {
            return PathBuf::from(appdata).join("MMT Sync");
        }
    }
    if let Ok(appdata) = std::env::var("APPDATA") {
        return PathBuf::from(appdata).join("MMT Sync");
    }
    if let Ok(xdg) = std::env::var("XDG_CONFIG_HOME") {
        return PathBuf::from(xdg).join("MMT Sync");
    }
    if let Ok(home) = std::env::var("HOME") {
        return PathBuf::from(home).join(".config").join("MMT Sync");
    }
    PathBuf::from("MMT Sync")
}
