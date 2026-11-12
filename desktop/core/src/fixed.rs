//! Bloqueo de series Fixed. Solo fuentes reales: un flag del YAML de sesión,
//! el nombre del archivo, o el calendario de temporada. Si no hay fuente, se bloquea.

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SeriesLock {
    Open,
    Fixed,
    Unknown,
}

pub struct SeriesWeek<'a> {
    pub name: &'a str,
    pub track: &'a str,
}

pub fn install_allowed(
    track: &str,
    filename: &str,
    weeks: &[SeriesWeek<'_>],
    yaml_fixed: Option<bool>,
) -> Result<(), &'static str> {
    if let Some(fixed) = yaml_fixed {
        return if fixed { Err("serie fixed") } else { Ok(()) };
    }
    if filename.to_ascii_uppercase().contains("FIXED") {
        return Err("serie fixed");
    }
    match lock_for_track(track, weeks) {
        SeriesLock::Open => Ok(()),
        SeriesLock::Fixed => Err("serie fixed"),
        SeriesLock::Unknown => Err("no se puede determinar"),
    }
}

pub fn lock_for_track(track: &str, weeks: &[SeriesWeek<'_>]) -> SeriesLock {
    let clean = norm(track);
    if clean.len() < 5 {
        return SeriesLock::Unknown;
    }
    let mut open = 0usize;
    let mut fixed = 0usize;
    for week in weeks {
        let name = norm(week.track);
        if name.len() < 5 {
            continue;
        }
        if !(name.contains(&clean) || clean.contains(&name)) {
            continue;
        }
        if week.name.to_ascii_lowercase().contains("fixed") {
            fixed += 1;
        } else {
            open += 1;
        }
    }
    match (open, fixed) {
        (0, 0) => SeriesLock::Unknown,
        (0, _) => SeriesLock::Fixed,
        (_, 0) => SeriesLock::Open,
        _ => SeriesLock::Unknown,
    }
}

/// Lee un indicador explícito si el YAML lo trae. Si la clave no está, `None`.
pub fn yaml_fixed_flag(session_info: &str) -> Option<bool> {
    for line in session_info.lines() {
        let lower = line.trim().to_ascii_lowercase();
        let rest = if let Some(rest) = lower.strip_prefix("isfixedsetup:") {
            rest
        } else if let Some(rest) = lower.strip_prefix("fixedsetup:") {
            rest
        } else {
            continue;
        };
        let value = rest.trim();
        return Some(value == "1" || value == "true");
    }
    None
}

fn norm(value: &str) -> String {
    value
        .chars()
        .filter(|c| c.is_ascii_alphanumeric())
        .flat_map(|c| c.to_lowercase())
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn weeks() -> Vec<SeriesWeek<'static>> {
        vec![
            SeriesWeek { name: "GT3 Open", track: "Spa-Francorchamps" },
            SeriesWeek { name: "Ferrari Challenge Fixed", track: "Barcelona" },
            SeriesWeek { name: "IMSA Open", track: "Fuji Speedway" },
            SeriesWeek { name: "IMSA Fixed", track: "Fuji Speedway" },
        ]
    }

    #[test]
    fn open_track_can_be_installed() {
        assert_eq!(install_allowed("Spa-Francorchamps", "race.sto", &weeks(), None), Ok(()));
    }

    #[test]
    fn fixed_series_and_fixed_filename_are_blocked() {
        assert_eq!(
            install_allowed("Barcelona", "race.sto", &weeks(), None),
            Err("serie fixed")
        );
        assert_eq!(
            install_allowed("Spa-Francorchamps", "RACE_FIXED.sto", &weeks(), None),
            Err("serie fixed")
        );
    }

    #[test]
    fn mixed_or_unknown_tracks_are_blocked() {
        assert_eq!(
            install_allowed("Fuji Speedway", "race.sto", &weeks(), None),
            Err("no se puede determinar")
        );
        assert_eq!(
            install_allowed("Circuito inventado", "race.sto", &weeks(), None),
            Err("no se puede determinar")
        );
    }

    #[test]
    fn yaml_flag_is_used_only_when_the_key_exists() {
        assert_eq!(yaml_fixed_flag("WeekendInfo:\n  TrackName: Spa\n"), None);
        assert_eq!(yaml_fixed_flag("IsFixedSetup: 1\n"), Some(true));
        assert_eq!(yaml_fixed_flag("FixedSetup: false\n"), Some(false));
        assert_eq!(
            install_allowed("Barcelona", "race.sto", &weeks(), Some(false)),
            Ok(())
        );
        assert_eq!(
            install_allowed("Spa-Francorchamps", "race.sto", &weeks(), Some(true)),
            Err("serie fixed")
        );
    }
}
