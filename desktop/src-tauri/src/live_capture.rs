//! Captura automática de telemetría en segundo plano desde la memoria compartida de iRacing (IRSDK).
//! Guarda sesiones comprimidas (.json.gz) en `%LOCALAPPDATA%\MMT Sync\sessions\` sin requerir `.ibt` ni `Alt+L`.

use std::fs::{self, File};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::sync::{Mutex, OnceLock};
use std::time::{SystemTime, UNIX_EPOCH};

use flate2::read::GzDecoder;
use flate2::write::GzEncoder;
use flate2::Compression;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};

use crate::ibt_parser::{IbtLapSummary, IbtSessionReport, TelemetrySample};

const MAX_STORED_SESSIONS: usize = 100;
const TARGET_SAMPLES_PER_LAP: usize = 500;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CapturedSessionMeta {
    pub id: String,
    pub file_path: String,
    pub captured_epoch_ms: u64,
    pub track_name: String,
    pub car_screen_name: String,
    pub best_lap_s: f32,
    pub total_laps: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CaptureStatusPayload {
    pub state: String, // "idle" | "recording" | "saved"
    pub track_name: String,
    pub car_screen_name: String,
    pub lap_num: i32,
    pub samples_count: usize,
    pub saved_laps: usize,
}

impl Default for CaptureStatusPayload {
    fn default() -> Self {
        Self {
            state: "idle".into(),
            track_name: String::new(),
            car_screen_name: String::new(),
            lap_num: 0,
            samples_count: 0,
            saved_laps: 0,
        }
    }
}

static CURRENT_STATUS: OnceLock<Mutex<CaptureStatusPayload>> = OnceLock::new();

fn status_cell() -> &'static Mutex<CaptureStatusPayload> {
    CURRENT_STATUS.get_or_init(|| Mutex::new(CaptureStatusPayload::default()))
}

pub fn get_status() -> CaptureStatusPayload {
    status_cell()
        .lock()
        .map(|g| g.clone())
        .unwrap_or_default()
}

fn publish_status(app: &AppHandle, next: CaptureStatusPayload) {
    if let Ok(mut guard) = status_cell().lock() {
        *guard = next.clone();
    }
    let _ = app.emit_to("main", "mmt-capture-state", &next);
}

pub fn sessions_dir() -> PathBuf {
    let base = std::env::var_os("LOCALAPPDATA")
        .map(PathBuf::from)
        .unwrap_or_else(std::env::temp_dir);
    let dir = base.join("MMT Sync").join("sessions");
    let _ = fs::create_dir_all(&dir);
    dir
}

fn index_path() -> PathBuf {
    sessions_dir().join("sessions_index.json")
}

fn now_epoch_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

fn extract_yaml_value(yaml: &str, key: &str) -> String {
    for line in yaml.lines() {
        let trimmed = line.trim();
        if let Some(rest) = trimmed.strip_prefix(key) {
            return rest.trim().trim_matches('"').trim_matches('\'').to_string();
        }
    }
    String::new()
}

fn parse_track_length_m(yaml: &str) -> f32 {
    let raw = extract_yaml_value(yaml, "TrackLength:");
    let num = raw
        .split_whitespace()
        .next()
        .and_then(|s| s.parse::<f32>().ok())
        .unwrap_or(0.0);
    if num > 0.2 && num < 50.0 {
        num * 1000.0
    } else if num >= 50.0 {
        num
    } else {
        4500.0
    }
}

fn slugify(input: &str) -> String {
    let mut out = String::with_capacity(input.len().min(32));
    for ch in input.chars() {
        if ch.is_ascii_alphanumeric() {
            out.push(ch.to_ascii_lowercase());
        } else if !out.ends_with('_') {
            out.push('_');
        }
        if out.len() >= 32 {
            break;
        }
    }
    let trimmed = out.trim_matches('_').to_string();
    if trimmed.is_empty() {
        "session".into()
    } else {
        trimmed
    }
}

fn downsample_samples(samples: &[TelemetrySample], max_points: usize) -> Vec<TelemetrySample> {
    if samples.len() <= max_points || max_points < 2 {
        return samples.to_vec();
    }
    let step = (samples.len() as f64) / (max_points as f64);
    let mut out = Vec::with_capacity(max_points);
    for i in 0..max_points {
        let idx = ((i as f64) * step).floor() as usize;
        out.push(samples[idx.min(samples.len() - 1)].clone());
    }
    out
}

