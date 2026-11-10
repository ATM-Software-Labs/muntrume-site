//! Lector de `.ibt`. Solo lee la cabecera, las variables y las muestras documentadas.
//! No escribe en la memoria del simulador.

use crate::session::{Lap, Sample, Session};
use thiserror::Error;

const VAR_HEADER_SIZE: usize = 144;
const HEADER_SIZE: usize = 112;

#[derive(Debug, Error, PartialEq, Eq)]
pub enum IbtError {
    #[error("el archivo es demasiado corto para ser un .ibt")]
    Short,
    #[error("la cabecera del .ibt no es válida")]
    Header,
    #[error("el .ibt no trae las variables de una vuelta")]
    Variables,
}

pub fn parse_ibt(bytes: &[u8]) -> Result<Session, IbtError> {
    if bytes.len() < HEADER_SIZE {
        return Err(IbtError::Short);
    }
    let session_len = i32_at(bytes, 16).max(0) as usize;
    let session_off = i32_at(bytes, 20).max(0) as usize;
    let num_vars = i32_at(bytes, 24);
    let var_off = i32_at(bytes, 28).max(0) as usize;
    let buf_len = i32_at(bytes, 36);
    let buf_off = i32_at(bytes, 48 + 4);
    if num_vars <= 0 || num_vars > 4096 || buf_len <= 0 || buf_len > 1_000_000 {
        return Err(IbtError::Header);
    }
    let var_bytes = num_vars as usize * VAR_HEADER_SIZE;
    if var_off.saturating_add(var_bytes) > bytes.len() || buf_off < 0 || buf_off as usize >= bytes.len() {
        return Err(IbtError::Header);
    }
    let _ = (session_off, session_len);
    let mut vars = Vec::with_capacity(num_vars as usize);
    for index in 0..num_vars as usize {
        let start = var_off + index * VAR_HEADER_SIZE;
        vars.push(Var {
            kind: i32_at(bytes, start),
            offset: i32_at(bytes, start + 4),
            name: c_string(&bytes[start + 16..start + 48]),
        });
    }
    let find = |name: &str| vars.iter().find(|var| var.name == name);
    if find("Lap").is_none() || find("SessionTime").is_none() {
        return Err(IbtError::Variables);
    }
    let sample_len = buf_len as usize;
    let mut laps: Vec<Lap> = Vec::new();
    let mut cursor = buf_off as usize;
    while cursor + sample_len <= bytes.len() {
        let sample = read_sample(bytes, cursor, &vars);
        cursor += sample_len;
        if sample.number <= 0 {
            continue;
        }
        if laps.last().map(|lap| lap.number) != Some(sample.number) {
            laps.push(Lap {
                number: sample.number,
                samples: Vec::new(),
            });
        }
        laps.last_mut().unwrap().samples.push(sample.sample);
    }
    laps.retain(|lap| lap.samples.len() >= 2);
    if laps.is_empty() {
        return Err(IbtError::Variables);
    }
    Ok(Session {
        source: "ibt".into(),
        laps,
    })
}

/// Lee la muestra más nueva de la memoria del SDK. Solo lectura.
pub fn read_live_sample(bytes: &[u8]) -> Result<Sample, IbtError> {
    if bytes.len() < HEADER_SIZE {
        return Err(IbtError::Short);
    }
    let num_vars = i32_at(bytes, 24);
    let var_off = i32_at(bytes, 28).max(0) as usize;
    let buf_len = i32_at(bytes, 36);
    if num_vars <= 0 || num_vars > 4096 || buf_len <= 0 {
        return Err(IbtError::Header);
    }
    let mut vars = Vec::new();
    for index in 0..num_vars as usize {
        let start = var_off + index * VAR_HEADER_SIZE;
        if start + VAR_HEADER_SIZE > bytes.len() {
            return Err(IbtError::Header);
        }
        vars.push(Var {
            kind: i32_at(bytes, start),
            offset: i32_at(bytes, start + 4),
            name: c_string(&bytes[start + 16..start + 48]),
        });
    }
    let num_buf = i32_at(bytes, 32).clamp(1, 4) as usize;
    let mut best_tick = i32::MIN;
    let mut best_off = -1i32;
    for index in 0..num_buf {
        let base = 48 + index * 16;
        let tick = i32_at(bytes, base);
        let off = i32_at(bytes, base + 4);
        if off >= 0 && tick >= best_tick {
            best_tick = tick;
            best_off = off;
        }
    }
    let base = best_off as usize;
    if best_off < 0 || base + buf_len as usize > bytes.len() {
        return Err(IbtError::Header);
    }
    Ok(read_sample(bytes, base, &vars).sample)
}

struct Var {
    kind: i32,
    offset: i32,
    name: String,
}

struct ReadSample {
    number: i32,
    sample: Sample,
}

