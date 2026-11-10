//! Manifiesto que devuelve `GET /api/desktop/manifest`.

use serde::{Deserialize, Deserializer, Serialize};
use std::fmt;

pub const MAX_STO_BYTES: u64 = 1024 * 1024;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct Manifest {
    #[serde(default)]
    pub generated_at: String,
    /// Semana que el API considera actual. Si no viene, la app no la inventa.
    #[serde(default)]
    pub current_week: Option<u32>,
    #[serde(default)]
    pub season: Option<String>,
    pub setups: Vec<RemoteSetup>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct RemoteSetup {
    #[serde(deserialize_with = "flexible_id")]
    pub id: String,
    pub car: String,
    pub car_folder: String,
    pub track: String,
    pub season: String,
    #[serde(rename = "type")]
    pub kind: String,
    pub filename: String,
    pub sha256: String,
    pub size: u64,
    pub updated_at: String,
    /// Semana iRacing, solo si el manifiesto la trae.
    #[serde(default)]
    pub week: Option<u32>,
    #[serde(default)]
    pub notes: Option<String>,
    #[serde(default)]
    pub guide: Option<String>,
}

pub fn flexible_id<'de, D>(deserializer: D) -> Result<String, D::Error>
where
    D: Deserializer<'de>,
{
    struct Visitor;
    impl serde::de::Visitor<'_> for Visitor {
        type Value = String;

        fn expecting(&self, formatter: &mut fmt::Formatter) -> fmt::Result {
            formatter.write_str("un id de setup")
        }

        fn visit_str<E: serde::de::Error>(self, value: &str) -> Result<Self::Value, E> {
            Ok(value.to_string())
        }

        fn visit_string<E: serde::de::Error>(self, value: String) -> Result<Self::Value, E> {
            Ok(value)
        }

        fn visit_u64<E: serde::de::Error>(self, value: u64) -> Result<Self::Value, E> {
            Ok(value.to_string())
        }

        fn visit_i64<E: serde::de::Error>(self, value: i64) -> Result<Self::Value, E> {
            Ok(value.to_string())
        }
    }
    deserializer.deserialize_any(Visitor)
}

pub fn parse_id(raw: &str) -> Option<String> {
    if raw.is_empty() || raw.len() > 80 {
        return None;
    }
    if raw
        .bytes()
        .all(|byte| byte.is_ascii_alphanumeric() || byte == b'-' || byte == b'_')
    {
        Some(raw.to_string())
    } else {
        None
    }
}

pub fn parse_sha256(raw: &str) -> Option<String> {
    let trimmed = raw.trim();
    if trimmed.len() != 64 || !trimmed.bytes().all(|byte| byte.is_ascii_hexdigit()) {
        return None;
    }
    Some(trimmed.to_ascii_lowercase())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_numeric_ids_and_the_type_field() {
        let raw = r#"{
            "generated_at": "2026-11-10T10:00:00Z",
            "setups": [{
                "id": 42,
                "car": "Ferrari 296 GT3",
                "car_folder": "ferrari296gt3",
                "track": "Spa",
                "season": "26S4",
                "type": "Race",
                "filename": "spa.sto",
                "sha256": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
                "size": 12,
                "updated_at": "2026-11-10T10:00:00Z"
            }]
        }"#;
        let manifest: Manifest = serde_json::from_str(raw).unwrap();
        assert_eq!(manifest.setups[0].id, "42");
        assert_eq!(manifest.setups[0].kind, "Race");
    }

    #[test]
    fn sha_must_be_64_hex_chars() {
        assert!(parse_sha256(&"ab".repeat(32)).is_some());
        assert!(parse_sha256(&"AB".repeat(32)).unwrap().chars().all(|c| !c.is_ascii_uppercase()));
        assert!(parse_sha256("abc").is_none());
        assert!(parse_sha256(&format!("{}g", "a".repeat(63))).is_none());
        assert!(parse_id("setup_1").is_some());
        assert!(parse_id("../x").is_none());
        assert!(parse_id("").is_none());
    }
}
