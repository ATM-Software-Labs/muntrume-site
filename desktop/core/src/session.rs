//! Vueltas, comparación y el paquete que se puede subir (JSON comprimido, nunca el .ibt entero).

use flate2::write::GzEncoder;
use flate2::Compression;
use serde::{Deserialize, Serialize};
use std::io::Write;
use thiserror::Error;

pub const MAX_REFERENCE_BYTES: usize = 2 * 1024 * 1024;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Sample {
    pub t: f64,
    pub dist: f64,
    pub speed: f64,
    pub throttle: f64,
    pub brake: f64,
    pub gear: i32,
    pub steering: f64,
    pub lat: Option<f64>,
    pub lon: Option<f64>,
    pub vx: Option<f64>,
    pub vy: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Lap {
    pub number: i32,
    pub samples: Vec<Sample>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Session {
    /// `ibt` si sale de un archivo local, `synthetic` si es una traza generada para la interfaz.
    pub source: String,
    pub laps: Vec<Lap>,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Compared {
    pub distance: Vec<f64>,
    pub delta: Vec<f64>,
    pub speed_a: Vec<f64>,
    pub speed_b: Vec<f64>,
    pub throttle_a: Vec<f64>,
    pub throttle_b: Vec<f64>,
    pub brake_a: Vec<f64>,
    pub brake_b: Vec<f64>,
    pub gear_a: Vec<i32>,
    pub gear_b: Vec<i32>,
    pub steering_a: Vec<f64>,
    pub steering_b: Vec<f64>,
    pub map_a: Vec<[f64; 2]>,
    pub map_b: Vec<[f64; 2]>,
}

#[derive(Debug, Clone, Copy)]
pub struct FuelInput {
    pub race_minutes: f64,
    pub lap_seconds: f64,
    pub fuel_per_lap: f64,
    pub tank_liters: f64,
    pub fuel_now: f64,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub struct FuelPlan {
    pub race_laps: f64,
    pub stint_laps: f64,
    pub fuel_to_finish: f64,
    pub laps_left: f64,
    pub stops: u32,
    pub fuel_to_add: f64,
}

#[derive(Debug, Error, PartialEq, Eq)]
pub enum PackError {
    #[error("la vuelta no tiene muestras")]
    Empty,
    #[error("el paquete pesa {0} bytes y el límite es 2 MB")]
    TooBig(usize),
    #[error("no se pudo comprimir la vuelta")]
    Encode,
}

pub fn fuel_plan(input: FuelInput) -> Result<FuelPlan, &'static str> {
    if input.race_minutes <= 0.0 || input.lap_seconds <= 0.0 || input.fuel_per_lap <= 0.0 || input.tank_liters <= 0.0
    {
        return Err("los tiempos y el combustible tienen que ser mayores que cero");
    }
    if input.fuel_now < 0.0 {
        return Err("el combustible a bordo no puede ser negativo");
    }
    let race_laps = input.race_minutes * 60.0 / input.lap_seconds;
    let fuel_to_finish = race_laps * input.fuel_per_lap;
    let stint_laps = input.tank_liters / input.fuel_per_lap;
    let laps_left = input.fuel_now / input.fuel_per_lap;
    let deficit = (fuel_to_finish - input.fuel_now).max(0.0);
    let stops = if deficit <= 0.0 {
        0
    } else {
        (deficit / input.tank_liters).ceil() as u32
    };
    let fuel_to_add = deficit.min(input.tank_liters);
    Ok(FuelPlan {
        race_laps,
        stint_laps,
        fuel_to_finish,
        laps_left,
        stops,
        fuel_to_add,
    })
}

pub fn track_xy(samples: &[Sample]) -> Vec<[f64; 2]> {
    let has_geo = samples.iter().any(|sample| sample.lat.is_some() && sample.lon.is_some());
    if has_geo {
        return samples
            .iter()
            .filter_map(|sample| Some([sample.lon?, sample.lat?]))
            .collect();
    }
    let mut x = 0.0;
    let mut y = 0.0;
    let mut prev = samples.first().map(|sample| sample.t).unwrap_or(0.0);
    let mut out = Vec::with_capacity(samples.len());
    for sample in samples {
        let dt = (sample.t - prev).max(0.0);
        if let (Some(vx), Some(vy)) = (sample.vx, sample.vy) {
            x += vx * dt;
            y += vy * dt;
        }
        prev = sample.t;
        out.push([x, y]);
    }
    out
}

pub fn compare_laps(reference: &Lap, other: &Lap) -> Result<Compared, &'static str> {
    if reference.samples.len() < 2 || other.samples.len() < 2 {
        return Err("hacen falta al menos dos muestras en cada vuelta");
    }
    let end = reference
        .samples
        .last()
        .unwrap()
        .dist
        .min(other.samples.last().unwrap().dist);
    if end <= 0.0 {
        return Err("la distancia de la vuelta no es válida");
    }
    let steps = 120;
    let mut compared = Compared {
        distance: Vec::with_capacity(steps),
        delta: Vec::with_capacity(steps),
        speed_a: Vec::with_capacity(steps),
        speed_b: Vec::with_capacity(steps),
        throttle_a: Vec::with_capacity(steps),
        throttle_b: Vec::with_capacity(steps),
        brake_a: Vec::with_capacity(steps),
        brake_b: Vec::with_capacity(steps),
        gear_a: Vec::with_capacity(steps),
        gear_b: Vec::with_capacity(steps),
        steering_a: Vec::with_capacity(steps),
        steering_b: Vec::with_capacity(steps),
        map_a: track_xy(&reference.samples),
        map_b: track_xy(&other.samples),
    };
    let t0_a = reference.samples[0].t;
    let t0_b = other.samples[0].t;
    for step in 0..steps {
        let dist = end * (step as f64) / (steps as f64 - 1.0);
        let a = at_dist(&reference.samples, dist);
        let b = at_dist(&other.samples, dist);
        compared.distance.push(dist);
        compared.delta.push((b.t - t0_b) - (a.t - t0_a));
        compared.speed_a.push(a.speed);
        compared.speed_b.push(b.speed);
        compared.throttle_a.push(a.throttle);
        compared.throttle_b.push(b.throttle);
        compared.brake_a.push(a.brake);
        compared.brake_b.push(b.brake);
        compared.gear_a.push(a.gear);
        compared.gear_b.push(b.gear);
        compared.steering_a.push(a.steering);
        compared.steering_b.push(b.steering);
    }
    Ok(compared)
}

fn at_dist(samples: &[Sample], dist: f64) -> Sample {
    let mut prev = &samples[0];
    for sample in samples {
        if sample.dist >= dist {
            let span = sample.dist - prev.dist;
            if span <= f64::EPSILON {
                return sample.clone();
            }
            let mix = ((dist - prev.dist) / span).clamp(0.0, 1.0);
            return blend(prev, sample, mix);
        }
        prev = sample;
    }
    samples.last().unwrap().clone()
}

fn blend(a: &Sample, b: &Sample, mix: f64) -> Sample {
    let lerp = |left: f64, right: f64| left + (right - left) * mix;
    Sample {
        t: lerp(a.t, b.t),
        dist: lerp(a.dist, b.dist),
        speed: lerp(a.speed, b.speed),
        throttle: lerp(a.throttle, b.throttle),
        brake: lerp(a.brake, b.brake),
        gear: if mix < 0.5 { a.gear } else { b.gear },
        steering: lerp(a.steering, b.steering),
        lat: match (a.lat, b.lat) {
            (Some(left), Some(right)) => Some(lerp(left, right)),
            _ => None,
        },
        lon: match (a.lon, b.lon) {
            (Some(left), Some(right)) => Some(lerp(left, right)),
            _ => None,
        },
        vx: None,
        vy: None,
    }
}

pub fn pack_reference_lap(lap: &Lap) -> Result<Vec<u8>, PackError> {
    if lap.samples.is_empty() {
        return Err(PackError::Empty);
    }
    let json = serde_json::to_vec(lap).map_err(|_| PackError::Encode)?;
    let mut encoder = GzEncoder::new(Vec::new(), Compression::default());
    encoder.write_all(&json).map_err(|_| PackError::Encode)?;
    let packed = encoder.finish().map_err(|_| PackError::Encode)?;
    if packed.len() > MAX_REFERENCE_BYTES {
        return Err(PackError::TooBig(packed.len()));
    }
    Ok(packed)
}

/// Circuito circular generado. No es una sesión de iRacing.
pub fn synthetic_session() -> Session {
    let mut laps = Vec::new();
    for number in 1..=2 {
        let mut samples = Vec::new();
        let scale = if number == 1 { 1.0 } else { 0.96 };
        for step in 0..80 {
            let u = step as f64 / 79.0;
            let angle = u * std::f64::consts::TAU;
            samples.push(Sample {
                t: number as f64 * 100.0 + u * 90.0 / scale,
                dist: u * 1000.0,
                speed: 50.0 * scale,
                throttle: if u < 0.7 { 1.0 } else { 0.4 },
                brake: if u > 0.8 { 0.8 } else { 0.0 },
                gear: 4,
                steering: (angle.sin() * 0.4 * scale),
                lat: Some(41.5 + angle.sin() * 0.002),
                lon: Some(2.1 + angle.cos() * 0.002),
                vx: None,
                vy: None,
            });
        }
        laps.push(Lap { number, samples });
    }
    Session {
        source: "synthetic".into(),
        laps,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn fuel_plan_counts_one_stop_and_the_litres_to_add() {
        let plan = fuel_plan(FuelInput {
            race_minutes: 60.0,
            lap_seconds: 120.0,
            fuel_per_lap: 2.0,
            tank_liters: 40.0,
            fuel_now: 40.0,
        })
        .unwrap();
        assert!((plan.race_laps - 30.0).abs() < 1e-9);
        assert!((plan.fuel_to_finish - 60.0).abs() < 1e-9);
        assert_eq!(plan.stops, 1);
        assert!((plan.fuel_to_add - 20.0).abs() < 1e-9);
        assert!((plan.laps_left - 20.0).abs() < 1e-9);
    }

    #[test]
    fn delta_is_positive_when_the_other_lap_is_slower() {
        let session = synthetic_session();
        let compared = compare_laps(&session.laps[0], &session.laps[1]).unwrap();
        assert!(compared.delta.last().unwrap() > &0.0);
        assert_eq!(compared.map_a.len(), 80);
        assert!(compared.map_a.iter().any(|point| point[0] != 0.0));
    }

    #[test]
    fn velocity_integration_moves_the_trace_without_coordinates() {
        let samples = vec![
            Sample {
                t: 0.0,
                dist: 0.0,
                speed: 0.0,
                throttle: 0.0,
                brake: 0.0,
                gear: 1,
                steering: 0.0,
                lat: None,
                lon: None,
                vx: Some(10.0),
                vy: Some(0.0),
            },
            Sample {
                t: 2.0,
                dist: 20.0,
                speed: 10.0,
                throttle: 1.0,
                brake: 0.0,
                gear: 1,
                steering: 0.0,
                lat: None,
                lon: None,
                vx: Some(10.0),
                vy: Some(0.0),
            },
        ];
        let map = track_xy(&samples);
        assert!((map[1][0] - 20.0).abs() < 1e-9);
    }

    #[test]
    fn a_normal_lap_packs_under_two_megabytes_and_an_empty_one_does_not() {
        let lap = synthetic_session().laps.remove(0);
        let packed = pack_reference_lap(&lap).unwrap();
        assert!(packed.len() < MAX_REFERENCE_BYTES);
        assert!(packed.len() < 20_000);
        assert_eq!(pack_reference_lap(&Lap { number: 1, samples: vec![] }), Err(PackError::Empty));
    }
}
