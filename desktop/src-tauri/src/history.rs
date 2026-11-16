use std::fs;
use std::path::PathBuf;

use serde::{Deserialize, Serialize};

use mmt_sync_core::atomic_write;

use crate::folders;

const MAX_HISTORY_ENTRIES: usize = 50;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RaceSessionEntry {
    pub sub_session_id: i64,
    pub fecha: String,
    pub circuito: String,
    pub coche: String,
    pub tipo_sesion: String,
    pub pos_salida: i32,
    pub pos_final: i32,
    pub incidentes: i32,
    pub delta_i_rating: i32,
    pub mejor_vuelta: f64,
    pub vuelta_media: f64,
    pub consistencia_pct: f64,
    #[serde(default)]
    pub vueltas_validas: i32,
    #[serde(default)]
    pub favorite: bool,
    #[serde(default)]
    pub ibt_path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct StreakSummary {
    pub clean_race_streak: u32,
    pub top5_podium_streak: u32,
    pub valid_laps_streak: i32,
    pub net_positions_gained_10: i32,
    pub avg_consistency_pct: f64,
    pub total_races: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RaceHistoryResponse {
    pub sessions: Vec<RaceSessionEntry>,
    pub streaks: StreakSummary,
}

fn history_path() -> PathBuf {
    #[cfg(windows)]
    {
        if let Ok(local_app) = std::env::var("LOCALAPPDATA") {
            return PathBuf::from(local_app).join("MMT Sync").join("race_history.json");
        }
    }
    folders::app_data_dir().join("race_history.json")
}

pub fn load_entries() -> Vec<RaceSessionEntry> {
    let path = history_path();
    let Ok(raw) = fs::read_to_string(&path) else {
        return Vec::new();
    };
    serde_json::from_str::<Vec<RaceSessionEntry>>(&raw).unwrap_or_default()
}

fn save_entries(entries: &[RaceSessionEntry]) -> Result<(), String> {
    let path = history_path();
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("No se pudo crear carpeta de historial: {e}"))?;
    }
    let json = serde_json::to_string_pretty(entries)
        .map_err(|e| format!("Error serializando historial: {e}"))?;
    atomic_write(&path, json.as_bytes()).map_err(|e| format!("No se pudo guardar race_history.json: {e}"))
}

pub fn compute_streaks(entries: &[RaceSessionEntry]) -> StreakSummary {
    let races: Vec<&RaceSessionEntry> = entries
        .iter()
        .filter(|e| e.tipo_sesion.to_lowercase().contains("race"))
        .collect();
    let source: Vec<&RaceSessionEntry> = if races.is_empty() {
        entries.iter().collect()
    } else {
        races
    };

    let mut clean_race_streak = 0u32;
    for e in &source {
        if e.incidentes < 4 {
            clean_race_streak += 1;
        } else {
            break;
        }
    }

    let mut top5_podium_streak = 0u32;
    for e in &source {
        if e.pos_final > 0 && e.pos_final <= 5 {
            top5_podium_streak += 1;
        } else {
            break;
        }
    }

    let mut valid_laps_streak = 0i32;
    for e in entries {
        if e.incidentes == 0 {
            valid_laps_streak += e.vueltas_validas.max(1);
        } else {
            break;
        }
    }

    let last10 = source.iter().take(10);
    let mut net_positions_gained_10 = 0i32;
    let mut consistency_sum = 0.0f64;
    let mut consistency_count = 0usize;
    for e in last10 {
        if e.pos_salida > 0 && e.pos_final > 0 {
            net_positions_gained_10 += e.pos_salida - e.pos_final;
        }
        if e.consistencia_pct > 0.0 {
            consistency_sum += e.consistencia_pct;
            consistency_count += 1;
        }
    }

    let avg_consistency_pct = if consistency_count > 0 {
        (consistency_sum / consistency_count as f64 * 10.0).round() / 10.0
    } else {
        0.0
    };

    StreakSummary {
        clean_race_streak,
        top5_podium_streak,
        valid_laps_streak,
        net_positions_gained_10,
        avg_consistency_pct,
        total_races: source.len(),
    }
}

pub fn get_history() -> RaceHistoryResponse {
    let sessions = load_entries();
    let streaks = compute_streaks(&sessions);
    RaceHistoryResponse { sessions, streaks }
}

pub fn record_entry(mut entry: RaceSessionEntry) -> Result<RaceHistoryResponse, String> {
    if entry.consistencia_pct <= 0.0 && entry.vuelta_media > 0.0 && entry.mejor_vuelta > 0.0 {
        let std_est = (entry.vuelta_media - entry.mejor_vuelta).abs() * 0.5;
        entry.consistencia_pct = (100.0 - (std_est / entry.vuelta_media) * 100.0).clamp(0.0, 100.0);
    }
    let mut entries = load_entries();
    if let Some(pos) = entries.iter().position(|e| e.sub_session_id == entry.sub_session_id && entry.sub_session_id > 0) {
        entry.favorite = entries[pos].favorite || entry.favorite;
        entries[pos] = entry;
    } else {
        entries.insert(0, entry);
    }
    entries.truncate(MAX_HISTORY_ENTRIES);
    save_entries(&entries)?;
    let streaks = compute_streaks(&entries);
    Ok(RaceHistoryResponse { sessions: entries, streaks })
}

pub fn toggle_favorite(sub_session_id: i64) -> Result<RaceHistoryResponse, String> {
    let mut entries = load_entries();
    if let Some(item) = entries.iter_mut().find(|e| e.sub_session_id == sub_session_id) {
        item.favorite = !item.favorite;
        save_entries(&entries)?;
    }
    let streaks = compute_streaks(&entries);
    Ok(RaceHistoryResponse { sessions: entries, streaks })
}
