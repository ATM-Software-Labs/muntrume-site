use std::time::Duration;

use futures_util::StreamExt;
use mmt_sync_core::{api_url, hash_bytes, Manifest, RemoteSetup, MAX_STO_BYTES};
use serde::Deserialize;

use crate::credentials::token_ok;

pub const MOCK_TOKEN: &str = "mock-token-not-stored";

#[derive(Debug)]
pub enum ApiError {
    Unauthorized,
    Expired,
    Pending,
    Message(String),
}

impl std::fmt::Display for ApiError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Unauthorized => write!(f, "La sesión ha caducado. Vuelve a vincular el ordenador."),
            Self::Expired => write!(f, "El código ha caducado. Empieza de nuevo."),
            Self::Pending => write!(f, "pending"),
            Self::Message(text) => write!(f, "{text}"),
        }
    }
}

#[derive(Clone)]
pub struct Api {
    client: reqwest::Client,
    pub mock: bool,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct Pilot {
    pub slug: String,
    pub name: String,
}

#[derive(Debug)]
pub struct DeviceStart {
    pub device_code: String,
    pub user_code: String,
    pub verify_url: String,
    pub interval: u64,
    pub expires_in: u64,
}

pub enum ManifestFetch {
    NotModified,
    Fresh { manifest: Manifest, etag: Option<String> },
}

impl Api {
    pub fn new(mock: bool) -> Result<Self, String> {
        let client = reqwest::Client::builder()
            .redirect(reqwest::redirect::Policy::limited(5))
            .timeout(Duration::from_secs(12))
            .connect_timeout(Duration::from_secs(4))
            .user_agent("MMT-Sync/0.1.0")
            .build()
            .map_err(|err| err.to_string())?;
        Ok(Self { client, mock })
    }

    pub async fn start(&self) -> Result<DeviceStart, ApiError> {
        if self.mock {
            return Ok(DeviceStart {
                device_code: "mock-device".into(),
                user_code: "MMT-DEMO".into(),
                verify_url: "https://muntru.me/app/vincular/?code=MMT-DEMO".into(),
                interval: 2,
                expires_in: 600,
            });
        }
        let body: StartBody = self.post_json("/api/desktop/auth/start", &serde_json::json!({}), None).await?;
        Ok(DeviceStart {
            device_code: body.device_code,
            user_code: body.user_code,
            verify_url: body.verify_url,
            interval: body.interval.max(1),
            expires_in: body.expires_in.max(30),
        })
    }

    pub async fn poll(&self, device_code: &str) -> Result<PollReady, ApiError> {
        if self.mock {
            return Ok(PollReady {
                token: MOCK_TOKEN.into(),
                pilot: demo_pilot(),
            });
        }
        let response = self
            .send(
                self.client
                    .post(api_url("/api/desktop/auth/poll").map_err(|err| ApiError::Message(err.to_string()))?)
                    .json(&serde_json::json!({ "device_code": device_code })),
            )
            .await?;
        match response.status().as_u16() {
            428 => Err(ApiError::Pending),
            410 => Err(ApiError::Expired),
            200 => {
                let body: ReadyBody = response.json().await.map_err(|_| ApiError::Message("La respuesta de acceso no es válida.".into()))?;
                if !token_ok(&body.token) {
                    return Err(ApiError::Message("El token recibido no es válido.".into()));
                }
                Ok(PollReady { token: body.token, pilot: body.pilot })
            }
            status => Err(ApiError::Message(message_from(status, response).await)),
        }
    }

    pub async fn me(&self, token: &str) -> Result<Pilot, ApiError> {
        if self.mock {
            return Ok(demo_pilot());
        }
        self.get_json("/api/desktop/me", token).await
    }

    pub async fn logout(&self, token: &str) -> Result<(), ApiError> {
        if self.mock {
            return Ok(());
        }
        let response = self.authed(self.client.post(api_url("/api/desktop/auth/logout").map_err(|err| ApiError::Message(err.to_string()))?), token)?.send().await.map_err(offline)?;
        if response.status().is_redirection() {
            return Err(ApiError::Message("Demasiadas redirecciones en el API.".into()));
        }
        if response.status().as_u16() == 401 {
            return Err(ApiError::Unauthorized);
        }
        if !response.status().is_success() {
            return Err(ApiError::Message(message_from(response.status().as_u16(), response).await));
        }
        Ok(())
    }

