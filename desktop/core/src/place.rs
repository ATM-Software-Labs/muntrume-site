//! Crea o localiza `car/MMT/season/archivo.sto` sin seguir enlaces que salgan de la carpeta.

use std::fs;
use std::io;
use std::path::{Path, PathBuf};

use thiserror::Error;

use crate::pathsafe::{MmtPath, PathError};

#[derive(Debug, Error)]
pub enum PlaceError {
    #[error(transparent)]
    Path(#[from] PathError),
    #[error("la carpeta de setups no existe")]
    MissingRoot,
    #[error("hay un enlace que sale de la carpeta de setups")]
    Link,
    #[error("no se pudo preparar la carpeta")]
    Io(#[from] io::Error),
}

pub fn prepare_mmt_destination(root: &Path, relative: &str) -> Result<PathBuf, PlaceError> {
    let file = walk(root, relative, true)?;
    if file.exists() {
        let meta = fs::symlink_metadata(&file)?;
        if meta.file_type().is_symlink() {
            fs::remove_file(&file)?;
        }
    }
    Ok(file)
}

pub fn locate_mmt_file(root: &Path, relative: &str) -> Result<PathBuf, PlaceError> {
    walk(root, relative, false)
}

fn walk(root: &Path, relative: &str, create: bool) -> Result<PathBuf, PlaceError> {
    let mmt = MmtPath::from_relative(relative)?;
    if !root.is_dir() {
        return Err(PlaceError::MissingRoot);
    }
    let root_canon = root.canonicalize()?;
    let mut dir = root_canon.clone();
    for part in [mmt.car_folder.as_str(), "MMT", mmt.season.as_str()] {
        dir.push(part);
        if dir.exists() {
            let meta = fs::symlink_metadata(&dir)?;
            if meta.file_type().is_symlink() || !meta.is_dir() {
                return Err(PlaceError::Link);
            }
            let canon = dir.canonicalize()?;
            if !canon.starts_with(&root_canon) {
                return Err(PlaceError::Link);
            }
            dir = canon;
        } else if create {
            fs::create_dir(&dir)?;
        } else {
            return Err(PlaceError::MissingRoot);
        }
    }
    let dir_canon = dir.canonicalize()?;
    if !dir_canon.starts_with(&root_canon) {
        return Err(PlaceError::Link);
    }
    Ok(dir_canon.join(mmt.filename))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn creates_only_the_mmt_folders() {
        let root = tempfile::tempdir().unwrap();
        let dest = prepare_mmt_destination(root.path(), "ferrari296gt3/MMT/26S4/spa.sto").unwrap();
        assert!(dest.ends_with(Path::new("ferrari296gt3").join("MMT").join("26S4").join("spa.sto")));
        assert!(dest.parent().unwrap().is_dir());
        assert!(!dest.exists());
        assert!(dest.starts_with(root.path().canonicalize().unwrap()));
    }

    #[test]
    fn locate_missing_folder_does_not_create_it() {
        let root = tempfile::tempdir().unwrap();
        assert!(locate_mmt_file(root.path(), "ferrari296gt3/MMT/26S4/spa.sto").is_err());
        assert!(!root.path().join("ferrari296gt3").exists());
    }

    #[cfg(unix)]
    #[test]
    fn refuses_a_symlink_that_leaves_the_setups_folder() {
        let root = tempfile::tempdir().unwrap();
        let outside = tempfile::tempdir().unwrap();
        let car = root.path().join("ferrari296gt3");
        fs::create_dir(&car).unwrap();
        std::os::unix::fs::symlink(outside.path(), car.join("MMT")).unwrap();
        let err = prepare_mmt_destination(root.path(), "ferrari296gt3/MMT/26S4/spa.sto").unwrap_err();
        assert!(matches!(err, PlaceError::Link));
        assert!(outside.path().read_dir().unwrap().next().is_none());
    }
}