fn normalize_xy(samples: &mut [TelemetrySample]) {
    let pts: Vec<(f32, f32)> = samples
        .iter()
        .filter_map(|s| match (s.x, s.y) {
            (Some(x), Some(y)) if x.is_finite() && y.is_finite() && (x.abs() > 1e-4 || y.abs() > 1e-4) => Some((x, y)),
            _ => None,
        })
        .collect();
    if pts.len() < 10 {
        for s in samples.iter_mut() {
            s.x = None;
            s.y = None;
        }
        return;
    }
    let mut min_x = f32::INFINITY;
    let mut max_x = f32::NEG_INFINITY;
    let mut min_y = f32::INFINITY;
    let mut max_y = f32::NEG_INFINITY;
    for &(x, y) in &pts {
        if x < min_x { min_x = x; }
        if x > max_x { max_x = x; }
        if y < min_y { min_y = y; }
        if y > max_y { max_y = y; }
    }
    let span = (max_x - min_x).max(max_y - min_y).max(1e-6);
    for s in samples.iter_mut() {
        if let (Some(x), Some(y)) = (s.x, s.y) {
            if x.is_finite() && y.is_finite() {
                s.x = Some(((x - min_x) / span).clamp(0.0, 1.0));
                s.y = Some(((y - min_y) / span).clamp(0.0, 1.0));
            } else {
                s.x = None;
                s.y = None;
            }
        }
    }
}

#[derive(Clone)]
struct RecordedLap {
    lap_num: i32,
    lap_time_s: f32,
    top_speed_kmh: f32,
    samples: Vec<TelemetrySample>,
}

pub struct LiveTelemetryRecorder {
    session_id: String,
    sub_session_id: String,
    track_name: String,
    track_config: String,
    track_length_m: f32,
    car_screen_name: String,
    driver_setup_name: String,
    track_temp: String,
    air_temp: String,
    fuel_start_l: f32,
    active_lap: i32,
    lap_start_session_t: f64,
    current_lap_samples: Vec<TelemetrySample>,
    completed_laps: Vec<RecordedLap>,
    was_on_track: bool,
    was_on_pit_road: bool,
    last_state: String,
    session_file_id: String,
    dirty_since_save: bool,
}

impl Default for LiveTelemetryRecorder {
    fn default() -> Self {
        Self {
            session_id: String::new(),
            sub_session_id: String::new(),
            track_name: String::new(),
            track_config: String::new(),
            track_length_m: 4500.0,
            car_screen_name: String::new(),
            driver_setup_name: String::new(),
            track_temp: String::new(),
            air_temp: String::new(),
            fuel_start_l: 0.0,
            active_lap: -1,
            lap_start_session_t: 0.0,
            current_lap_samples: Vec::with_capacity(4096),
            completed_laps: Vec::new(),
            was_on_track: false,
            was_on_pit_road: false,
            last_state: "idle".into(),
            session_file_id: String::new(),
            dirty_since_save: false,
        }
    }
}

impl LiveTelemetryRecorder {
    pub fn update_from_yaml(&mut self, yaml: &str) {
        let sid = extract_yaml_value(yaml, "SubSessionID:");
        let uid = extract_yaml_value(yaml, "SessionUniqueID:");
        if !sid.is_empty() && sid != self.sub_session_id {
            self.sub_session_id = sid;
            self.session_file_id.clear();
            self.completed_laps.clear();
            self.current_lap_samples.clear();
            self.active_lap = -1;
            self.dirty_since_save = false;
        }
        if !uid.is_empty() {
            self.session_id = uid;
        }
        let track = extract_yaml_value(yaml, "TrackDisplayName:");
        if !track.is_empty() {
            self.track_name = track;
        }
        let cfg = extract_yaml_value(yaml, "TrackConfigName:");
        if !cfg.is_empty() {
            self.track_config = cfg;
        }
        let len_m = parse_track_length_m(yaml);
        if len_m > 200.0 {
            self.track_length_m = len_m;
        }
        let car = crate::ibt_parser::extract_player_driver_field(yaml, "CarScreenName:");
        if !car.is_empty() {
            self.car_screen_name = car;
        }
        let setup = extract_yaml_value(yaml, "DriverSetupName:");
        if !setup.is_empty() {
            self.driver_setup_name = setup;
        }
    }

