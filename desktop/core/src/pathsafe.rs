//! Segmentos de ruta que pueden acabar en disco.
//! Toda escritura y todo borrado pasan por aquí antes de unirse a la carpeta de setups.

use std::path::{Component, Path, PathBuf};

use thiserror::Error;

const RESERVED: &[&str] = &[
    "CON", "PRN", "AUX", "NUL", "COM0", "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7",
    "COM8", "COM9", "LPT0", "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9",
];

#[derive(Debug, Error, PartialEq, Eq)]
pub enum PathError {
    #[error("la ruta está vacía")]
    Empty,
    #[error("la ruta sale de la carpeta de setups")]
    Escape,
    #[error("el nombre no es válido en Windows")]
    Name,
    #[error("el archivo tiene que ser .sto")]
    Extension,
}

/// Carpeta `car_folder/indicator/.../filename` ya comprobada.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct MmtPath {
    pub car_folder: String,
    pub indicator: String,
    pub intermediates: Vec<String>,
    pub filename: String,
}

impl MmtPath {
    pub fn try_new(car_folder: &str, season: &str, filename: &str) -> Result<Self, PathError> {
        Ok(Self {
            car_folder: sanitize_segment(car_folder)?,
            indicator: "MMT".to_string(),
            intermediates: vec![sanitize_segment(season)?],
            filename: sanitize_filename(filename)?,
        })
    }

    pub fn new_hierarchical(
        car_folder: &str,
        indicator: &str,
        intermediates: &[&str],
        filename: &str,
    ) -> Result<Self, PathError> {
        let mut clean_intermediates = Vec::new();
        for item in intermediates {
            clean_intermediates.push(sanitize_segment(item)?);
        }
        Ok(Self {
            car_folder: sanitize_segment(car_folder)?,
            indicator: sanitize_segment(indicator)?,
            intermediates: clean_intermediates,
            filename: sanitize_filename(filename)?,
        })
    }

    /// `ferrari296gt3/MMT/26S4/spa_race.sto` o con jerarquía `ferrari296gt3/MMT by Muntrume/26S4/WEEK 01/Indianapolis/setup.sto`
    pub fn relative(&self) -> String {
        if self.intermediates.is_empty() {
            format!("{}/{}/{}", self.car_folder, self.indicator, self.filename)
        } else {
            format!(
                "{}/{}/{}/{}",
                self.car_folder,
                self.indicator,
                self.intermediates.join("/"),
                self.filename
            )
        }
    }

    /// Acepta rutas estándar de MMT Sync (mínimo 4 partes, indicador "MMT" o "MMT by Muntrume").
    pub fn from_relative(relative: &str) -> Result<Self, PathError> {
        if relative.contains('\\') || relative.contains('\0') {
            return Err(PathError::Escape);
        }
        let parts: Vec<&str> = relative.split('/').collect();
        if parts.len() < 4 {
            return Err(PathError::Escape);
        }
        let indicator = parts[1];
        if indicator != "MMT" && indicator != "MMT by Muntrume" {
            return Err(PathError::Escape);
        }
        let car_folder = sanitize_segment(parts[0])?;
        let filename = sanitize_filename(parts[parts.len() - 1])?;
        let mut intermediates = Vec::new();
        for &inter in &parts[2..parts.len() - 1] {
            intermediates.push(sanitize_segment(inter)?);
        }
        Ok(Self {
            car_folder,
            indicator: indicator.to_string(),
            intermediates,
            filename,
        })
    }

    pub fn dir_segments(&self) -> Vec<&str> {
        let mut list = vec![self.car_folder.as_str(), self.indicator.as_str()];
        for inter in &self.intermediates {
            list.push(inter.as_str());
        }
        list
    }

    /// Une la ruta a `root` y rechaza cualquier `..` o destino que no quede dentro.
    pub fn under(&self, root: &Path) -> Result<PathBuf, PathError> {
        if root.as_os_str().is_empty() || !root.is_absolute() {
            return Err(PathError::Escape);
        }
        let mut dest = root.join(&self.car_folder).join(&self.indicator);
        for inter in &self.intermediates {
            dest = dest.join(inter);
        }
        dest = dest.join(&self.filename);
        if !stays_inside(root, &dest) {
            return Err(PathError::Escape);
        }
        Ok(dest)
    }
}

