use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};

use mmt_sync_core::atomic_write;

use crate::folders;

const CACHE_TTL_SECS: u64 = 7 * 24 * 60 * 60;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HotlapRefResult {
    pub video_id: String,
    pub title: String,
    pub channel: String,
    pub lap_time: Option<String>,
    pub thumbnail_url: String,
    pub embed_url: String,
    pub cached_at_epoch: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReplayClipInfo {
    pub path: String,
    pub filename: String,
    pub size_mb: f64,
    pub modified_epoch: u64,
}

fn cache_path() -> PathBuf {
    #[cfg(windows)]
    {
        if let Ok(local_app) = std::env::var("LOCALAPPDATA") {
            return PathBuf::from(local_app)
                .join("MMT Sync")
                .join("cache")
                .join("hotlap_refs.json");
        }
    }
    folders::app_data_dir().join("cache").join("hotlap_refs.json")
}

fn now_epoch() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

fn load_cache() -> HashMap<String, HotlapRefResult> {
    let Ok(raw) = fs::read_to_string(cache_path()) else {
        return HashMap::new();
    };
    serde_json::from_str(&raw).unwrap_or_default()
}

fn save_cache(map: &HashMap<String, HotlapRefResult>) {
    let path = cache_path();
    if let Some(parent) = path.parent() {
        let _ = fs::create_dir_all(parent);
    }
    if let Ok(json) = serde_json::to_string_pretty(map) {
        let _ = atomic_write(&path, json.as_bytes());
    }
}

fn channel_priority(channel: &str, title: &str) -> u8 {
    let c = channel.to_lowercase();
    let t = title.to_lowercase();
    if c.contains("hymo") || t.contains("hymo") {
        1
    } else if c.contains("vrs") || c.contains("virtual racing school") || t.contains("vrs") {
        2
    } else if c.contains("gng") || c.contains("grid and go") || t.contains("gng") || t.contains("grid & go") {
        3
    } else if c.contains("major") || c.contains("craig") || t.contains("craig") {
        4
    } else {
        5
    }
}

fn extract_lap_time(title: &str) -> Option<String> {
    let bytes = title.as_bytes();
    for i in 0..bytes.len() {
        if i + 7 <= bytes.len()
            && bytes[i].is_ascii_digit()
            && bytes[i + 1] == b':'
            && bytes[i + 2].is_ascii_digit()
            && bytes[i + 3].is_ascii_digit()
            && bytes[i + 4] == b'.'
            && bytes[i + 5].is_ascii_digit()
        {
            let mut end = i + 6;
            while end < bytes.len() && bytes[end].is_ascii_digit() && end - i < 9 {
                end += 1;
            }
            return Some(title[i..end].to_string());
        }
    }
    None
}

fn unescape_json_str(raw: &str) -> String {
    raw.replace("\\\"", "\"")
        .replace("\\u0026", "&")
        .replace("\\/", "/")
}

fn parse_youtube_candidates(html: &str) -> Vec<(u8, HotlapRefResult)> {
    let mut results = Vec::new();
    let mut seen_ids = Vec::new();
    let marker = "\"videoRenderer\":{\"videoId\":\"";
    let mut search_from = 0usize;

    while let Some(rel) = html[search_from..].find(marker) {
        let start = search_from + rel + marker.len();
        let Some(end_id) = html[start..].find('"') else {
            break;
        };
        let video_id = html[start..start + end_id].to_string();
        search_from = start + end_id;
        if video_id.len() != 11 || seen_ids.contains(&video_id) {
            continue;
        }
        seen_ids.push(video_id.clone());

        let slice_end = (search_from + 4500).min(html.len());
        let chunk = &html[search_from..slice_end];

        let title = chunk
            .split("\"title\":{\"runs\":[{\"text\":\"")
            .nth(1)
            .and_then(|s| s.split('"').next())
            .map(unescape_json_str)
            .unwrap_or_else(|| "Hotlap de referencia".to_string());

        let channel = chunk
            .split("\"ownerText\":{\"runs\":[{\"text\":\"")
            .nth(1)
            .and_then(|s| s.split('"').next())
            .map(unescape_json_str)
            .unwrap_or_else(|| "YouTube".to_string());

        let prio = channel_priority(&channel, &title);
        let lap_time = extract_lap_time(&title);
        let thumbnail_url = format!("https://i.ytimg.com/vi/{video_id}/hqdefault.jpg");
        let embed_url = format!("https://www.youtube-nocookie.com/embed/{video_id}?enablejsapi=1&rel=0");

        results.push((
            prio,
            HotlapRefResult {
                video_id,
                title,
                channel,
                lap_time,
                thumbnail_url,
                embed_url,
                cached_at_epoch: now_epoch(),
            },
        ));
        if results.len() >= 15 {
            break;
        }
    }

    results.sort_by_key(|(prio, _)| *prio);
    results
}

pub async fn find_reference_hotlap(car: String, track: String, season: String) -> Result<HotlapRefResult, String> {
    let key = format!(
        "{}::{}::{}",
        car.trim().to_lowercase(),
        track.trim().to_lowercase(),
        season.trim().to_lowercase()
    );
    let now = now_epoch();
    let mut cache = load_cache();
    if let Some(hit) = cache.get(&key) {
        if now.saturating_sub(hit.cached_at_epoch) < CACHE_TTL_SECS {
            return Ok(hit.clone());
        }
    }

    let query = format!("iRacing {} {} {} Hotlap HYMO OR VRS OR GnG", car.trim(), track.trim(), season.trim());
    let encoded: String = query
        .bytes()
        .map(|b| match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' => (b as char).to_string(),
            b' ' => "+".to_string(),
            _ => format!("%{:02X}", b),
        })
        .collect();
    let url = format!("https://www.youtube.com/results?search_query={encoded}");

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(8))
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0.0.0 Safari/537.36")
        .build()
        .map_err(|e| e.to_string())?;

    let html = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("Error buscando en YouTube: {e}"))?
        .text()
        .await
        .map_err(|e| format!("Error leyendo respuesta de YouTube: {e}"))?;

    let candidates = parse_youtube_candidates(&html);
    let (_, best) = candidates
        .into_iter()
        .next()
        .ok_or_else(|| "No se encontró un hotlap de referencia para esta combinación.".to_string())?;

    cache.insert(key, best.clone());
    save_cache(&cache);
    Ok(best)
}

