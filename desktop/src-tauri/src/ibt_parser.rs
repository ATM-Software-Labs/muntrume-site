use std::collections::{BTreeMap, HashMap};
use std::fs::File;
use std::io::{BufReader, Read, Seek, SeekFrom};
use std::path::Path;

use serde::{Deserialize, Serialize};

const IRSDK_VAR_HEADER_SIZE: usize = 144;
const IRSDK_HEADER_BASE_SIZE: usize = 112;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TelemetrySample {
    pub dist_m: f32,
    pub lap_time_s: f32,
    pub speed_kmh: f32,
    pub throttle: f32,
    pub brake: f32,
    pub steering_rad: f32,
    pub gear: i32,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub rpm: Option<f32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub x: Option<f32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub y: Option<f32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IbtLapSummary {
    pub lap_num: i32,
    pub lap_time_s: f32,
    pub top_speed_kmh: f32,
    pub delta_s: f32,
    pub is_valid: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub invalid_reason: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IbtSessionMeta {
    pub file_path: String,
    pub file_name: String,
    pub modified_epoch_ms: u64,
    pub session_unique_id: String,
    pub sub_session_id: String,
    pub track_name: String,
    pub track_config: String,
    pub car_path: String,
    pub car_screen_name: String,
    pub is_recent_48h: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IbtSessionReport {
    pub file_name: String,
    pub session_unique_id: String,
    pub sub_session_id: String,
    pub modified_epoch_ms: u64,
    pub track_name: String,
    pub track_config: String,
    pub track_length_m: f32,
    pub track_temp: String,
    pub air_temp: String,
    pub track_rubber_state: String,
    pub driver_setup_name: String,
    pub fuel_level_start_l: f32,
    pub car_path: String,
    pub car_screen_name: String,
    pub best_lap_s: f32,
    pub avg_lap_s: f32,
    pub top_speed_kmh: f32,
    pub total_laps: usize,
    pub laps: Vec<IbtLapSummary>,
    pub best_lap_samples: Vec<TelemetrySample>,
}

#[derive(Debug, Clone, Copy)]
struct VarOffset {
    offset: usize,
    var_type: i32,
}

#[inline]
fn finite_or(v: f32, fallback: f32) -> f32 {
    if v.is_finite() {
        v
    } else {
        fallback
    }
}

fn read_f32_le(buf: &[u8], offset: usize, var_type: i32) -> f32 {
    match var_type {
        4 => {
            if offset + 4 > buf.len() {
                return 0.0;
            }
            let val = f32::from_le_bytes(buf[offset..offset + 4].try_into().unwrap_or([0; 4]));
            finite_or(val, 0.0)
        }
        5 => {
            if offset + 8 > buf.len() {
                return 0.0;
            }
            let val = f64::from_le_bytes(buf[offset..offset + 8].try_into().unwrap_or([0; 8])) as f32;
            finite_or(val, 0.0)
        }
        _ => 0.0,
    }
}

fn read_f64_le(buf: &[u8], offset: usize, var_type: i32) -> f64 {
    match var_type {
        4 => {
            if offset + 4 > buf.len() {
                return 0.0;
            }
            let val = f32::from_le_bytes(buf[offset..offset + 4].try_into().unwrap_or([0; 4])) as f64;
            if val.is_finite() { val } else { 0.0 }
        }
        5 => {
            if offset + 8 > buf.len() {
                return 0.0;
            }
            let val = f64::from_le_bytes(buf[offset..offset + 8].try_into().unwrap_or([0; 8]));
            if val.is_finite() { val } else { 0.0 }
        }
        _ => 0.0,
    }
}

fn parse_track_length_m(yaml: &str) -> f32 {
    let raw = extract_yaml_field(yaml, "TrackLength:");
    let num: f32 = raw
        .split_whitespace()
        .next()
        .and_then(|s| s.parse::<f32>().ok())
        .unwrap_or(0.0);
    if num <= 0.0 {
        return 0.0;
    }
    if raw.to_lowercase().contains("mi") {
        num * 1609.34
    } else {
        num * 1000.0
    }
}

fn read_i32_le(buf: &[u8], offset: usize, var_type: i32) -> i32 {
    if var_type != 2 || offset + 4 > buf.len() {
        return 0;
    }
    i32::from_le_bytes(buf[offset..offset + 4].try_into().unwrap_or([0; 4]))
}

fn read_u32_le(buf: &[u8], offset: usize, var_type: i32) -> u32 {
    if (var_type != 3 && var_type != 2) || offset + 4 > buf.len() {
        return 0;
    }
    u32::from_le_bytes(buf[offset..offset + 4].try_into().unwrap_or([0; 4]))
}

fn read_bool_le(buf: &[u8], offset: usize, var_type: i32) -> bool {
    if offset >= buf.len() {
        return false;
    }
    match var_type {
        1 => buf[offset] != 0,
        2 | 3 => offset + 4 <= buf.len() && i32::from_le_bytes(buf[offset..offset + 4].try_into().unwrap_or([0; 4])) != 0,
        _ => false,
    }
}

fn file_modified_epoch_ms(path: &Path) -> u64 {
    std::fs::metadata(path)
        .and_then(|m| m.modified())
        .ok()
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

fn extract_yaml_field(yaml: &str, key: &str) -> String {
    for line in yaml.lines() {
        let trimmed = line.trim();
        if let Some(rest) = trimmed.strip_prefix(key) {
            return rest.trim().trim_matches('"').trim_matches('\'').to_string();
        }
    }
    String::new()
}

/// Reads only header + YAML metadata from an `.ibt` file to list sessions quickly.
pub fn read_ibt_meta(path: &Path) -> Result<IbtSessionMeta, String> {
    let file = File::open(path).map_err(|e| format!("No se pudo abrir .ibt: {e}"))?;
    let mut reader = BufReader::with_capacity(16 * 1024, file);
    let mut hdr = [0u8; IRSDK_HEADER_BASE_SIZE];
    reader
        .read_exact(&mut hdr)
        .map_err(|e| format!("Cabecera .ibt inválida: {e}"))?;
    let session_info_len = i32::from_le_bytes(hdr[16..20].try_into().unwrap()).max(0) as usize;
    let session_info_offset = i32::from_le_bytes(hdr[20..24].try_into().unwrap()).max(0) as u64;
    let mut yaml = String::new();
    if session_info_len > 0
        && session_info_len <= 2 * 1024 * 1024
        && reader.seek(SeekFrom::Start(session_info_offset)).is_ok()
    {
        let mut raw_yaml = vec![0u8; session_info_len];
        if reader.read_exact(&mut raw_yaml).is_ok() {
            let end = raw_yaml.iter().position(|&b| b == 0).unwrap_or(raw_yaml.len());
            yaml = mmt_sync_core::decode_irsdk_text(&raw_yaml[..end]);
        }
    }
    let modified_epoch_ms = file_modified_epoch_ms(path);
    let now_ms = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0);
    let is_recent_48h = modified_epoch_ms > 0 && now_ms.saturating_sub(modified_epoch_ms) <= 48 * 3600 * 1000;
    Ok(IbtSessionMeta {
        file_path: path.to_string_lossy().to_string(),
        file_name: path.file_name().and_then(|n| n.to_str()).unwrap_or("session.ibt").to_string(),
        modified_epoch_ms,
        session_unique_id: extract_yaml_field(&yaml, "SessionUniqueID:"),
        sub_session_id: extract_yaml_field(&yaml, "SubSessionID:"),
        track_name: extract_yaml_field(&yaml, "TrackDisplayName:"),
        track_config: extract_yaml_field(&yaml, "TrackConfigName:"),
        car_path: extract_yaml_field(&yaml, "CarPath:"),
        car_screen_name: extract_yaml_field(&yaml, "CarScreenName:"),
        is_recent_48h,
    })
}

/// Parses essential channels from an iRacing `.ibt` binary telemetry file in streaming mode.
pub fn parse_ibt_channels(path: &Path) -> Result<Vec<TelemetrySample>, String> {
    let report = parse_ibt_report(path)?;
    Ok(report.best_lap_samples)
}

/// Parses session metadata (anonymized) and per-lap telemetry from a real `.ibt` file.
pub fn parse_ibt_report(path: &Path) -> Result<IbtSessionReport, String> {
    let file = File::open(path).map_err(|e| format!("No se pudo abrir .ibt: {e}"))?;
    let mut reader = BufReader::with_capacity(64 * 1024, file);

    let mut hdr = [0u8; IRSDK_HEADER_BASE_SIZE];
    reader
        .read_exact(&mut hdr)
        .map_err(|e| format!("Cabecera .ibt inválida: {e}"))?;

    let tick_rate = i32::from_le_bytes(hdr[8..12].try_into().unwrap());
    let dt_s = if tick_rate > 0 && tick_rate <= 1000 {
        1.0f64 / (tick_rate as f64)
    } else {
        1.0f64 / 60.0f64
    };
    let session_info_len = i32::from_le_bytes(hdr[16..20].try_into().unwrap()).max(0) as usize;
    let session_info_offset = i32::from_le_bytes(hdr[20..24].try_into().unwrap()).max(0) as u64;
    let num_vars = i32::from_le_bytes(hdr[24..28].try_into().unwrap()).max(0) as usize;
    let var_header_offset = i32::from_le_bytes(hdr[28..32].try_into().unwrap()).max(0) as u64;
    let num_buf = i32::from_le_bytes(hdr[32..36].try_into().unwrap()).max(1) as usize;
    let buf_len = i32::from_le_bytes(hdr[36..40].try_into().unwrap()).max(0) as usize;
    let data_offset = i32::from_le_bytes(hdr[52..56].try_into().unwrap()).max(0) as u64;

    if buf_len == 0 || num_buf == 0 {
        return Err("El archivo .ibt no contiene buffers válidos".into());
    }

    let mut yaml = String::new();
    if session_info_len > 0
        && session_info_len <= 2 * 1024 * 1024
        && reader.seek(SeekFrom::Start(session_info_offset)).is_ok()
    {
        let mut raw_yaml = vec![0u8; session_info_len];
        if reader.read_exact(&mut raw_yaml).is_ok() {
            let end = raw_yaml.iter().position(|&b| b == 0).unwrap_or(raw_yaml.len());
            yaml = mmt_sync_core::decode_irsdk_text(&raw_yaml[..end]);
        }
    }

    reader
        .seek(SeekFrom::Start(var_header_offset))
        .map_err(|e| format!("Seek var_header fallido: {e}"))?;

    let wanted = [
        "Lap",
        "LapDist",
        "LapDistPct",
        "LapCurrentLapTime",
        "LapLastLapTime",
        "Speed",
        "Throttle",
        "Brake",
        "SteeringWheelAngle",
        "Gear",
        "OnPitRoad",
        "SessionFlags",
        "PlayerCarMyIncidentCount",
        "FuelLevel",
        "Lat",
        "Lon",
        "Yaw",
        "VelocityX",
        "VelocityY",
    ];
    let mut offsets: HashMap<String, VarOffset> = HashMap::with_capacity(wanted.len());
    let mut var_buf = [0u8; IRSDK_VAR_HEADER_SIZE];

    for _ in 0..num_vars {
        reader
            .read_exact(&mut var_buf)
            .map_err(|e| format!("Error leyendo variable .ibt: {e}"))?;
        let var_type = i32::from_le_bytes(var_buf[0..4].try_into().unwrap());
        let offset = i32::from_le_bytes(var_buf[4..8].try_into().unwrap()) as usize;
        let name_bytes = &var_buf[16..48];
        let name_end = name_bytes
            .iter()
            .position(|&b| b == 0)
            .unwrap_or(name_bytes.len());
        let name = std::str::from_utf8(&name_bytes[..name_end]).unwrap_or("");

        if wanted.contains(&name) {
            offsets.insert(name.to_string(), VarOffset { offset, var_type });
        }
    }

    let get_var = |k: &str| offsets.get(k).copied();
    let (Some(v_dist), Some(v_time), Some(v_speed), Some(v_thr), Some(v_brk), Some(v_str)) = (
        get_var("LapDist"),
        get_var("LapCurrentLapTime"),
        get_var("Speed"),
        get_var("Throttle"),
        get_var("Brake"),
        get_var("SteeringWheelAngle"),
    ) else {
        return Err("Faltan canales esenciales en el .ibt".into());
    };
    let v_lap = get_var("Lap");
    let v_pct = get_var("LapDistPct");
    let v_last_lap = get_var("LapLastLapTime");
    let v_gear = get_var("Gear");
    let v_pit = get_var("OnPitRoad");
    let v_flags = get_var("SessionFlags");
    let v_inc = get_var("PlayerCarMyIncidentCount");
    let v_fuel = get_var("FuelLevel");
    let v_lat = get_var("Lat");
    let v_lon = get_var("Lon");
    let v_yaw = get_var("Yaw");
    let v_vx = get_var("VelocityX");
    let v_vy = get_var("VelocityY");

    reader
        .seek(SeekFrom::Start(data_offset))
        .map_err(|e| format!("Seek a datos .ibt fallido: {e}"))?;

    #[derive(Clone)]
    struct RawIbtPoint {
        sample: TelemetrySample,
        lat: Option<f64>,
        lon: Option<f64>,
        yaw: Option<f64>,
        vx: Option<f64>,
        vy: Option<f64>,
    }

    #[derive(Default)]
    struct LapMetaState {
        saw_pit_road: bool,
        had_caution_flag: bool,
        had_invalid_time: bool,
        min_inc: Option<i32>,
        max_inc: Option<i32>,
        crossed_start: bool,
        crossed_finish: bool,
        start_fuel_l: Option<f32>,
    }

    let mut frame = vec![0u8; buf_len];
    let mut laps_map: BTreeMap<i32, Vec<RawIbtPoint>> = BTreeMap::new();
    let mut lap_states: BTreeMap<i32, LapMetaState> = BTreeMap::new();
    let mut official_lap_times: HashMap<i32, f32> = HashMap::new();
    let mut global_top_speed = 0.0f32;
    let mut global_max_dist = 0.0f32;
    let mut prev_lap_num: Option<i32> = None;
    let mut prev_pct: Option<f32> = None;
    let mut first_fuel_l = 0.0f32;
    let mut last_seen_official_t = 0.0f32;
    let mut last_completed_lap: Option<i32> = None;

    while reader.read_exact(&mut frame).is_ok() {
        let dist_m = read_f32_le(&frame, v_dist.offset, v_dist.var_type);
        let lap_time_s = read_f32_le(&frame, v_time.offset, v_time.var_type);
        if dist_m < 0.0 || !dist_m.is_finite() || !lap_time_s.is_finite() {
            continue;
        }
        if dist_m > global_max_dist {
            global_max_dist = dist_m;
        }
        let speed_kmh = (read_f32_le(&frame, v_speed.offset, v_speed.var_type) * 3.6).max(0.0);
        if speed_kmh > global_top_speed {
            global_top_speed = speed_kmh;
        }
        let lap_num = v_lap
            .map(|vl| read_i32_le(&frame, vl.offset, vl.var_type))
            .unwrap_or(1)
            .max(1);
        let pct = v_pct
            .map(|vp| read_f32_le(&frame, vp.offset, vp.var_type))
            .unwrap_or(0.0);
        let crossed_line = prev_pct.is_some_and(|p| p > 0.90 && pct < 0.10);

        if let Some(prev) = prev_lap_num {
            if lap_num > prev || crossed_line {
                if crossed_line {
                    lap_states.entry(prev).or_default().crossed_finish = true;
                    lap_states.entry(lap_num).or_default().crossed_start = true;
                }
                if lap_num > prev {
                    last_completed_lap = Some(prev);
                }
            }
        }
        if let (Some(completed), Some(vl)) = (last_completed_lap, v_last_lap) {
            let official_t = read_f32_le(&frame, vl.offset, vl.var_type);
            if official_t > 20.0 && official_t < 1800.0 && (official_t - last_seen_official_t).abs() > 0.0005 {
                official_lap_times.insert(completed, official_t);
                last_seen_official_t = official_t;
                last_completed_lap = None;
            }
        }
        prev_lap_num = Some(lap_num);
        if v_pct.is_some() {
            prev_pct = Some(pct);
        }

        let st = lap_states.entry(lap_num).or_default();
        if v_pit.is_some_and(|vp| read_bool_le(&frame, vp.offset, vp.var_type)) {
            st.saw_pit_road = true;
        }
        if let Some(vf) = v_flags {
            let flags = read_u32_le(&frame, vf.offset, vf.var_type);
            // Yellow (0x0008), YellowWaving (0x0010), Caution (0x4000), CautionWaving (0x8000), Red (0x0002_0000)
            if (flags & 0x0002_C018) != 0 {
                st.had_caution_flag = true;
            }
        }
        if let Some(vi) = v_inc {
            let inc = read_i32_le(&frame, vi.offset, vi.var_type);
            st.min_inc = Some(st.min_inc.map_or(inc, |m| m.min(inc)));
            st.max_inc = Some(st.max_inc.map_or(inc, |m| m.max(inc)));
        }
        if let Some(vfl) = v_fuel {
            let fl = read_f32_le(&frame, vfl.offset, vfl.var_type);
            if fl > 0.0 && fl.is_finite() {
                if first_fuel_l <= 0.0 {
                    first_fuel_l = fl;
                }
                if st.start_fuel_l.is_none() {
                    st.start_fuel_l = Some(fl);
                }
            }
        }
        if lap_time_s < 0.0 {
            st.had_invalid_time = true;
        }

        let gear = v_gear.map(|vg| read_i32_le(&frame, vg.offset, vg.var_type)).unwrap_or(0);
        let lat_opt = v_lat
            .map(|v| read_f64_le(&frame, v.offset, v.var_type))
            .filter(|v| v.is_finite() && v.abs() > 0.01);
        let lon_opt = v_lon
            .map(|v| read_f64_le(&frame, v.offset, v.var_type))
            .filter(|v| v.is_finite() && v.abs() > 0.01);
        let yaw_opt = v_yaw
            .map(|v| read_f64_le(&frame, v.offset, v.var_type))
            .filter(|v| v.is_finite());
        let vx_opt = v_vx
            .map(|v| read_f64_le(&frame, v.offset, v.var_type))
            .filter(|v| v.is_finite());
        let vy_opt = v_vy
            .map(|v| read_f64_le(&frame, v.offset, v.var_type))
            .filter(|v| v.is_finite());

        laps_map.entry(lap_num).or_default().push(RawIbtPoint {
            sample: TelemetrySample {
                dist_m,
                lap_time_s,
                speed_kmh,
                throttle: read_f32_le(&frame, v_thr.offset, v_thr.var_type).clamp(0.0, 1.0),
                brake: read_f32_le(&frame, v_brk.offset, v_brk.var_type).clamp(0.0, 1.0),
                steering_rad: read_f32_le(&frame, v_str.offset, v_str.var_type),
                gear,
                rpm: None,
                x: None,
                y: None,
            },
            lat: lat_opt,
            lon: lon_opt,
            yaw: yaw_opt,
            vx: vx_opt,
            vy: vy_opt,
        });
    }

    let yaml_track_len = parse_track_length_m(&yaml);
    let track_len_m = if yaml_track_len > 300.0 {
        yaml_track_len
    } else {
        global_max_dist.max(1200.0)
    };

    let mut valid_laps: Vec<(i32, f32, f32)> = Vec::new();
    let mut all_laps_raw: Vec<(i32, f32, f32, bool, Option<String>)> = Vec::new();
    let mut fallback_longest_lap: Option<i32> = None;
    let mut longest_span = 0.0f32;

    for (lap_num, pts) in &laps_map {
        if pts.len() < 40 {
            continue;
        }
        let min_d = pts.iter().map(|p| p.sample.dist_m).fold(f32::INFINITY, f32::min);
        let max_d = pts.iter().map(|p| p.sample.dist_m).fold(0.0f32, f32::max);
        let span_d = max_d - min_d;
        if span_d > longest_span {
            longest_span = span_d;
            fallback_longest_lap = Some(*lap_num);
        }

        let max_t = pts.iter().map(|p| p.sample.lap_time_s).fold(0.0f32, f32::max);
        let lap_t = official_lap_times
            .get(lap_num)
            .copied()
            .filter(|&t| t > 20.0)
            .unwrap_or(max_t);
        let top_spd = pts.iter().map(|p| p.sample.speed_kmh).fold(0.0f32, f32::max);

        let st = lap_states.get(lap_num);
        let saw_pit = st.is_some_and(|s| s.saw_pit_road);
        let had_caution = st.is_some_and(|s| s.had_caution_flag);
        let had_inc = st.is_some_and(|s| matches!((s.min_inc, s.max_inc), (Some(a), Some(b)) if b > a));
        let invalid_time = st.is_some_and(|s| s.had_invalid_time) || lap_t <= 20.0 || lap_t >= 1800.0;
        let incomplete = min_d > 220.0 || max_d < track_len_m * 0.90;

        let invalid_reason = if saw_pit {
            Some("Boxes (Out/In-Lap)".to_string())
        } else if had_inc {
            Some("Incidente / Off-track".to_string())
        } else if had_caution {
            Some("Bandera amarilla/roja".to_string())
        } else if incomplete {
            Some("Vuelta incompleta".to_string())
        } else if invalid_time {
            Some("Tiempo inválido".to_string())
        } else {
            None
        };

        let is_valid = invalid_reason.is_none();
        if is_valid {
            valid_laps.push((*lap_num, lap_t, top_spd));
        }
        all_laps_raw.push((*lap_num, lap_t, top_spd, is_valid, invalid_reason));
    }

    let best_lap = valid_laps
        .iter()
        .min_by(|a, b| a.1.total_cmp(&b.1))
        .copied();
    let best_lap_s = best_lap.map(|l| l.1).unwrap_or(0.0);
    let avg_lap_s = if valid_laps.is_empty() {
        0.0
    } else {
        valid_laps.iter().map(|l| l.1).sum::<f32>() / (valid_laps.len() as f32)
    };

    let laps: Vec<IbtLapSummary> = all_laps_raw
        .into_iter()
        .map(|(lap_num, lap_time_s, top_speed_kmh, is_valid, invalid_reason)| IbtLapSummary {
            lap_num,
            lap_time_s,
            top_speed_kmh,
            delta_s: if best_lap_s > 0.0 && lap_time_s > 0.0 {
                (lap_time_s - best_lap_s).max(0.0)
            } else {
                0.0
            },
            is_valid,
            invalid_reason,
        })
        .collect();

    let best_pts_raw: &[RawIbtPoint] = best_lap
        .and_then(|(num, _, _)| laps_map.get(&num))
        .or_else(|| fallback_longest_lap.and_then(|num| laps_map.get(&num)))
        .or_else(|| laps_map.values().next())
        .map(Vec::as_slice)
        .unwrap_or(&[]);

    // Compute GPS bounding box across the selected lap for accurate 1:1 track map projection.
    let gps_coords: Vec<(f64, f64)> = best_pts_raw
        .iter()
        .filter_map(|p| match (p.lon, p.lat) {
            (Some(lon), Some(lat)) => Some((lon, lat)),
            _ => None,
        })
        .collect();

    let gps_bounds = if gps_coords.len() > 20 {
        let min_lon = gps_coords.iter().map(|c| c.0).fold(f64::INFINITY, f64::min);
        let max_lon = gps_coords.iter().map(|c| c.0).fold(f64::NEG_INFINITY, f64::max);
        let min_lat = gps_coords.iter().map(|c| c.1).fold(f64::INFINITY, f64::min);
        let max_lat = gps_coords.iter().map(|c| c.1).fold(f64::NEG_INFINITY, f64::max);
        let mid_lat_rad = ((min_lat + max_lat) * 0.5).to_radians();
        let cos_lat = mid_lat_rad.cos().abs().max(0.2);
        let span_x = (max_lon - min_lon) * cos_lat;
        let span_y = max_lat - min_lat;
        let max_span = span_x.max(span_y);
        if max_span > 1e-6 {
            Some((min_lon, min_lat, cos_lat, span_x, span_y, max_span))
        } else {
            None
        }
    } else {
        None
    };

    // Dead-reckoning fallback from Yaw + VelocityX/Y (or Speed) when Lat/Lon are absent in .ibt
    let dr_norm: Vec<(f32, f32)> = if gps_bounds.is_none() && best_pts_raw.len() > 20 && v_yaw.is_some() {
        let mut raw_xy = Vec::with_capacity(best_pts_raw.len());
        let mut cx = 0.0f64;
        let mut cy = 0.0f64;
        for p in best_pts_raw {
            let yaw = p.yaw.unwrap_or(0.0);
            let speed_ms = (p.sample.speed_kmh as f64) / 3.6;
            let (wx, wy) = match (p.vx, p.vy) {
                (Some(vx), Some(vy)) => (vx * yaw.cos() - vy * yaw.sin(), vx * yaw.sin() + vy * yaw.cos()),
                _ => (speed_ms * yaw.cos(), speed_ms * yaw.sin()),
            };
            cx += wx * dt_s;
            cy += wy * dt_s;
            raw_xy.push((cx, cy));
        }
        let min_x = raw_xy.iter().map(|c| c.0).fold(f64::INFINITY, f64::min);
        let max_x = raw_xy.iter().map(|c| c.0).fold(f64::NEG_INFINITY, f64::max);
        let min_y = raw_xy.iter().map(|c| c.1).fold(f64::INFINITY, f64::min);
        let max_y = raw_xy.iter().map(|c| c.1).fold(f64::NEG_INFINITY, f64::max);
        let span_x = max_x - min_x;
        let span_y = max_y - min_y;
        let max_span = span_x.max(span_y);
        if max_span > 10.0 {
            let offset_x = (max_span - span_x) * 0.5;
            let offset_y = (max_span - span_y) * 0.5;
            raw_xy
                .into_iter()
                .map(|(x, y)| {
                    let nx = 5.0 + ((x - min_x + offset_x) / max_span) * 90.0;
                    let ny = 95.0 - ((y - min_y + offset_y) / max_span) * 90.0;
                    (nx as f32, ny as f32)
                })
                .collect()
        } else {
            Vec::new()
        }
    } else {
        Vec::new()
    };

    // Downsample to <= 600 points for crisp 60 FPS Canvas rendering and 1m distance interpolation.
    let stride = (best_pts_raw.len() / 600).max(1);
    let best_lap_samples = best_pts_raw
        .iter()
        .enumerate()
        .step_by(stride)
        .map(|(idx, p)| {
            let mut s = p.sample.clone();
            if let (Some((min_lon, min_lat, cos_lat, span_x, span_y, max_span)), Some(lon), Some(lat)) =
                (gps_bounds, p.lon, p.lat)
            {
                let offset_x = (max_span - span_x) * 0.5;
                let offset_y = (max_span - span_y) * 0.5;
                let nx = 5.0 + (((lon - min_lon) * cos_lat + offset_x) / max_span) * 90.0;
                let ny = 95.0 - (((lat - min_lat) + offset_y) / max_span) * 90.0;
                s.x = Some(nx as f32);
                s.y = Some(ny as f32);
            } else if let Some(&(nx, ny)) = dr_norm.get(idx) {
                s.x = Some(nx);
                s.y = Some(ny);
            }
            s
        })
        .collect();

    let file_name = path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("session.ibt")
        .to_string();
    let best_fuel_l = best_lap
        .and_then(|(num, _, _)| lap_states.get(&num))
        .and_then(|st| st.start_fuel_l)
        .unwrap_or(first_fuel_l);
    let track_temp = {
        let t = extract_yaml_field(&yaml, "TrackSurfaceTemp:");
        if t.is_empty() { extract_yaml_field(&yaml, "TrackTempCrew:") } else { t }
    };
    let air_temp = {
        let a = extract_yaml_field(&yaml, "TrackAirTemp:");
        if a.is_empty() { extract_yaml_field(&yaml, "AirTemp:") } else { a }
    };

    Ok(IbtSessionReport {
        file_name,
        session_unique_id: extract_yaml_field(&yaml, "SessionUniqueID:"),
        sub_session_id: extract_yaml_field(&yaml, "SubSessionID:"),
        modified_epoch_ms: file_modified_epoch_ms(path),
        track_name: extract_yaml_field(&yaml, "TrackDisplayName:"),
        track_config: extract_yaml_field(&yaml, "TrackConfigName:"),
        track_length_m: track_len_m,
        track_temp,
        air_temp,
        track_rubber_state: extract_yaml_field(&yaml, "TrackRubberState:"),
        driver_setup_name: extract_yaml_field(&yaml, "DriverSetupName:"),
        fuel_level_start_l: best_fuel_l,
        car_path: extract_yaml_field(&yaml, "CarPath:"),
        car_screen_name: extract_yaml_field(&yaml, "CarScreenName:"),
        best_lap_s,
        avg_lap_s,
        top_speed_kmh: global_top_speed,
        total_laps: valid_laps.len(),
        laps,
        best_lap_samples,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn finite_or_replaces_nan_and_inf() {
        assert_eq!(finite_or(f32::NAN, 1.5), 1.5);
        assert_eq!(finite_or(f32::INFINITY, 0.0), 0.0);
        assert_eq!(finite_or(42.25, 0.0), 42.25);
    }

    #[test]
    fn read_f32_le_handles_bounds_and_nan() {
        let mut buf = [0u8; 8];
        buf[0..4].copy_from_slice(&f32::NAN.to_le_bytes());
        assert_eq!(read_f32_le(&buf, 0, 4), 0.0);
        assert_eq!(read_f32_le(&buf, 6, 4), 0.0);
    }
}