pub fn sanitize_segment(raw: &str) -> Result<String, PathError> {
    validate_name(raw, false)?;
    Ok(raw.to_string())
}

pub fn sanitize_filename(raw: &str) -> Result<String, PathError> {
    validate_name(raw, true)?;
    if !raw.to_ascii_lowercase().ends_with(".sto") {
        return Err(PathError::Extension);
    }
    let stem = &raw[..raw.len() - 4];
    if stem.is_empty() || stem.ends_with('.') || stem.ends_with(' ') {
        return Err(PathError::Name);
    }
    Ok(raw.to_string())
}

fn validate_name(raw: &str, is_file: bool) -> Result<(), PathError> {
    if raw.is_empty() {
        return Err(PathError::Empty);
    }
    if raw == "." || raw == ".." {
        return Err(PathError::Escape);
    }
    if raw != raw.trim() || raw.ends_with('.') || raw.ends_with(' ') {
        return Err(PathError::Name);
    }
    let max = if is_file { 120 } else { 80 };
    if raw.chars().count() > max {
        return Err(PathError::Name);
    }
    if raw.contains('/') || raw.contains('\\') || raw.contains(':') {
        return Err(PathError::Escape);
    }
    if raw == "." || raw == ".." || raw.split(['/', '\\']).any(|part| part == "." || part == "..") {
        return Err(PathError::Escape);
    }
    if raw.chars().any(invalid_char) {
        return Err(PathError::Name);
    }
    let stem = raw.split('.').next().unwrap_or(raw);
    if stem.is_empty() {
        return Err(PathError::Name);
    }
    let upper = stem.to_ascii_uppercase();
    if RESERVED.iter().any(|name| *name == upper) {
        return Err(PathError::Name);
    }
    Ok(())
}

fn invalid_char(c: char) -> bool {
    if c.is_control() || c == '\u{007f}' {
        return true;
    }
    matches!(
        c,
        '<' | '>' | '"' | '|' | '?' | '*' | '\u{202a}' | '\u{202b}' | '\u{202c}' | '\u{202d}'
            | '\u{202e}'
    )
}

fn stays_inside(root: &Path, dest: &Path) -> bool {
    let Some(root) = normalize(root) else {
        return false;
    };
    let Some(dest) = normalize(dest) else {
        return false;
    };
    let Ok(rel) = dest.strip_prefix(&root) else {
        return false;
    };
    let parts: Vec<Component> = rel.components().collect();
    parts.len() == 4 && matches!(parts[1], Component::Normal(name) if name == "MMT")
}