    pub fn push_frame(
        &mut self,
        app: &AppHandle,
        sample: &mmt_sync_core::Sample,
        frame: &mmt_sync_core::IrsdkFrame,
    ) {
        let p_idx = frame.player_car_idx.max(0) as usize;
        let cur_lap = frame.car_idx_lap.get(p_idx).copied().unwrap_or(0);
        let lap_dist_pct = frame
            .car_idx_lap_dist_pct
            .get(p_idx)
            .copied()
            .unwrap_or(0.0)
            .clamp(0.0, 1.0);

        if frame.track_temp_c.is_finite() && frame.track_temp_c > -20.0 {
            self.track_temp = format!("{:.1} °C", frame.track_temp_c);
        }
        if frame.air_temp_c.is_finite() && frame.air_temp_c > -20.0 {
            self.air_temp = format!("{:.1} °C", frame.air_temp_c);
        }
        if self.fuel_start_l <= 0.0 && frame.fuel_level.is_finite() && frame.fuel_level > 0.0 {
            self.fuel_start_l = frame.fuel_level as f32;
        }

        let active_driving = frame.is_on_track && !frame.is_replay_playing;

        if active_driving {
            if self.session_file_id.is_empty() {
                self.session_file_id = format!(
                    "session_{}_{}",
                    now_epoch_ms(),
                    slugify(if self.track_name.is_empty() { "iracing" } else { &self.track_name })
                );
            }

            if self.active_lap < 0 {
                self.active_lap = cur_lap;
                self.lap_start_session_t = frame.session_time;
                self.current_lap_samples.clear();
            } else if cur_lap > self.active_lap {
                // Lap completed!
                let reported_last = frame
                    .car_idx_last_lap_time
                    .get(p_idx)
                    .copied()
                    .unwrap_or(0.0) as f32;
                let computed_last = (frame.session_time - self.lap_start_session_t).max(0.0) as f32;
                let lap_time_s = if reported_last > 10.0 && reported_last < 900.0 {
                    reported_last
                } else {
                    computed_last
                };
                if self.current_lap_samples.len() >= 20 && lap_time_s > 10.0 && lap_time_s < 900.0 {
                    let top_speed = self
                        .current_lap_samples
                        .iter()
                        .map(|s| s.speed_kmh)
                        .fold(0.0_f32, f32::max);
                    let mut lap_samples = std::mem::take(&mut self.current_lap_samples);
                    normalize_xy(&mut lap_samples);
                    self.completed_laps.push(RecordedLap {
                        lap_num: self.active_lap,
                        lap_time_s,
                        top_speed_kmh: top_speed,
                        samples: downsample_samples(&lap_samples, TARGET_SAMPLES_PER_LAP),
                    });
                    self.dirty_since_save = true;
                    let _ = self.save_session_to_disk(app);
                } else {
                    self.current_lap_samples.clear();
                }
                self.active_lap = cur_lap;
                self.lap_start_session_t = frame.session_time;
            }

            let dist_m = if lap_dist_pct > 0.0 {
                (lap_dist_pct as f32) * self.track_length_m
            } else {
                sample.dist.max(0.0) as f32
            };
            let lap_time_s = (frame.session_time - self.lap_start_session_t).max(0.0) as f32;

            // Cap buffer per lap at 45000 samples (~12 min at 60Hz) to keep RAM bounded
            if self.current_lap_samples.len() < 45_000 {
                self.current_lap_samples.push(TelemetrySample {
                    dist_m,
                    lap_time_s,
                    speed_kmh: frame.speed_kmh.max(0.0) as f32,
                    throttle: frame.throttle.clamp(0.0, 1.0) as f32,
                    brake: frame.brake.clamp(0.0, 1.0) as f32,
                    steering_rad: frame.steering as f32,
                    gear: frame.gear,
                    rpm: Some(frame.rpm.max(0.0) as f32),
                    x: sample.lon.map(|v| v as f32),
                    y: sample.lat.map(|v| v as f32),
                });
            }

            // Auto-save when entering pit lane with recorded data
            if frame.on_pit_road && !self.was_on_pit_road {
                self.commit_partial_if_needed();
                if self.dirty_since_save {
                    let _ = self.save_session_to_disk(app);
                }
            }

            if self.last_state != "recording" {
                self.last_state = "recording".into();
                publish_status(
                    app,
                    CaptureStatusPayload {
                        state: "recording".into(),
                        track_name: self.track_name.clone(),
                        car_screen_name: self.car_screen_name.clone(),
                        lap_num: cur_lap,
                        samples_count: self.current_lap_samples.len(),
                        saved_laps: self.completed_laps.len(),
                    },
                );
            }
        } else if self.was_on_track {
            // Left track: auto-save immediately
            self.commit_partial_if_needed();
            let saved = if self.dirty_since_save {
                self.save_session_to_disk(app).is_some()
            } else {
                !self.completed_laps.is_empty()
            };
            let next_state = if saved { "saved" } else { "idle" };
            self.last_state = next_state.into();
            publish_status(
                app,
                CaptureStatusPayload {
                    state: next_state.into(),
                    track_name: self.track_name.clone(),
                    car_screen_name: self.car_screen_name.clone(),
                    lap_num: cur_lap,
                    samples_count: self.current_lap_samples.len(),
                    saved_laps: self.completed_laps.len(),
                },
            );
        }

        self.was_on_track = active_driving;
        self.was_on_pit_road = frame.on_pit_road;
    }

