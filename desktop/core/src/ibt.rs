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
    #[error("la versión de la cabecera no es 2")]
    Version,
    #[error("el simulador no está conectado")]
    NotConnected,
    #[error("lectura a medias: el tick cambió durante la copia")]
    Torn,
    #[error("la tabla de variables es de otra sesión")]
    StaleVars,
    #[error("el .ibt no trae las variables de una vuelta")]
    Variables,
}

const HEADER_VERSION: i32 = 2;
const STATUS_CONNECTED: i32 = 1;
const VARBUF_STRIDE: usize = 16;
const VARBUF_OFFSET: usize = 48;

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

/// Tabla de variables resuelta una vez por `sessionInfoUpdate`.
#[derive(Clone)]
pub struct VarTable {
    update: i32,
    vars: Vec<Var>,
}

impl VarTable {
    pub fn session_info_update(&self) -> i32 {
        self.update
    }
}

/// `sessionInfoUpdate` de la cabecera. Cambia cuando hay que volver a resolver offsets.
pub fn session_info_update(bytes: &[u8]) -> Result<i32, IbtError> {
    validate_live_header(bytes)?;
    Ok(i32_at(bytes, 12))
}

/// Resuelve nombre y tipo a offset. Hay que repetirlo si `sessionInfoUpdate` cambia.
pub fn resolve_var_table(bytes: &[u8]) -> Result<VarTable, IbtError> {
    validate_live_header(bytes)?;
    let update = i32_at(bytes, 12);
    let vars = parse_vars(bytes)?;
    if i32_at(bytes, 12) != update {
        return Err(IbtError::Torn);
    }
    Ok(VarTable { update, vars })
}

/// Lee la muestra más nueva: versión 2, bit conectado, copia del buffer y relectura del tick.
pub fn read_live_sample(bytes: &[u8]) -> Result<Sample, IbtError> {
    let table = resolve_var_table(bytes)?;
    read_live_sample_with(bytes, &table)
}

pub fn read_live_sample_with(bytes: &[u8], table: &VarTable) -> Result<Sample, IbtError> {
    validate_live_header(bytes)?;
    if i32_at(bytes, 12) != table.update {
        return Err(IbtError::StaleVars);
    }
    let copy = copy_latest(bytes)?;
    Ok(read_sample(&copy, 0, &table.vars).sample)
}

fn validate_live_header(bytes: &[u8]) -> Result<(), IbtError> {
    if bytes.len() < HEADER_SIZE {
        return Err(IbtError::Short);
    }
    if i32_at(bytes, 0) != HEADER_VERSION {
        return Err(IbtError::Version);
    }
    if i32_at(bytes, 4) & STATUS_CONNECTED == 0 {
        return Err(IbtError::NotConnected);
    }
    let num_buf = i32_at(bytes, 32);
    let buf_len = i32_at(bytes, 36);
    if !(1..=4).contains(&num_buf) || buf_len <= 0 || buf_len > 1_000_000 {
        return Err(IbtError::Header);
    }
    Ok(())
}

fn parse_vars(bytes: &[u8]) -> Result<Vec<Var>, IbtError> {
    let num_vars = i32_at(bytes, 24);
    let var_off = i32_at(bytes, 28);
    if num_vars <= 0 || num_vars > 4096 || var_off < 0 {
        return Err(IbtError::Header);
    }
    let var_off = var_off as usize;
    let mut vars = Vec::with_capacity(num_vars as usize);
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
    Ok(vars)
}

struct BufPick {
    index: usize,
    tick: i32,
    offset: usize,
    len: usize,
}

fn newest_buffer(bytes: &[u8]) -> Result<BufPick, IbtError> {
    validate_live_header(bytes)?;
    let num_buf = i32_at(bytes, 32) as usize;
    let len = i32_at(bytes, 36) as usize;
    let mut best: Option<BufPick> = None;
    for index in 0..num_buf {
        let base = VARBUF_OFFSET + index * VARBUF_STRIDE;
        let tick = i32_at(bytes, base);
        let off = i32_at(bytes, base + 4);
        if off < 0 {
            continue;
        }
        let offset = off as usize;
        if offset.saturating_add(len) > bytes.len() {
            continue;
        }
        let newer = best.as_ref().map(|pick| tick >= pick.tick).unwrap_or(true);
        if newer {
            best = Some(BufPick { index, tick, offset, len });
        }
    }
    best.ok_or(IbtError::Header)
}

/// Copia el buffer y descarta la copia si el tick de ese slot cambió.
fn copy_if_stable(bytes: &[u8], pick: &BufPick) -> Result<Vec<u8>, IbtError> {
    let end = pick.offset + pick.len;
    let copy = bytes.get(pick.offset..end).ok_or(IbtError::Header)?.to_vec();
    let tick_now = i32_at(bytes, VARBUF_OFFSET + pick.index * VARBUF_STRIDE);
    if tick_now != pick.tick {
        return Err(IbtError::Torn);
    }
    Ok(copy)
}

fn copy_latest(bytes: &[u8]) -> Result<Vec<u8>, IbtError> {
    for _ in 0..4 {
        let pick = newest_buffer(bytes)?;
        if let Ok(copy) = copy_if_stable(bytes, &pick) {
            return Ok(copy);
        }
    }
    Err(IbtError::Torn)
}

#[derive(Clone)]
struct Var {
    kind: i32,
    offset: i32,
    name: String,
}

struct ReadSample {
    number: i32,
    sample: Sample,
}

fn find_var<'a>(vars: &'a [Var], name: &str, kinds: &[i32]) -> Option<&'a Var> {
    vars.iter().find(|var| var.name == name && kinds.contains(&var.kind))
}

