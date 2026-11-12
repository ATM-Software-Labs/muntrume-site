//! Detección universal de hardware USB / DirectInput y configuración de audio para iRacing.

use std::fs;
use std::path::Path;
#[cfg(windows)]
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
    pub wheelbase_brand: Option<String>,
    pub software_status: String,
    pub firmware_recommendation: String,
}

pub fn detect() -> HardwareReport {
    #[cfg_attr(not(windows), allow(unused_mut))]
    let mut detected_wheelbase: Option<String> = None;
    #[cfg_attr(not(windows), allow(unused_mut))]
    let mut detected_pedals: Option<String> = None;
    #[cfg_attr(not(windows), allow(unused_mut))]
    let mut audio_devices: Vec<String> = Vec::new();
    #[cfg_attr(not(windows), allow(unused_mut))]
    let mut wheelbase_brand: Option<String> = None;

    #[cfg(windows)]
    {
        // 1. Detección en registros de DirectInput OEM (HKCU y HKLM)
        for hive in &[
            r"HKCU\System\CurrentControlSet\Control\MediaProperties\PrivateProperties\Joystick\OEM",
            r"HKLM\SYSTEM\CurrentControlSet\Control\MediaProperties\PrivateProperties\Joystick\OEM",
        ] {
            if let Ok(output) = Command::new("reg")
                .args(&["query", hive, "/s", "/f", "OEMName"])
                .output()
            {
                let text = String::from_utf8_lossy(&output.stdout);
                for line in text.lines() {
                    let line_trim = line.trim();
                    if line_trim.starts_with("OEMName") {
                        let parts: Vec<&str> = line_trim.split("REG_SZ").collect();
                        if let Some(val) = parts.get(1) {
                            let name = val.trim();
                            classify_device(name, &mut detected_wheelbase, &mut detected_pedals, &mut wheelbase_brand);
                        }
                    }
                }
            }
        }

        // 2. Detección a través de dispositivos PnP de Windows
        if let Ok(output) = Command::new("powershell")
            .args(&[
                "-NoProfile",
                "-Command",
                "Get-PnpDevice -PresentOnly | Where-Object Class -in @('HIDClass','Media','USB') | Select-Object -ExpandProperty FriendlyName",
            ])
            .output()
        {
            let text = String::from_utf8_lossy(&output.stdout);
            for line in text.lines() {
                let name = line.trim();
                if name.is_empty() {
                    continue;
                }
                classify_device(name, &mut detected_wheelbase, &mut detected_pedals, &mut wheelbase_brand);

                let lower = name.to_lowercase();
                if (lower.contains("audio") || lower.contains("headset") || lower.contains("speaker") || lower.contains("sound") || lower.contains("mic") || lower.contains("realtek") || lower.contains("g435") || lower.contains("trust"))
                    && !lower.contains("virtual")
                    && !lower.contains("controller")
                    && !audio_devices.iter().any(|d| d.eq_ignore_ascii_case(name))
                {
                    audio_devices.push(name.to_string());
                }
            }
        }
    }

    // 3. Inspección del software de gestión instalado en el sistema
    let mut installed_suites = Vec::new();

    let check_paths = [
        ("Thrustmaster Control Panel", r"C:\Program Files\Thrustmaster\FFB Racing wheel\drivers\tmJoycpl.exe", "thrustmaster", "v34+ (2024_TTRS_1)"),
        ("Simagic SimPro Manager", r"C:\Program Files (x86)\simpro\bin\simpro.exe", "simagic", "SimPro 2.0+ (Firmware v2.x)"),
        ("Fanatec Control Panel", r"C:\Program Files\Fanatec\Fanatec Control Panel\FanatecControlPanel.exe", "fanatec", "Driver v455+ / FanaLab v2.01"),
        ("Moza Pit House", r"C:\Program Files\MOZA Pit House\MOZA Pit House.exe", "moza", "Pit House v1.2.9+ / v1.3"),
        ("Asetek RaceHub", r"C:\Program Files\Asetek\RaceHub\RaceHub.exe", "asetek", "RaceHub v2.4+"),
        ("Simucube TrueDrive", r"C:\Program Files\Simucube\TrueDrive\TrueDrive.exe", "simucube", "TrueDrive v2024.1+"),
        ("Logitech G HUB", r"C:\Program Files\LGHUB\lghub.exe", "logitech", "G HUB 2024.x"),
        ("Heusinkveld SmartControl", r"C:\Program Files\Heusinkveld SmartControl\SmartControl.exe", "heusinkveld", "SmartControl v1.4+"),
    ];

    let mut fw_rec = String::from("Drivers y firmware oficiales recomendados al día.");

    for (suite_name, exe_path, brand_id, fw_target) in check_paths {
        if Path::new(exe_path).exists() {
            installed_suites.push(format!("{suite_name} (Instalado)"));
            if wheelbase_brand.is_none() {
                wheelbase_brand = Some(brand_id.to_string());
            }
            fw_rec = format!("Software oficial detectado: {suite_name}. Versión de firmware recomendada: {fw_target}.");
        }
    }

    let software_status = if installed_suites.is_empty() {
        "Sin suite de fabricante detectada en Program Files".into()
    } else {
        installed_suites.join(" · ")
    };

    // 4. Inspección de app.ini para sonido
    let mut sound_sys = "1 (XAudio2 Ultra-Baja Latencia)".to_string();
    if let Some(user_docs) = get_documents_dir() {
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
        wheelbase_brand,
        software_status,
        firmware_recommendation: fw_rec,
    }
}