    pub fn flush_on_disconnect(&mut self, app: &AppHandle) {
        self.commit_partial_if_needed();
        if self.dirty_since_save {
            let _ = self.save_session_to_disk(app);
        }
        self.was_on_track = false;
        self.was_on_pit_road = false;
        self.last_state = "idle".into();
        publish_status(
            app,
            CaptureStatusPayload {
                state: "idle".into(),
                track_name: self.track_name.clone(),
                car_screen_name: self.car_screen_name.clone(),
                lap_num: 0,
                samples_count: 0,
                saved_laps: self.completed_laps.len(),
            },
        );
    }

    fn commit_partial_if_needed(&mut self) {
        if self.completed_laps.is_empty() && self.current_lap_samples.len() >= 120 {
            let lap_time_s = self
                .current_lap_samples
                .last()
                .map(|s| s.lap_time_s)
                .unwrap_or(0.0);
            if lap_time_s > 5.0 {
                let top_speed = self
                    .current_lap_samples
                    .iter()
                    .map(|s| s.speed_kmh)
                    .fold(0.0_f32, f32::max);
                let mut lap_samples = std::mem::take(&mut self.current_lap_samples);
                normalize_xy(&mut lap_samples);
                self.completed_laps.push(RecordedLap {
                    lap_num: self.active_lap.max(1),
                    lap_time_s,
                    top_speed_kmh: top_speed,
                    samples: downsample_samples(&lap_samples, TARGET_SAMPLES_PER_LAP),
                });
                self.dirty_since_save = true;
            }
        }
    }

    fn save_session_to_disk(&mut self, app: &AppHandle) -> Option<CapturedSessionMeta> {
        if self.completed_laps.is_empty() {
            return None;
        }
        let best_idx = self
            .completed_laps
            .iter()
            .enumerate()
            .min_by(|(_, a), (_, b)| {
                a.lap_time_s
                    .partial_cmp(&b.lap_time_s)
                    .unwrap_or(std::cmp::Ordering::Equal)
            })
            .map(|(i, _)| i)
            .unwrap_or(0);

        let best_lap = &self.completed_laps[best_idx];
        let best_lap_s = best_lap.lap_time_s;
        let avg_lap_s = self.completed_laps.iter().map(|l| l.lap_time_s).sum::<f32>()
            / (self.completed_laps.len() as f32);
        let top_speed_kmh = self
            .completed_laps
            .iter()
            .map(|l| l.top_speed_kmh)
            .fold(0.0_f32, f32::max);

        let laps: Vec<IbtLapSummary> = self
            .completed_laps
            .iter()
            .map(|l| IbtLapSummary {
                lap_num: l.lap_num,
                lap_time_s: (l.lap_time_s * 1000.0).round() / 1000.0,
                top_speed_kmh: (l.top_speed_kmh * 10.0).round() / 10.0,
                delta_s: ((l.lap_time_s - best_lap_s) * 1000.0).round() / 1000.0,
                is_valid: true,
                invalid_reason: None,
            })
            .collect();

        let epoch_ms = now_epoch_ms();
        let track_name = if self.track_name.is_empty() {
            "iRacing Circuit".into()
        } else {
            self.track_name.clone()
        };
        let car_name = if self.car_screen_name.is_empty() {
            "iRacing Car".into()
        } else {
            self.car_screen_name.clone()
        };
        if self.session_file_id.is_empty() {
            self.session_file_id = format!("session_{}_{}", epoch_ms, slugify(&track_name));
        }

        let file_name = format!("{}.json.gz", self.session_file_id);
        let file_path = sessions_dir().join(&file_name);

        let report = IbtSessionReport {
            file_name: file_name.clone(),
            session_unique_id: self.session_id.clone(),
            sub_session_id: self.sub_session_id.clone(),
            modified_epoch_ms: epoch_ms,
            track_name: track_name.clone(),
            track_config: self.track_config.clone(),
            track_length_m: self.track_length_m,
            track_temp: self.track_temp.clone(),
            air_temp: self.air_temp.clone(),
            track_rubber_state: "Auto-captura IRSDK".into(),
            driver_setup_name: self.driver_setup_name.clone(),
            fuel_level_start_l: self.fuel_start_l,
            car_path: slugify(&car_name),
            car_screen_name: car_name.clone(),
            best_lap_s: (best_lap_s * 1000.0).round() / 1000.0,
            avg_lap_s: (avg_lap_s * 1000.0).round() / 1000.0,
            top_speed_kmh: (top_speed_kmh * 10.0).round() / 10.0,
            total_laps: self.completed_laps.len(),
            laps,
            best_lap_samples: best_lap.samples.clone(),
        };

        let json_bytes = serde_json::to_vec(&report).ok()?;
        let tmp_path = file_path.with_extension("gz.tmp");
        {
            let file = File::create(&tmp_path).ok()?;
            let mut encoder = GzEncoder::new(file, Compression::fast());
            encoder.write_all(&json_bytes).ok()?;
            encoder.finish().ok()?;
        }
        let _ = fs::rename(&tmp_path, &file_path);

        let meta = CapturedSessionMeta {
            id: self.session_file_id.clone(),
            file_path: file_path.to_string_lossy().to_string(),
            captured_epoch_ms: epoch_ms,
            track_name,
            car_screen_name: car_name,
            best_lap_s: report.best_lap_s,
            total_laps: report.total_laps,
        };

        upsert_index(&meta);
        self.dirty_since_save = false;

        let _ = app.emit_to("main", "mmt-session-captured", &meta);
        publish_status(
            app,
            CaptureStatusPayload {
                state: if self.was_on_track { "recording".into() } else { "saved".into() },
                track_name: meta.track_name.clone(),
                car_screen_name: meta.car_screen_name.clone(),
                lap_num: self.active_lap,
                samples_count: self.current_lap_samples.len(),
                saved_laps: self.completed_laps.len(),
            },
        );
        Some(meta)
    }
}

