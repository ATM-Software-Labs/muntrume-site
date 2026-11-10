//! Comprobaciones de un .sto que el piloto envía a revisión.

use crate::manifest::MAX_STO_BYTES;
use crate::pathsafe::{sanitize_filename, sanitize_segment, PathError};

use thiserror::Error;

#[derive(Debug, Error, PartialEq, Eq)]
pub enum UploadError {
    #[error("el archivo tiene que ser .sto")]
    Extension,
    #[error("el archivo tiene que pesar entre 1 byte y 1 MB")]
    Size,
    #[error("la carpeta del coche no es válida")]
    Car,
    #[error("el circuito no es válido")]
    Track,
    #[error("el tipo tiene que ser carrera, clasificación o lluvia")]
    Kind,
    #[error("las notas pueden tener como máximo 280 caracteres")]
    Notes,
}

pub fn normalize_kind(raw: &str) -> Option<&'static str> {
    match raw.trim().to_ascii_lowercase().as_str() {
        "race" | "carrera" => Some("Race"),
        "qualy" | "quali" | "clasificacion" | "clasificación" => Some("Qualy"),
        "wet" | "lluvia" => Some("Wet"),
        _ => None,
    }
}

pub fn validate_upload(
    filename: &str,
    size: u64,
    car_folder: &str,
    track: &str,
    kind: &str,
    notes: &str,
) -> Result<&'static str, UploadError> {
    let base = filename.rsplit(['/', '\\']).next().unwrap_or(filename);
    if filename != base || filename.contains(':') {
        return Err(UploadError::Extension);
    }
    sanitize_filename(base).map_err(|err| match err {
        PathError::Extension => UploadError::Extension,
        _ => UploadError::Extension,
    })?;
    if size == 0 || size > MAX_STO_BYTES {
        return Err(UploadError::Size);
    }
    sanitize_segment(car_folder).map_err(|_| UploadError::Car)?;
    validate_track(track)?;
    let kind = normalize_kind(kind).ok_or(UploadError::Kind)?;
    if notes.chars().count() > 280 {
        return Err(UploadError::Notes);
    }
    if notes.chars().any(|c| c.is_control() && c != '\n' && c != '\t') {
        return Err(UploadError::Notes);
    }
    Ok(kind)
}

fn validate_track(track: &str) -> Result<(), UploadError> {
    if track != track.trim() || track.is_empty() || track.chars().count() > 80 {
        return Err(UploadError::Track);
    }
    if track.contains('/') || track.contains('\\') || track.contains("..") {
        return Err(UploadError::Track);
    }
    if track.chars().any(|c| c.is_control()) {
        return Err(UploadError::Track);
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::manifest::MAX_STO_BYTES;

    #[test]
    fn accepts_a_normal_upload() {
        assert_eq!(
            validate_upload("spa_race.sto", 100, "ferrari296gt3", "Spa-Francorchamps", "carrera", "Rake bajo.").unwrap(),
            "Race"
        );
        assert_eq!(normalize_kind("Qualy"), Some("Qualy"));
        assert_eq!(normalize_kind("lluvia"), Some("Wet"));
    }

    #[test]
    fn rejects_the_limits() {
        assert_eq!(
            validate_upload("notes.txt", 10, "ferrari296gt3", "Spa", "Race", "").unwrap_err(),
            UploadError::Extension
        );
        assert_eq!(
            validate_upload(r"C:\secret.sto", 10, "ferrari296gt3", "Spa", "Race", "").unwrap_err(),
            UploadError::Extension
        );
        assert_eq!(
            validate_upload("a.sto", 0, "ferrari296gt3", "Spa", "Race", "").unwrap_err(),
            UploadError::Size
        );
        assert_eq!(
            validate_upload("a.sto", MAX_STO_BYTES + 1, "ferrari296gt3", "Spa", "Race", "").unwrap_err(),
            UploadError::Size
        );
        assert_eq!(
            validate_upload("a.sto", 10, "..", "Spa", "Race", "").unwrap_err(),
            UploadError::Car
        );
        assert_eq!(
            validate_upload("a.sto", 10, "ferrari296gt3", "../Spa", "Race", "").unwrap_err(),
            UploadError::Track
        );
        assert_eq!(
            validate_upload("a.sto", 10, "ferrari296gt3", "Spa", "endurance", "").unwrap_err(),
            UploadError::Kind
        );
        let long = "ñ".repeat(281);
        assert_eq!(
            validate_upload("a.sto", 10, "ferrari296gt3", "Spa", "Wet", &long).unwrap_err(),
            UploadError::Notes
        );
    }
}
