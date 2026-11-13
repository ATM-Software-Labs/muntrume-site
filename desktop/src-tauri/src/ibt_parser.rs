use std::collections::HashMap;
use std::fs::File;
use std::io::{BufReader, Read, Seek, SeekFrom};
use std::path::Path;

use serde::Serialize;

const IRSDK_VAR_HEADER_SIZE: usize = 144;
const IRSDK_HEADER_BASE_SIZE: usize = 112;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TelemetrySample {
    pub dist_m: f32,
    pub lap_time_s: f32,
    pub speed_kmh: f32,
    pub throttle: f32,
    pub brake: f32,
    pub steering_rad: f32,
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

/// Parses essential channels from an iRacing `.ibt` binary telemetry file in streaming mode.
pub fn parse_ibt_channels(path: &Path) -> Result<Vec<TelemetrySample>, String> {
    let file = File::open(path).map_err(|e| format!("No se pudo abrir .ibt: {e}"))?;
    let mut reader = BufReader::with_capacity(64 * 1024, file);

    let mut hdr = [0u8; IRSDK_HEADER_BASE_SIZE];
    reader
        .read_exact(&mut hdr)
        .map_err(|e| format!("Cabecera .ibt inválida: {e}"))?;

    let num_vars = i32::from_le_bytes(hdr[24..28].try_into().unwrap()) as usize;
    let var_header_offset = i32::from_le_bytes(hdr[28..32].try_into().unwrap()) as u64;
    let num_buf = i32::from_le_bytes(hdr[32..36].try_into().unwrap()).max(1) as usize;
    let buf_len = i32::from_le_bytes(hdr[36..40].try_into().unwrap()) as usize;
    let data_offset = i32::from_le_bytes(hdr[52..56].try_into().unwrap()) as u64;

    if buf_len == 0 || num_buf == 0 {
        return Err("El archivo .ibt no contiene buffers válidos".into());
    }

    reader
        .seek(SeekFrom::Start(var_header_offset))
        .map_err(|e| format!("Seek var_header fallido: {e}"))?;

    let wanted = [
        "LapDist",
        "LapCurrentLapTime",
        "Speed",
        "Throttle",
        "Brake",
        "SteeringWheelAngle",
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

    reader
        .seek(SeekFrom::Start(data_offset))
        .map_err(|e| format!("Seek a datos .ibt fallido: {e}"))?;

    let mut frame = vec![0u8; buf_len];
    let mut samples = Vec::with_capacity(4096);

    while reader.read_exact(&mut frame).is_ok() {
        let dist_m = read_f32_le(&frame, v_dist.offset, v_dist.var_type);
        let lap_time_s = read_f32_le(&frame, v_time.offset, v_time.var_type);
        if dist_m < 0.0 || !dist_m.is_finite() || !lap_time_s.is_finite() {
            continue;
        }

        samples.push(TelemetrySample {
            dist_m,
            lap_time_s,
            speed_kmh: (read_f32_le(&frame, v_speed.offset, v_speed.var_type) * 3.6).max(0.0),
            throttle: read_f32_le(&frame, v_thr.offset, v_thr.var_type).clamp(0.0, 1.0),
            brake: read_f32_le(&frame, v_brk.offset, v_brk.var_type).clamp(0.0, 1.0),
            steering_rad: read_f32_le(&frame, v_str.offset, v_str.var_type),
        });
    }

    Ok(samples)
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