    pub async fn manifest(&self, token: &str, etag: Option<&str>) -> Result<ManifestFetch, ApiError> {
        if self.mock {
            return Ok(ManifestFetch::Fresh {
                manifest: Manifest {
                    generated_at: "2026-11-10T10:00:00Z".into(),
                    current_week: None,
                    season: None,
                    setups: demo_setups(),
                },
                etag: Some("\"demo\"".into()),
            });
        }
        let url = api_url("/api/desktop/manifest").map_err(|err| ApiError::Message(err.to_string()))?;
        let mut request = self.authed(self.client.get(url), token)?;
        if let Some(etag) = etag {
            request = request.header(reqwest::header::IF_NONE_MATCH, etag);
        }
        let response = request.send().await.map_err(offline)?;
        let status = response.status();
        if status.as_u16() == 304 {
            return Ok(ManifestFetch::NotModified);
        }
        if status.is_redirection() {
            return Err(ApiError::Message("Demasiadas redirecciones en el API.".into()));
        }
        if status.as_u16() == 401 {
            return Err(ApiError::Unauthorized);
        }
        if !response.status().is_success() {
            return Err(ApiError::Message(message_from(response.status().as_u16(), response).await));
        }
        let etag = response
            .headers()
            .get(reqwest::header::ETAG)
            .and_then(|value| value.to_str().ok())
            .map(str::to_string);
        let manifest = response
            .json::<Manifest>()
            .await
            .map_err(|_| ApiError::Message("El manifiesto no es válido.".into()))?;
        Ok(ManifestFetch::Fresh { manifest, etag })
    }

    pub async fn download(&self, token: &str, id: &str) -> Result<Vec<u8>, ApiError> {
        if self.mock {
            let bytes = demo_bytes(id);
            return Ok(bytes);
        }
        let path = format!("/api/desktop/setups/{id}/file");
        let url = api_url(&path).map_err(|err| ApiError::Message(err.to_string()))?;
        let response = self.authed(self.client.get(url), token)?.send().await.map_err(offline)?;
        if response.status().is_redirection() {
            return Err(ApiError::Message("Demasiadas redirecciones en el API.".into()));
        }
        if response.status().as_u16() == 401 {
            return Err(ApiError::Unauthorized);
        }
        if !response.status().is_success() {
            return Err(ApiError::Message(message_from(response.status().as_u16(), response).await));
        }
        if let Some(len) = response.content_length() {
            if len > MAX_STO_BYTES {
                return Err(ApiError::Message("El archivo supera 1 MB.".into()));
            }
        }
        read_capped(response).await
    }

    pub async fn upload(&self, token: &str, request: UploadRequest) -> Result<(), ApiError> {
        if self.mock {
            let _ = request;
            return Ok(());
        }
        let url = api_url("/api/desktop/setups/upload").map_err(|err| ApiError::Message(err.to_string()))?;
        let file = reqwest::multipart::Part::bytes(request.bytes)
            .file_name(request.filename)
            .mime_str("application/octet-stream")
            .map_err(|err| ApiError::Message(err.to_string()))?;
        let form = reqwest::multipart::Form::new()
            .part("file", file)
            .text("car_folder", request.car_folder)
            .text("track", request.track)
            .text("type", request.kind)
            .text("notes", request.notes);
        let response = self.authed(self.client.post(url), token)?.multipart(form).send().await.map_err(offline)?;
        if response.status().is_redirection() {
            return Err(ApiError::Message("Demasiadas redirecciones en el API.".into()));
        }
        if response.status().as_u16() == 401 {
            return Err(ApiError::Unauthorized);
        }
        if !response.status().is_success() {
            return Err(ApiError::Message(message_from(response.status().as_u16(), response).await));
        }
        Ok(())
    }

    fn authed(&self, request: reqwest::RequestBuilder, token: &str) -> Result<reqwest::RequestBuilder, ApiError> {
        if !token_ok(token) {
            return Err(ApiError::Unauthorized);
        }
        Ok(request.header(reqwest::header::AUTHORIZATION, format!("Bearer {token}")))
    }

    async fn post_json<T: for<'de> Deserialize<'de>>(
        &self,
        path: &str,
        body: &serde_json::Value,
        token: Option<&str>,
    ) -> Result<T, ApiError> {
        let url = api_url(path).map_err(|err| ApiError::Message(err.to_string()))?;
        let mut request = self.client.post(url).json(body);
        if let Some(token) = token {
            request = self.authed(request, token)?;
        }
        let response = self.send(request).await?;
        if !response.status().is_success() {
            return Err(ApiError::Message(message_from(response.status().as_u16(), response).await));
        }
        response
            .json()
            .await
            .map_err(|_| ApiError::Message("La respuesta del API no es válida.".into()))
    }