fn read_sample(bytes: &[u8], base: usize, vars: &[Var]) -> ReadSample {
    let value = |name: &str, kinds: &[i32]| -> f64 {
        let Some(var) = find_var(vars, name, kinds) else {
            return 0.0;
        };
        read_number(bytes, base, var).unwrap_or(0.0)
    };
    let float_kinds = [4, 5];
    let int_kinds = [2];
    let number = value("Lap", &int_kinds).round() as i32;
    let lat = optional(vars, bytes, base, "Lat");
    let lon = optional(vars, bytes, base, "Lon");
    ReadSample {
        number,
        sample: Sample {
            t: value("SessionTime", &float_kinds),
            dist: if find_var(vars, "LapDist", &float_kinds).is_some() {
                value("LapDist", &float_kinds)
            } else {
                value("LapDistPct", &float_kinds)
            },
            speed: value("Speed", &float_kinds),
            throttle: value("Throttle", &float_kinds),
            brake: value("Brake", &float_kinds),
            gear: value("Gear", &int_kinds).round() as i32,
            steering: value("SteeringWheelAngle", &float_kinds),
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

    fn live_image(speed_old: f32, tick_old: i32, speed_new: f32, tick_new: i32) -> Vec<u8> {
        let names = [
            ("SessionTime", 4, 0),
            ("Speed", 4, 4),
            ("Throttle", 4, 8),
            ("Brake", 4, 12),
            ("Gear", 2, 16),
            ("SteeringWheelAngle", 4, 20),
            ("Lap", 2, 24),
            ("LapDist", 4, 28),
        ];
        let buf_len = 32i32;
        let var_off = HEADER_SIZE;
        let buf0 = var_off + names.len() * VAR_HEADER_SIZE;
        let buf1 = buf0 + buf_len as usize;
        let mut bytes = vec![0u8; buf1 + buf_len as usize];
        put_i32(&mut bytes, 0, 2);
        put_i32(&mut bytes, 4, 1);
        put_i32(&mut bytes, 8, 60);
        put_i32(&mut bytes, 12, 7);
        put_i32(&mut bytes, 24, names.len() as i32);
        put_i32(&mut bytes, 28, var_off as i32);
        put_i32(&mut bytes, 32, 2);
        put_i32(&mut bytes, 36, buf_len);
        put_i32(&mut bytes, 48, tick_old);
        put_i32(&mut bytes, 52, buf0 as i32);
        put_i32(&mut bytes, 64, tick_new);
        put_i32(&mut bytes, 68, buf1 as i32);
        for (index, (name, kind, offset)) in names.iter().enumerate() {
            let start = var_off + index * VAR_HEADER_SIZE;
            bytes[start..start + VAR_HEADER_SIZE].copy_from_slice(&var_header(*kind, *offset, name));
        }
        put_f32(&mut bytes, buf0 + 4, speed_old);
        put_i32(&mut bytes, buf0 + 16, 2);
        put_i32(&mut bytes, buf0 + 24, 1);
        put_f32(&mut bytes, buf1 + 4, speed_new);
        put_i32(&mut bytes, buf1 + 16, 4);
        put_i32(&mut bytes, buf1 + 24, 3);
        bytes
    }

    #[test]
    fn live_sample_uses_the_newest_tick_not_the_older_buffer() {
        let bytes = live_image(10.0, 1, 50.0, 9);
        let sample = read_live_sample(&bytes).unwrap();
        assert!((sample.speed - 50.0).abs() < 1e-4);
        assert_eq!(sample.gear, 4);
    }

    #[test]
    fn torn_copy_is_discarded_when_the_tick_moves() {
        let mut bytes = live_image(10.0, 1, 50.0, 9);
        let pick = newest_buffer(&bytes).unwrap();
        assert_eq!(pick.tick, 9);
        assert_eq!(pick.index, 1);
        put_i32(&mut bytes, 64, 10);
        assert_eq!(copy_if_stable(&bytes, &pick), Err(IbtError::Torn));
        let again = newest_buffer(&bytes).unwrap();
        let copy = copy_if_stable(&bytes, &again).unwrap();
        assert_eq!(copy.len(), 32);
    }

    #[test]
    fn live_header_requires_version_2_and_the_connected_bit() {
        let mut bytes = live_image(10.0, 1, 50.0, 9);
        put_i32(&mut bytes, 0, 1);
        assert_eq!(read_live_sample(&bytes), Err(IbtError::Version));
        put_i32(&mut bytes, 0, 2);
        put_i32(&mut bytes, 4, 0);
        assert_eq!(read_live_sample(&bytes), Err(IbtError::NotConnected));
    }

    #[test]
    fn speed_lookup_requires_a_float_not_just_the_name() {
        let mut bytes = live_image(10.0, 1, 50.0, 9);
        let var_off = HEADER_SIZE;
        bytes[var_off + VAR_HEADER_SIZE..var_off + 2 * VAR_HEADER_SIZE]
            .copy_from_slice(&var_header(2, 4, "Speed"));
        let sample = read_live_sample(&bytes).unwrap();
        assert_eq!(sample.speed, 0.0);
    }

    #[test]
    fn a_new_session_info_update_invalidates_the_cached_table() {
        let bytes = live_image(10.0, 1, 50.0, 9);
        let table = resolve_var_table(&bytes).unwrap();
        assert_eq!(table.session_info_update(), 7);
        let mut moved = bytes.clone();
        put_i32(&mut moved, 12, 8);
        assert_eq!(read_live_sample_with(&moved, &table), Err(IbtError::StaleVars));
        let fresh = resolve_var_table(&moved).unwrap();
        assert_eq!(fresh.session_info_update(), 8);
        assert!((read_live_sample_with(&moved, &fresh).unwrap().speed - 50.0).abs() < 1e-4);
    }
}
