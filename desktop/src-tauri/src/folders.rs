use std::path::PathBuf;

pub fn detect_setups_dir() -> Option<PathBuf> {
    #[cfg(windows)]
    {
        let mut candidates: Vec<PathBuf> = Vec::new();
        if let Ok(profile) = std::env::var("USERPROFILE") {
            let p = PathBuf::from(&profile);
            candidates.push(p.join("Documents").join("iRacing").join("setups"));
            candidates.push(p.join("OneDrive").join("Documents").join("iRacing").join("setups"));
        }
        if let Some(docs) = known_folders::get_known_folder_path(known_folders::KnownFolder::Documents) {
            let c = docs.join("iRacing").join("setups");
            if !candidates.contains(&c) {
                candidates.push(c);
            }
        }
        if let Some(found) = candidates.iter().find(|p| p.exists()) {
            return Some(found.clone());
        }
        candidates.into_iter().next()
    }
    #[cfg(not(windows))]
    {
        None
    }
}

pub fn detect_telemetry_dir() -> Option<PathBuf> {
    #[cfg(windows)]
    {
        let mut candidates: Vec<PathBuf> = Vec::new();
        if let Ok(profile) = std::env::var("USERPROFILE") {
            let p = PathBuf::from(&profile);
            candidates.push(p.join("Documents").join("iRacing").join("telemetry"));
            candidates.push(p.join("OneDrive").join("Documents").join("iRacing").join("telemetry"));
        }
        if let Some(docs) = known_folders::get_known_folder_path(known_folders::KnownFolder::Documents) {
            let c = docs.join("iRacing").join("telemetry");
            if !candidates.contains(&c) {
                candidates.push(c);
            }
        }
        if let Some(setups) = detect_setups_dir() {
            if let Some(root) = setups.parent() {
                let c = root.join("telemetry");
                if !candidates.contains(&c) {
                    candidates.push(c);
                }
            }
        }
        if let Some(found) = candidates.iter().find(|p| p.exists()) {
            return Some(found.clone());
        }
        candidates.into_iter().next()
    }
    #[cfg(not(windows))]
    {
        detect_setups_dir().and_then(|p| p.parent().map(|root| root.join("telemetry")))
    }
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