pub fn find_latest_replay_clip(dir_str: &str) -> Option<ReplayClipInfo> {
    let dir = Path::new(dir_str);
    if dir_str.trim().is_empty() || !dir.is_dir() {
        return None;
    }
    let mut newest: Option<(u64, PathBuf, u64)> = None;
    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if !path.is_file() {
                continue;
            }
            let ext = path
                .extension()
                .and_then(|s| s.to_str())
                .map(|s| s.to_ascii_lowercase())
                .unwrap_or_default();
            if ext != "mp4" && ext != "mkv" && ext != "mov" {
                continue;
            }
            let Ok(meta) = entry.metadata() else {
                continue;
            };
            let modified = meta
                .modified()
                .ok()
                .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
                .map(|d| d.as_secs())
                .unwrap_or(0);
            if newest.as_ref().map(|(m, _, _)| modified > *m).unwrap_or(true) {
                newest = Some((modified, path, meta.len()));
            }
        }
    }
    let (modified_epoch, path, bytes) = newest?;
    let filename = path.file_name()?.to_string_lossy().to_string();
    Some(ReplayClipInfo {
        path: path.to_string_lossy().to_string(),
        filename,
        size_mb: ((bytes as f64 / (1024.0 * 1024.0)) * 10.0).round() / 10.0,
        modified_epoch,
    })
}