#[cfg(windows)]
fn classify_device(
    name: &str,
    wheelbase: &mut Option<String>,
    pedals: &mut Option<String>,
    brand: &mut Option<String>,
) {
    let lower = name.to_lowercase();

    // Wheelbase identification across all brands
    let is_wheel = lower.contains("wheel")
        || lower.contains("racer")
        || lower.contains("base")
        || lower.contains("thrustmaster")
        || lower.contains("fanatec")
        || lower.contains("moza")
        || lower.contains("simagic")
        || lower.contains("simucube")
        || lower.contains("asetek")
        || lower.contains("vrs directforce")
        || lower.contains("g29")
        || lower.contains("g920")
        || lower.contains("g923")
        || lower.contains("g pro racing wheel");

    let is_pedal = lower.contains("pedal")
        || lower.contains("t-lcm")
        || lower.contains("heusinkveld")
        || lower.contains("load cell")
        || lower.contains("crp")
        || lower.contains("srp");

    if is_wheel && !is_pedal && wheelbase.is_none() {
        *wheelbase = Some(name.to_string());
        if lower.contains("thrustmaster") {
            *brand = Some("thrustmaster".into());
        } else if lower.contains("fanatec") {
            *brand = Some("fanatec".into());
        } else if lower.contains("moza") {
            *brand = Some("moza".into());
        } else if lower.contains("simagic") {
            *brand = Some("simagic".into());
        } else if lower.contains("simucube") {
            *brand = Some("simucube".into());
        } else if lower.contains("asetek") {
            *brand = Some("asetek".into());
        } else if lower.contains("logitech") || lower.contains("g29") || lower.contains("g923") || lower.contains("g pro") {
            *brand = Some("logitech".into());
        } else if lower.contains("vrs") {
            *brand = Some("vrs".into());
        }
    }

    if is_pedal && pedals.is_none() {
        *pedals = Some(name.to_string());
    }
}

fn get_documents_dir() -> Option<std::path::PathBuf> {
    #[cfg(windows)]
    {
        if let Some(docs) = known_folders::get_known_folder_path(known_folders::KnownFolder::Documents) {
            return Some(docs);
        }
    }
    std::env::var("USERPROFILE").ok().map(|p| std::path::PathBuf::from(p).join("Documents"))
}