fn normalize(path: &Path) -> Option<PathBuf> {
    let mut out = PathBuf::new();
    for component in path.components() {
        match component {
            Component::ParentDir | Component::CurDir => return None,
            Component::RootDir | Component::Prefix(_) => out.push(component.as_os_str()),
            Component::Normal(name) => {
                if name == "." || name == ".." || name.is_empty() {
                    return None;
                }
                out.push(name);
            }
        }
    }
    Some(out)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn root() -> PathBuf {
        std::env::temp_dir().join("mmt-sync-path-root")
    }

    #[test]
    fn accepts_a_normal_setup_path() {
        let path = MmtPath::try_new("ferrari296gt3", "26S4", "spa_race.sto").unwrap();
        let dest = path.under(&root()).unwrap();
        assert!(dest.starts_with(root()));
        assert_eq!(path.relative(), "ferrari296gt3/MMT/26S4/spa_race.sto");
        assert!(dest.ends_with(Path::new("ferrari296gt3").join("MMT").join("26S4").join("spa_race.sto")));
    }

    #[test]
    fn rejects_parent_segments_and_slashes() {
        assert_eq!(MmtPath::try_new("..", "26S4", "a.sto").unwrap_err(), PathError::Escape);
        assert_eq!(
            MmtPath::try_new("ferrari296gt3", "..", "a.sto").unwrap_err(),
            PathError::Escape
        );
        assert_eq!(
            MmtPath::try_new("foo/../../etc", "26S4", "a.sto").unwrap_err(),
            PathError::Escape
        );
        assert_eq!(
            MmtPath::try_new(r"foo\..\windows", "26S4", "a.sto").unwrap_err(),
            PathError::Escape
        );
        assert!(MmtPath::try_new("/etc", "26S4", "a.sto").is_err());
        assert!(MmtPath::try_new(r"C:\Users", "26S4", "a.sto").is_err());
        assert!(MmtPath::try_new(r"\\server\share", "26S4", "a.sto").is_err());
    }

    #[test]
    fn rejects_reserved_windows_names_and_bad_characters() {
        assert_eq!(sanitize_filename("CON.sto").unwrap_err(), PathError::Name);
        assert_eq!(sanitize_filename("aux.sto").unwrap_err(), PathError::Name);
        assert_eq!(sanitize_segment("NUL").unwrap_err(), PathError::Name);
        assert_eq!(sanitize_segment("COM1").unwrap_err(), PathError::Name);
        assert_eq!(sanitize_segment("lpt9").unwrap_err(), PathError::Name);
        assert_eq!(sanitize_filename("spa<.sto").unwrap_err(), PathError::Name);
        assert_eq!(sanitize_filename("spa|.sto").unwrap_err(), PathError::Name);
        assert_eq!(sanitize_filename("spa?.sto").unwrap_err(), PathError::Name);
        assert_eq!(sanitize_filename("spa*.sto").unwrap_err(), PathError::Name);
        assert_eq!(sanitize_filename("spa\".sto").unwrap_err(), PathError::Name);
        assert_eq!(sanitize_filename("spa\u{0001}.sto").unwrap_err(), PathError::Name);
        assert_eq!(sanitize_filename("spa\u{202e}.sto").unwrap_err(), PathError::Name);
        assert_eq!(sanitize_segment("spa ").unwrap_err(), PathError::Name);
        assert_eq!(sanitize_segment(" spa").unwrap_err(), PathError::Name);
        assert_eq!(sanitize_filename("spa.sto.").unwrap_err(), PathError::Name);
        assert_eq!(sanitize_filename("spa.sto ").unwrap_err(), PathError::Name);
    }

    #[test]
    fn rejects_non_sto_and_dot_names() {
        assert_eq!(sanitize_filename("spa_race.txt").unwrap_err(), PathError::Extension);
        assert_eq!(sanitize_filename("spa_race.sto.exe").unwrap_err(), PathError::Extension);
        assert_eq!(sanitize_filename(".sto").unwrap_err(), PathError::Name);
        assert_eq!(sanitize_filename("..sto").unwrap_err(), PathError::Name);
        assert!(sanitize_filename("SPA_Race.STO").is_ok());
        assert!(sanitize_filename("foo.bar.sto").is_ok());
    }

    #[test]
    fn relative_parser_rejects_escape_and_missing_mmt() {
        assert!(MmtPath::from_relative("ferrari296gt3/MMT/26S4/spa.sto").is_ok());
        assert_eq!(
            MmtPath::from_relative("../MMT/26S4/spa.sto").unwrap_err(),
            PathError::Escape
        );
        assert_eq!(
            MmtPath::from_relative("ferrari296gt3/OTHER/26S4/spa.sto").unwrap_err(),
            PathError::Escape
        );
        assert_eq!(
            MmtPath::from_relative("ferrari296gt3/MMT/../../spa.sto").unwrap_err(),
            PathError::Escape
        );
        assert_eq!(
            MmtPath::from_relative(r"ferrari296gt3\MMT\26S4\spa.sto").unwrap_err(),
            PathError::Escape
        );
        assert!(MmtPath::from_relative("ferrari296gt3/mmt/26S4/spa.sto").is_err());
        assert!(MmtPath::from_relative("only/three/parts").is_err());
    }

    #[test]
    fn under_refuses_a_relative_root() {
        let path = MmtPath::try_new("ferrari296gt3", "26S4", "a.sto").unwrap();
        assert_eq!(path.under(Path::new("setups")).unwrap_err(), PathError::Escape);
        assert_eq!(path.under(Path::new("")).unwrap_err(), PathError::Escape);
    }

    #[test]
    fn spaces_inside_a_segment_are_allowed() {
        let path = MmtPath::try_new("bmw m4 gt3", "26 S4", "spa race.sto").unwrap();
        assert!(path.under(&root()).is_ok());
    }
}
