//! Índice en `%APPDATA%\MMT Sync\index.json` y escritura atómica.
//! Este archivo no guarda el token.

use std::fs::{self, OpenOptions};
use std::io::{self, Write};
use std::path::Path;

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use thiserror::Error;

use crate::manifest::RemoteSetup;
use crate::plan::LocalSetup;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct IndexFile {
    pub version: u32,
    #[serde(default)]
    pub etag: Option<String>,
    #[serde(default)]
    pub generated_at: String,
    #[serde(default)]
    pub pilot_slug: Option<String>,
    #[serde(default)]
    pub pilot_name: Option<String>,
    #[serde(default)]
    pub manifest: Vec<RemoteSetup>,
    #[serde(default)]
    pub files: Vec<LocalSetup>,
    #[serde(default)]
    pub last_sync_rfc3339: Option<String>,
    #[serde(default)]
    pub last_downloaded: u32,
    #[serde(default)]
    pub last_cars: Vec<String>,
}

impl Default for IndexFile {
    fn default() -> Self {
        Self {
            version: 1,
            etag: None,
            generated_at: String::new(),
            pilot_slug: None,
            pilot_name: None,
            manifest: Vec::new(),
            files: Vec::new(),
            last_sync_rfc3339: None,
            last_downloaded: 0,
            last_cars: Vec::new(),
        }
    }
}

#[derive(Debug, Error)]
pub enum StoreError {
    #[error("no se pudo leer el índice local")]
    Io(#[from] io::Error),
    #[error("el índice local está dañado")]
    Json(#[from] serde_json::Error),
    #[error("la versión del índice local no es compatible")]
    Version,
}

pub fn load_index(path: &Path) -> Result<IndexFile, StoreError> {
    if !path.exists() {
        return Ok(IndexFile::default());
    }
    let bytes = fs::read(path)?;
    let index: IndexFile = serde_json::from_slice(&bytes)?;
    if index.version != 1 {
        return Err(StoreError::Version);
    }
    Ok(index)
}

pub fn save_index(path: &Path, index: &IndexFile) -> Result<(), StoreError> {
    let bytes = serde_json::to_vec_pretty(index)?;
    atomic_write(path, &bytes)?;
    Ok(())
}

pub fn hash_bytes(bytes: &[u8]) -> String {
    let digest = Sha256::digest(bytes);
    hex_encode(&digest)
}

pub fn atomic_write(dest: &Path, bytes: &[u8]) -> io::Result<()> {
    let parent = dest.parent().ok_or_else(|| {
        io::Error::new(io::ErrorKind::InvalidInput, "el destino no tiene carpeta")
    })?;
    fs::create_dir_all(parent)?;
    let file_name = dest.file_name().ok_or_else(|| {
        io::Error::new(io::ErrorKind::InvalidInput, "el destino no tiene nombre")
    })?;
    let mut tmp_name = file_name.to_os_string();
    tmp_name.push(".mmt-tmp");
    let tmp = parent.join(tmp_name);
    if tmp.exists() {
        fs::remove_file(&tmp)?;
    }
    {
        let mut file = OpenOptions::new().write(true).create_new(true).open(&tmp)?;
        file.write_all(bytes)?;
        file.sync_all()?;
    }
    if let Err(err) = replace_file(&tmp, dest) {
        let _ = fs::remove_file(&tmp);
        return Err(err);
    }
    Ok(())
}

fn replace_file(from: &Path, to: &Path) -> io::Result<()> {
    #[cfg(windows)]
    {
        // `std::fs::rename` no sustituye un archivo existente en Windows.
        // MoveFileEx con REPLACE_EXISTING es el reemplazo en el mismo volumen.
        use std::os::windows::ffi::OsStrExt;
        use windows_sys::Win32::Storage::FileSystem::{
            MoveFileExW, MOVEFILE_REPLACE_EXISTING, MOVEFILE_WRITE_THROUGH,
        };
        fn wide(path: &Path) -> Vec<u16> {
            path.as_os_str().encode_wide().chain(std::iter::once(0)).collect()
        }
        let src = wide(from);
        let dst = wide(to);
        let ok = unsafe {
            MoveFileExW(
                src.as_ptr(),
                dst.as_ptr(),
                MOVEFILE_REPLACE_EXISTING | MOVEFILE_WRITE_THROUGH,
            )
        };
        if ok == 0 {
            Err(io::Error::last_os_error())
        } else {
            Ok(())
        }
    }
    #[cfg(not(windows))]
    {
        fs::rename(from, to)
    }
}

fn hex_encode(bytes: &[u8]) -> String {
    const HEX: &[u8; 16] = b"0123456789abcdef";
    let mut out = String::with_capacity(bytes.len() * 2);
    for byte in bytes {
        out.push(HEX[(byte >> 4) as usize] as char);
        out.push(HEX[(byte & 0x0f) as usize] as char);
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn atomic_write_replaces_and_leaves_no_temp_file() {
        let dir = tempfile::tempdir().unwrap();
        let dest = dir.path().join("spa.sto");
        atomic_write(&dest, b"uno").unwrap();
        assert_eq!(fs::read(&dest).unwrap(), b"uno");
        atomic_write(&dest, b"dos").unwrap();
        assert_eq!(fs::read(&dest).unwrap(), b"dos");
        assert!(!dest.with_file_name("spa.sto.mmt-tmp").exists());
        let nested = dir.path().join("ferrari296gt3").join("MMT").join("26S4").join("a.sto");
        atomic_write(&nested, b"abc").unwrap();
        assert_eq!(fs::read(nested).unwrap(), b"abc");
    }

    #[test]
    fn index_roundtrip_and_corrupt_file() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("index.json");
        assert!(load_index(&path).unwrap().manifest.is_empty());
        let mut index = IndexFile {
            etag: Some("\"abc\"".into()),
            ..IndexFile::default()
        };
        index.files.push(LocalSetup {
            id: "a".into(),
            relative_path: "ferrari296gt3/MMT/26S4/spa.sto".into(),
            sha256: "ab".repeat(32),
            size: 3,
        });
        save_index(&path, &index).unwrap();
        let loaded = load_index(&path).unwrap();
        assert_eq!(loaded.etag.as_deref(), Some("\"abc\""));
        assert_eq!(loaded.files[0].id, "a");
        fs::write(&path, b"{").unwrap();
        assert!(load_index(&path).is_err());
    }

    #[test]
    fn hash_is_stable_lowercase_hex() {
        assert_eq!(hash_bytes(b"abc").len(), 64);
        assert_eq!(
            hash_bytes(b"abc"),
            "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
        );
    }
}