    async fn get_json<T: for<'de> Deserialize<'de>>(&self, path: &str, token: &str) -> Result<T, ApiError> {
        let url = api_url(path).map_err(|err| ApiError::Message(err.to_string()))?;
        let response = self.authed(self.client.get(url), token)?.send().await.map_err(offline)?;
        if response.status().as_u16() == 401 {
            return Err(ApiError::Unauthorized);
        }
        if !response.status().is_success() {
            return Err(ApiError::Message(message_from(response.status().as_u16(), response).await));
        }
        response
            .json()
            .await
            .map_err(|_| ApiError::Message("La respuesta del API no es válida.".into()))
    }

    async fn send(&self, request: reqwest::RequestBuilder) -> Result<reqwest::Response, ApiError> {
        let response = request.send().await.map_err(offline)?;
        if response.status().is_redirection() {
            return Err(ApiError::Message("Demasiadas redirecciones en el API.".into()));
        }
        Ok(response)
    }
}

pub struct PollReady {
    pub token: String,
    pub pilot: Pilot,
}

pub struct UploadRequest {
    pub filename: String,
    pub bytes: Vec<u8>,
    pub car_folder: String,
    pub track: String,
    pub kind: String,
    pub notes: String,
}

#[derive(Deserialize)]
struct StartBody {
    device_code: String,
    user_code: String,
    verify_url: String,
    interval: u64,
    expires_in: u64,
}

#[derive(Deserialize)]
struct ReadyBody {
    token: String,
    pilot: Pilot,
}

fn demo_pilot() -> Pilot {
    Pilot {
        slug: "albertot".into(),
        name: "Alberto Trujillo".into(),
    }
}

fn demo_bytes(id: &str) -> Vec<u8> {
    format!("MMT Sync demo {id}\n").into_bytes()
}

pub fn demo_setups() -> Vec<RemoteSetup> {
    let one = demo_bytes("spa");
    let two = demo_bytes("monza");
    vec![
        RemoteSetup {
            id: "spa".into(),
            car: "Ferrari 296 GT3".into(),
            car_folder: "ferrari296gt3".into(),
            track: "Spa-Francorchamps".into(),
            season: "26S4".into(),
            kind: "Race".into(),
            filename: "spa_race.sto".into(),
            sha256: hash_bytes(&one),
            size: one.len() as u64,
            updated_at: "2026-11-10T10:00:00Z".into(),
            week: None,
            notes: None,
            guide: None,
        },
        RemoteSetup {
            id: "monza".into(),
            car: "Porsche 992 GT3 R".into(),
            car_folder: "porsche992rgt3".into(),
            track: "Monza".into(),
            season: "26S4".into(),
            kind: "Qualy".into(),
            filename: "monza_qualy.sto".into(),
            sha256: hash_bytes(&two),
            size: two.len() as u64,
            updated_at: "2026-11-10T10:00:00Z".into(),
            week: None,
            notes: None,
            guide: None,
        },
    ]
}

async fn read_capped(response: reqwest::Response) -> Result<Vec<u8>, ApiError> {
    let mut out = Vec::new();
    let mut stream = response.bytes_stream();
    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|_| ApiError::Message("La descarga se interrumpió.".into()))?;
        if out.len() + chunk.len() > MAX_STO_BYTES as usize {
            return Err(ApiError::Message("El archivo supera 1 MB.".into()));
        }
        out.extend_from_slice(&chunk);
    }
    if out.is_empty() {
        return Err(ApiError::Message("El archivo está vacío.".into()));
    }
    Ok(out)
}

async fn message_from(status: u16, response: reqwest::Response) -> String {
    let text = response.text().await.unwrap_or_default();
    if let Ok(value) = serde_json::from_str::<serde_json::Value>(&text) {
        if let Some(message) = value.get("error").and_then(|item| item.as_str()) {
            if !message.is_empty() && message.chars().count() <= 180 {
                return message.to_string();
            }
        }
    }
    let _ = text;
    format!("El API respondió {status}.")
}

fn offline(err: reqwest::Error) -> ApiError {
    if err.is_connect() || err.is_timeout() {
        ApiError::Message("No hay conexión con muntru.me.".into())
    } else {
        ApiError::Message("No se pudo completar la petición.".into())
    }
}
