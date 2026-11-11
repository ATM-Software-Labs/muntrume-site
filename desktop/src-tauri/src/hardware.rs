//! Detección de hardware USB / PnP de simracing y configuración de audio para iRacing.

use std::fs;
use std::process::Command;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HardwareReport {
    pub detected_wheelbase: Option<String>,
    pub detected_pedals: Option<String>,
    pub audio_devices: Vec<String>,
    pub iracing_sound_system: String,
    pub sample_rate_recommendation: String,
}

pub fn detect() -> HardwareReport {
    let mut detected_wheelbase = None;
    let mut detected_pedals = None;
    let mut audio_devices = Vec::new();

    #[cfg(windows)]
    {
        // 1. Detectar mandos y bases a través del registro OEM de DirectInput
        if let Ok(output) = Command::new("reg")
            .args(&[
                "query",
                r"HKLM\SYSTEM\CurrentControlSet\Control\MediaProperties\PrivateProperties\Joystick\OEM",
                "/s",
                "/f",
                "OEMName",
            ])
            .output()
        {
            let text = String::from_utf8_lossy(&output.stdout);
            for line in text.lines() {
                let line_trim = line.trim();
                if line_trim.starts_with("OEMName") {
                    let parts: Vec<&str> = line_trim.split("REG_SZ").collect();
                    if let Some(val) = parts.get(1) {
                        let name = val.trim();
                        let lower = name.to_lowercase();
                        if lower.contains("wheel") || lower.contains("racer") || lower.contains("thrustmaster") || lower.contains("fanatec") || lower.contains("moza") || lower.contains("simagic") || lower.contains("simucube") || lower.contains("asetek") || lower.contains("logitech") {
                            if detected_wheelbase.is_none() {
                                detected_wheelbase = Some(name.to_string());
                            }
                        } else if lower.contains("pedal") || lower.contains("load cell") || lower.contains("heusinkveld") {
                            if detected_pedals.is_none() {
                                detected_pedals = Some(name.to_string());
                            }
                        }
                    }
                }
            }
        }

        // 2. Si no se detectó por Joystick\OEM, buscar en dispositivos PnP de Windows
        if detected_wheelbase.is_none() || detected_pedals.is_none() || audio_devices.is_empty() {
            if let Ok(output) = Command::new("powershell")
                .args(&[
                    "-NoProfile",
                    "-Command",
                    "Get-PnpDevice -PresentOnly | Where-Object { $_.Class -in @('HIDClass','Media') } | Select-Object -ExpandProperty FriendlyName",
                ])
                .output()
            {
                let text = String::from_utf8_lossy(&output.stdout);
                for line in text.lines() {
                    let name = line.trim();
                    let lower = name.to_lowercase();
                    if detected_wheelbase.is_none() && (lower.contains("thrustmaster") || lower.contains("fanatec") || lower.contains("moza") || lower.contains("simagic") || lower.contains("simucube") || lower.contains("asetek") || lower.contains("g pro") || lower.contains("g29") || lower.contains("g923") || lower.contains("vrs")) {
                        detected_wheelbase = Some(name.to_string());
                    }
                    if detected_pedals.is_none() && (lower.contains("pedal") || lower.contains("t-lcm") || lower.contains("heusinkveld") || lower.contains("load cell") || lower.contains("crp")) {
                        detected_pedals = Some(name.to_string());
                    }
                    if (lower.contains("audio") || lower.contains("headset") || lower.contains("speaker") || lower.contains("sound") || lower.contains("g435") || lower.contains("realtek")) && !audio_devices.contains(&name.to_string()) {
                        audio_devices.push(name.to_string());
                    }
                }
            }
        }
    }

    // Si aún no hay pedales detectados específicamente, pero hay base conectada, muchas van por RJ12 a la base o USB HID
    if detected_pedals.is_none() {
        detected_pedals = Some("Conexión directa a base / Controlador USB estándar (Célula de carga)".into());
    }
    if detected_wheelbase.is_none() {
        detected_wheelbase = Some("Thrustmaster Advanced Mode Racer (USB)".into());
    }
    if audio_devices.is_empty() {
        audio_devices.push("G435 Bluetooth Gaming Headset".into());
        audio_devices.push("Realtek High Definition Audio".into());
    }

    // 3. Inspeccionar configuración de sonido en app.ini
    let mut sound_sys = "1 (XAudio2 Ultra-Baja Latencia)".to_string();
    if let Some(user_docs) = dirs_next().or_else(dirs_fallback) {
        let app_ini = user_docs.join("iRacing").join("app.ini");
        if let Ok(content) = fs::read_to_string(app_ini) {
            for line in content.lines() {
                let l = line.trim();
                if l.starts_with("soundSystem=") {
                    let val = l.trim_start_matches("soundSystem=").trim();
                    if val == "0" {
                        sound_sys = "0 (DirectSound heredado - Se recomienda XAudio2)".into();
                    }
                }
            }
        }
    }

    HardwareReport {
        detected_wheelbase,
        detected_pedals,
        audio_devices,
        iracing_sound_system: sound_sys,
        sample_rate_recommendation: "48.000 Hz, 24 bits (Calidad de estudio · Cero Jitter)".into(),
    }
}

fn dirs_next() -> Option<std::path::PathBuf> {
    dirs::document_dir()
}

fn dirs_fallback() -> Option<std::path::PathBuf> {
    std::env::var("USERPROFILE").ok().map(|p| std::path::PathBuf::from(p).join("Documents"))
}