fn upsert_index(meta: &CapturedSessionMeta) {
    let mut entries = list_captured_sessions();
    entries.retain(|e| e.id != meta.id);
    entries.insert(0, meta.clone());
    if entries.len() > MAX_STORED_SESSIONS {
        for removed in entries.drain(MAX_STORED_SESSIONS..) {
            let _ = fs::remove_file(&removed.file_path);
        }
    }
    if let Ok(raw) = serde_json::to_vec_pretty(&entries) {
        let _ = fs::write(index_path(), raw);
    }
}

pub fn list_captured_sessions() -> Vec<CapturedSessionMeta> {
    let idx_path = index_path();
    if let Ok(raw) = fs::read(&idx_path) {
        if let Ok(mut list) = serde_json::from_slice::<Vec<CapturedSessionMeta>>(&raw) {
            list.retain(|e| Path::new(&e.file_path).exists());
            list.sort_by_key(|entry| std::cmp::Reverse(entry.captured_epoch_ms));
            return list;
        }
    }
    // Rebuild index from .json.gz files if index is missing
    let dir = sessions_dir();
    let mut rebuilt = Vec::new();
    if let Ok(rd) = fs::read_dir(&dir) {
        for entry in rd.flatten() {
            let p = entry.path();
            if p.extension().and_then(|e| e.to_str()) == Some("gz") {
                if let Some(report) = read_captured_session(&p.to_string_lossy()) {
                    let id = p
                        .file_name()
                        .and_then(|s| s.to_str())
                        .unwrap_or("session")
                        .trim_end_matches(".json.gz")
                        .to_string();
                    rebuilt.push(CapturedSessionMeta {
                        id,
                        file_path: p.to_string_lossy().to_string(),
                        captured_epoch_ms: report.modified_epoch_ms,
                        track_name: report.track_name,
                        car_screen_name: report.car_screen_name,
                        best_lap_s: report.best_lap_s,
                        total_laps: report.total_laps,
                    });
                }
            }
        }
    }
    rebuilt.sort_by_key(|entry| std::cmp::Reverse(entry.captured_epoch_ms));
    if !rebuilt.is_empty() {
        if let Ok(raw) = serde_json::to_vec_pretty(&rebuilt) {
            let _ = fs::write(&idx_path, raw);
        }
    }
    rebuilt
}

pub fn read_captured_session(path: &str) -> Option<IbtSessionReport> {
    let target = PathBuf::from(path);
    let root = sessions_dir();
    let canon_root = fs::canonicalize(&root).unwrap_or(root);
    let canon_target = fs::canonicalize(&target).ok()?;
    if !canon_target.starts_with(&canon_root) {
        return None;
    }
    let file = File::open(&canon_target).ok()?;
    let mut decoder = GzDecoder::new(file);
    let mut raw = String::new();
    decoder.read_to_string(&mut raw).ok()?;
    serde_json::from_str::<IbtSessionReport>(&raw).ok()
}
