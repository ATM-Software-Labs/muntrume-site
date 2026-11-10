use std::sync::atomic::AtomicBool;
use std::sync::Mutex;
use std::time::{Duration, Instant};

use serde::Serialize;

use crate::api::Api;
use crate::credentials;

pub struct PendingAuth {
    pub device_code: String,
    pub user_code: String,
    pub verify_url: String,
    pub interval: Duration,
    pub expires_at: Instant,
    pub next_poll: Instant,
    pub polls: u32,
}

pub struct StagedFile {
    pub filename: String,
    pub bytes: Vec<u8>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StagedMeta {
    pub filename: String,
    pub size: u64,
}

pub struct AppState {
    pub api: Api,
    pub pending: Mutex<Option<PendingAuth>>,
    pub mock_token: Mutex<Option<String>>,
    pub staged: Mutex<Option<StagedFile>>,
    pub syncing: AtomicBool,
    pub update_version: Mutex<Option<String>>,
}

impl AppState {
    pub fn new(mock: bool) -> Result<Self, String> {
        Ok(Self {
            api: Api::new(mock)?,
            pending: Mutex::new(None),
            mock_token: Mutex::new(None),
            staged: Mutex::new(None),
            syncing: AtomicBool::new(false),
            update_version: Mutex::new(None),
        })
    }

    pub fn token(&self) -> Result<String, String> {
        if self.api.mock {
            return self
                .mock_token
                .lock()
                .map_err(|_| "No se pudo leer la sesión.".to_string())?
                .clone()
                .ok_or_else(|| "Vincula el ordenador con muntru.me.".to_string());
        }
        credentials::load_token()
    }

    pub fn store_session(&self, token: &str) -> Result<(), String> {
        if self.api.mock {
            *self.mock_token.lock().map_err(|_| "No se pudo guardar la sesión.".to_string())? = Some(token.to_string());
            return Ok(());
        }
        credentials::store_token(token)
    }

    pub fn clear_session(&self) -> Result<(), String> {
        if self.api.mock {
            *self.mock_token.lock().map_err(|_| "No se pudo cerrar la sesión.".to_string())? = None;
            return Ok(());
        }
        credentials::clear_token()
    }
}