fn read_sample(bytes: &[u8], base: usize, vars: &[Var]) -> ReadSample {
    let value = |name: &str| -> f64 {
        let Some(var) = vars.iter().find(|var| var.name == name) else {
            return 0.0;
        };
        read_number(bytes, base, var).unwrap_or(0.0)
    };
    let number = value("Lap").round() as i32;
    let lat = optional(vars, bytes, base, "Lat");
    let lon = optional(vars, bytes, base, "Lon");
    ReadSample {
        number,
        sample: Sample {
            t: value("SessionTime"),
            dist: if vars.iter().any(|var| var.name == "LapDist") {
                value("LapDist")
            } else {
                value("LapDistPct")
            },
            speed: value("Speed"),
            throttle: value("Throttle"),
            brake: value("Brake"),
            gear: value("Gear").round() as i32,
            steering: value("SteeringWheelAngle"),
            lat,
            lon,
            vx: optional(vars, bytes, base, "VelocityX"),
            vy: optional(vars, bytes, base, "VelocityY"),
        },
    }
}

fn optional(vars: &[Var], bytes: &[u8], base: usize, name: &str) -> Option<f64> {
    let var = vars.iter().find(|var| var.name == name)?;
    read_number(bytes, base, var)
}

fn read_number(bytes: &[u8], base: usize, var: &Var) -> Option<f64> {
    if var.offset < 0 {
        return None;
    }
    let at = base + var.offset as usize;
    match var.kind {
        2 | 3 => Some(i32_at(bytes, at) as f64),
        4 => Some(f32::from_le_bytes(bytes.get(at..at + 4)?.try_into().ok()?) as f64),
        5 => Some(f64::from_le_bytes(bytes.get(at..at + 8)?.try_into().ok()?)),
        _ => None,
    }
}

fn i32_at(bytes: &[u8], offset: usize) -> i32 {
    let Some(chunk) = bytes.get(offset..offset + 4) else {
        return 0;
    };
    i32::from_le_bytes(chunk.try_into().unwrap_or([0; 4]))
}

fn c_string(bytes: &[u8]) -> String {
    let end = bytes.iter().position(|byte| *byte == 0).unwrap_or(bytes.len());
    String::from_utf8_lossy(&bytes[..end]).to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn put_i32(buf: &mut [u8], offset: usize, value: i32) {
        buf[offset..offset + 4].copy_from_slice(&value.to_le_bytes());
    }

    fn put_f32(buf: &mut [u8], offset: usize, value: f32) {
        buf[offset..offset + 4].copy_from_slice(&value.to_le_bytes());
    }

    fn var_header(kind: i32, offset: i32, name: &str) -> [u8; VAR_HEADER_SIZE] {
        let mut header = [0u8; VAR_HEADER_SIZE];
        header[0..4].copy_from_slice(&kind.to_le_bytes());
        header[4..8].copy_from_slice(&offset.to_le_bytes());
        header[8..12].copy_from_slice(&1i32.to_le_bytes());
        header[16..16 + name.len()].copy_from_slice(name.as_bytes());
        header
    }

    #[test]
    fn reads_laps_from_a_documented_header() {
        let names = [
            ("SessionTime", 4, 0),
            ("Speed", 4, 4),
            ("Throttle", 4, 8),
            ("Brake", 4, 12),
            ("Gear", 2, 16),
            ("SteeringWheelAngle", 4, 20),
            ("Lap", 2, 24),
            ("LapDist", 4, 28),
            ("Lat", 4, 32),
            ("Lon", 4, 36),
        ];
        let buf_len = 40i32;
        let var_off = HEADER_SIZE;
        let buf_off = var_off + names.len() * VAR_HEADER_SIZE;
        let samples = 4;
        let mut bytes = vec![0u8; buf_off + samples * buf_len as usize];
        put_i32(&mut bytes, 0, 2);
        put_i32(&mut bytes, 8, 60);
        put_i32(&mut bytes, 24, names.len() as i32);
        put_i32(&mut bytes, 28, var_off as i32);
        put_i32(&mut bytes, 32, 1);
        put_i32(&mut bytes, 36, buf_len);
        put_i32(&mut bytes, 52, buf_off as i32);
        for (index, (name, kind, offset)) in names.iter().enumerate() {
            let start = var_off + index * VAR_HEADER_SIZE;
            bytes[start..start + VAR_HEADER_SIZE].copy_from_slice(&var_header(*kind, *offset, name));
        }
        for sample in 0..samples {
            let at = buf_off + sample * buf_len as usize;
            let lap = if sample < 2 { 1 } else { 2 };
            put_f32(&mut bytes, at, sample as f32);
            put_f32(&mut bytes, at + 4, 40.0 + sample as f32);
            put_f32(&mut bytes, at + 8, 0.9);
            put_f32(&mut bytes, at + 12, 0.1);
            put_i32(&mut bytes, at + 16, 3);
            put_f32(&mut bytes, at + 20, 0.2);
            put_i32(&mut bytes, at + 24, lap);
            put_f32(&mut bytes, at + 28, (sample % 2) as f32 * 10.0);
            put_f32(&mut bytes, at + 32, 41.0);
            put_f32(&mut bytes, at + 36, 2.0);
        }
        let session = parse_ibt(&bytes).unwrap();
        assert_eq!(session.source, "ibt");
        assert_eq!(session.laps.len(), 2);
        assert_eq!(session.laps[0].number, 1);
        assert!((session.laps[0].samples[1].speed - 41.0).abs() < 1e-4);
        assert_eq!(session.laps[1].samples[0].gear, 3);
        assert_eq!(session.laps[0].samples[0].lat, Some(41.0));
    }

    #[test]
    fn rejects_a_file_without_the_header() {
        assert_eq!(parse_ibt(b"not a telemetry file"), Err(IbtError::Short));
    }
}
