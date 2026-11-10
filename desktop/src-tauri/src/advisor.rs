//! Analizador de configuración de iRacing y recomendaciones de competición.
//! Lee app.ini y rendererDX11*.ini sin modificarlos (solo lectura).

use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConfigItem {
    pub key: String,
    pub section: String,
    pub current_value: String,
    pub recommended_value: String,
    pub status: String,
    pub title: String,
    pub explanation: String,
    pub category: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IracingAnalysis {
    pub found: bool,
    pub iracing_dir: String,
    pub score: u32,
    pub optimal_count: usize,
    pub recommended_count: usize,
    pub warning_count: usize,
    pub items: Vec<ConfigItem>,
}

fn parse_ini(content: &str) -> HashMap<String, HashMap<String, String>> {
    let mut sections = HashMap::new();
    let mut current_section = String::new();

    for line in content.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.starts_with(';') || trimmed.starts_with('#') {
            continue;
        }
        if trimmed.starts_with('[') && trimmed.ends_with(']') {
            current_section = trimmed[1..trimmed.len() - 1].trim().to_string();
            sections.entry(current_section.clone()).or_insert_with(HashMap::new);
            continue;
        }
        if let Some((key, val_part)) = trimmed.split_once('=') {
            let key = key.trim().to_string();
            let val = val_part.split(';').next().unwrap_or("").trim().to_string();
            sections
                .entry(current_section.clone())
                .or_insert_with(HashMap::new)
                .insert(key, val);
        }
    }
    sections
}

pub fn analyze() -> IracingAnalysis {
    let settings = crate::settings::load().ok();
    let setups_dir = settings.and_then(|s| {
        let p = PathBuf::from(s.setups_dir);
        if p.is_dir() {
            Some(p)
        } else {
            None
        }
    });

    let mut candidate_paths = Vec::new();
    if let Some(ref p) = setups_dir {
        if let Some(parent) = p.parent() {
            candidate_paths.push(parent.to_path_buf());
        }
    }
    if let Some(p) = crate::folders::detect_setups_dir().and_then(|p| p.parent().map(|p| p.to_path_buf())) {
        candidate_paths.push(p);
    }
    if let Ok(profile) = std::env::var("USERPROFILE") {
        let p = PathBuf::from(&profile);
        candidate_paths.push(p.join("Documents").join("iRacing"));
        candidate_paths.push(p.join("Documentos").join("iRacing"));
        candidate_paths.push(p.join("OneDrive").join("Documents").join("iRacing"));
        candidate_paths.push(p.join("OneDrive").join("Documentos").join("iRacing"));
    }

    let iracing_path = candidate_paths
        .into_iter()
        .find(|p| p.join("app.ini").is_file())
        .or_else(|| setups_dir.and_then(|p| p.parent().map(|p| p.to_path_buf())));

    let Some(iracing_path) = iracing_path else {
        return mock_analysis(false, "Carpeta de iRacing no encontrada");
    };

    let app_ini_path = iracing_path.join("app.ini");
    let app_content = fs::read_to_string(&app_ini_path).unwrap_or_default();

    let mut renderer_content = fs::read_to_string(iracing_path.join("rendererDX11Monitor.ini"))
        .or_else(|_| fs::read_to_string(iracing_path.join("rendererDX11.ini")))
        .unwrap_or_default();

    if renderer_content.is_empty() {
        if let Ok(entries) = fs::read_dir(&iracing_path) {
            for entry in entries.flatten() {
                let name = entry.file_name().to_string_lossy().to_ascii_lowercase();
                if name.starts_with("rendererdx11") && name.ends_with(".ini") {
                    if let Ok(c) = fs::read_to_string(entry.path()) {
                        if !c.is_empty() {
                            renderer_content = c;
                            break;
                        }
                    }
                }
            }
        }
    }

    if app_content.is_empty() && renderer_content.is_empty() {
        return mock_analysis(false, &iracing_path.display().to_string());
    }

    let app_ini = parse_ini(&app_content);
    let rend_ini = parse_ini(&renderer_content);

    let mut items = Vec::new();

    // 1. FFB: 360Hz Interpolation
    let ffb_sec = app_ini.get("Force Feedback");
    let val_360 = ffb_sec.and_then(|s| s.get("enableFFB360HzInterpolated")).map(|s| s.as_str()).unwrap_or("0");
    if val_360 == "1" {
        items.push(ConfigItem {
            key: "enableFFB360HzInterpolated".into(),
            section: "Force Feedback (app.ini)".into(),
            current_value: "1 (Activo)".into(),
            recommended_value: "1".into(),
            status: "optimal".into(),
            title: "Interpolación FFB a 360 Hz".into(),
            explanation: "FFB de alta frecuencia activo. Proporciona una respuesta mucho más fiel, suave y detallada de los neumáticos.".into(),
            category: "ffb".into(),
        });
    } else {
        items.push(ConfigItem {
            key: "enableFFB360HzInterpolated".into(),
            section: "Force Feedback (app.ini)".into(),
            current_value: "0 (Inactivo)".into(),
            recommended_value: "1".into(),
            status: "recommended".into(),
            title: "Activar Interpolación FFB a 360 Hz".into(),
            explanation: "Recomendado para volantes Direct Drive y gama alta. Eleva la tasa de actualización de 60Hz a 360Hz con interpolación física.".into(),
            category: "ffb".into(),
        });
    }

    // 2. FFB: Linear in Nm
    let val_nm = ffb_sec.and_then(|s| s.get("displayLinearInNm")).map(|s| s.as_str()).unwrap_or("0");
    if val_nm == "1" {
        items.push(ConfigItem {
            key: "displayLinearInNm".into(),
            section: "Force Feedback (app.ini)".into(),
            current_value: "1 (Activo)".into(),
            recommended_value: "1".into(),
            status: "optimal".into(),
            title: "Fuerza FFB Lineal en Nm".into(),
            explanation: "El FFB muestra los Newtons-metro reales en la barra del simulador, facilitando el ajuste exacto al límite de tu base.".into(),
            category: "ffb".into(),
        });
    } else {
        items.push(ConfigItem {
            key: "displayLinearInNm".into(),
            section: "Force Feedback (app.ini)".into(),
            current_value: "0 (Inactivo)".into(),
            recommended_value: "1".into(),
            status: "recommended".into(),
            title: "Mostrar FFB en Newtons-metro (Nm)".into(),
            explanation: "Permite configurar la fuerza en escala métrica de fuerza real (Nm) en lugar de porcentaje abstracto.".into(),
            category: "ffb".into(),
        });
    }

    // 3. FFB: Debounce Shifter
    let val_deb = ffb_sec.and_then(|s| s.get("debounceSeq_Ms")).and_then(|s| s.parse::<u32>().ok()).unwrap_or(0);
    if (60..=120).contains(&val_deb) {
        items.push(ConfigItem {
            key: "debounceSeq_Ms".into(),
            section: "Force Feedback (app.ini)".into(),
            current_value: format!("{val_deb} ms"),
            recommended_value: "80 ms".into(),
            status: "optimal".into(),
            title: "Anti-rebote de Levas de Cambio".into(),
            explanation: "Filtro anti-rebote calibrado correctamente para evitar cambios dobles en marchas rápidas.".into(),
            category: "ffb".into(),
        });
    } else {
        items.push(ConfigItem {
            key: "debounceSeq_Ms".into(),
            section: "Force Feedback (app.ini)".into(),
            current_value: format!("{val_deb} ms"),
            recommended_value: "80 ms".into(),
            status: "recommended".into(),
            title: "Ajustar Anti-rebote de Levas (Debounce)".into(),
            explanation: "Configura entre 60 y 80 ms para eliminar dobles cambios de marcha involuntarios por vibración en levas magnéticas.".into(),
            category: "ffb".into(),
        });
    }

    // 4. Graphics: Motion Blur in Driving Cams (rendererDX11Monitor.ini)
    let mb = find_val(&rend_ini, "MotionBlurDrivingCams").unwrap_or("0");
    if mb == "0" {
        items.push(ConfigItem {
            key: "MotionBlurDrivingCams".into(),
            section: "Gráficos (rendererDX11*.ini)".into(),
            current_value: "0 (Desactivado)".into(),
            recommended_value: "0".into(),
            status: "optimal".into(),
            title: "Desenfoque de Movimiento en Carrera".into(),
            explanation: "Desenfoque desactivado. Permite máxima nitidez en referencias de frenada y bordillos a alta velocidad.".into(),
            category: "graphics".into(),
        });
    } else {
        items.push(ConfigItem {
            key: "MotionBlurDrivingCams".into(),
            section: "Gráficos (rendererDX11*.ini)".into(),
            current_value: format!("{mb} (Activo)"),
            recommended_value: "0".into(),
            status: "warning".into(),
            title: "Desactivar Motion Blur en Conducción".into(),
            explanation: "El desenfoque de movimiento en carrera difumina las referencias de frenada y añade latencia perceptual crítica.".into(),
            category: "graphics".into(),
        });
    }

    // 5. Graphics: SSAO (Ambient Occlusion)
    let ssao = find_val(&rend_ini, "SSAO").unwrap_or("0");
    if ssao == "0" {
        items.push(ConfigItem {
            key: "SSAO".into(),
            section: "Gráficos (rendererDX11*.ini)".into(),
            current_value: "0 (Desactivado)".into(),
            recommended_value: "0".into(),
            status: "optimal".into(),
            title: "Oclusión Ambiental (SSAO)".into(),
            explanation: "SSAO apagado. Ahorra hasta 15 ms de GPU en parrillas densas de carrera (salidas, curvas 1).".into(),
            category: "graphics".into(),
        });
    } else {
        items.push(ConfigItem {
            key: "SSAO".into(),
            section: "Gráficos (rendererDX11*.ini)".into(),
            current_value: format!("{ssao} (Activo)"),
            recommended_value: "0".into(),
            status: "recommended".into(),
            title: "Desactivar SSAO para Ganar FPS".into(),
            explanation: "La oclusión ambiental genera sombras de contacto con un impacto muy elevado en el rendimiento cuando hay muchos coches juntos.".into(),
            category: "graphics".into(),
        });
    }

    // 6. Graphics: Sharpening (FidelityFX CAS)
    let sharp = find_val(&rend_ini, "Sharpening").unwrap_or("0");
    if sharp == "1" {
        items.push(ConfigItem {
            key: "Sharpening".into(),
            section: "Gráficos (rendererDX11*.ini)".into(),
            current_value: "1 (FidelityFX CAS Activo)".into(),
            recommended_value: "1".into(),
            status: "optimal".into(),
            title: "Nitidez Adaptativa (Sharpening)".into(),
            explanation: "Filtro de contraste de contornos activo. Permite distinguir carteles de distancia y vértices a larga distancia.".into(),
            category: "graphics".into(),
        });
    } else {
        items.push(ConfigItem {
            key: "Sharpening".into(),
            section: "Gráficos (rendererDX11*.ini)".into(),
            current_value: "0 (Inactivo)".into(),
            recommended_value: "1".into(),
            status: "recommended".into(),
            title: "Activar Nitidez Adaptativa".into(),
            explanation: "Activa Sharpening=1 con SharpeningAmount=150 para máxima definición visual de la pista sin coste de rendimiento.".into(),
            category: "graphics".into(),
        });
    }

    // 7. Graphics: TwoPassTrees
    let trees = find_val(&rend_ini, "TwoPassTrees").unwrap_or("0");
    if trees == "0" {
        items.push(ConfigItem {
            key: "TwoPassTrees".into(),
            section: "Gráficos (rendererDX11*.ini)".into(),
            current_value: "0 (Desactivado)".into(),
            recommended_value: "0".into(),
            status: "optimal".into(),
            title: "Árboles en Doble Pasada".into(),
            explanation: "Optimización de árboles correcta. Evita sobrecarga del hilo principal de la CPU en pistas boscosas.".into(),
            category: "graphics".into(),
        });
    } else {
        items.push(ConfigItem {
            key: "TwoPassTrees".into(),
            section: "Gráficos (rendererDX11*.ini)".into(),
            current_value: "1 (Activo)".into(),
            recommended_value: "0".into(),
            status: "warning".into(),
            title: "Desactivar Árboles en Doble Pasada".into(),
            explanation: "TwoPassTrees=1 es la causa número 1 de tirones de frametime en Nordschleife, Spa o Road America por sobrecarga de CPU.".into(),
            category: "graphics".into(),
        });
    }

    // 8. Visibility: Virtual Mirrors
    let mirrors = find_val(&rend_ini, "VirtualMirrors").unwrap_or("0");
    if mirrors == "1" {
        items.push(ConfigItem {
            key: "VirtualMirrors".into(),
            section: "Visibilidad (rendererDX11*.ini)".into(),
            current_value: "1 (Activo)".into(),
            recommended_value: "1".into(),
            status: "optimal".into(),
            title: "Retrovisor Virtual Panorámico".into(),
            explanation: "Retrovisor virtual activado. Fundamental para conocimiento situacional en adelantamientos y carreras multiclase.".into(),
            category: "visibility".into(),
        });
    } else {
        items.push(ConfigItem {
            key: "VirtualMirrors".into(),
            section: "Visibilidad (rendererDX11*.ini)".into(),
            current_value: "0 (Inactivo)".into(),
            recommended_value: "1".into(),
            status: "recommended".into(),
            title: "Activar Retrovisor Virtual".into(),
            explanation: "Indispensable para evitar accidentes en reincorporaciones y tráfico. Ocupa un único pase de renderizado central.".into(),
            category: "visibility".into(),
        });
    }

    let optimal_count = items.iter().filter(|i| i.status == "optimal").count();
    let recommended_count = items.iter().filter(|i| i.status == "recommended").count();
    let warning_count = items.iter().filter(|i| i.status == "warning").count();

    let total = items.len() as u32;
    let score = if total == 0 {
        100
    } else {
        let earned = (optimal_count as u32 * 100) + (recommended_count as u32 * 60) + (warning_count as u32 * 20);
        (earned / total).clamp(0, 100)
    };

    IracingAnalysis {
        found: true,
        iracing_dir: iracing_path.display().to_string(),
        score,
        optimal_count,
        recommended_count,
        warning_count,
        items,
    }
}

fn find_val<'a>(sections: &'a HashMap<String, HashMap<String, String>>, key: &str) -> Option<&'a str> {
    for sec in sections.values() {
        if let Some(val) = sec.get(key) {
            return Some(val.as_str());
        }
    }
    None
}

pub fn mock_analysis(found: bool, dir: &str) -> IracingAnalysis {
    IracingAnalysis {
        found,
        iracing_dir: dir.to_string(),
        score: 88,
        optimal_count: 5,
        recommended_count: 2,
        warning_count: 1,
        items: vec![
            ConfigItem {
                key: "enableFFB360HzInterpolated".into(),
                section: "Force Feedback (app.ini)".into(),
                current_value: "1 (Activo)".into(),
                recommended_value: "1".into(),
                status: "optimal".into(),
                title: "Interpolación FFB a 360 Hz".into(),
                explanation: "FFB de alta frecuencia activo para volantes modernos.".into(),
                category: "ffb".into(),
            },
            ConfigItem {
                key: "MotionBlurDrivingCams".into(),
                section: "Gráficos (rendererDX11*.ini)".into(),
                current_value: "0 (Desactivado)".into(),
                recommended_value: "0".into(),
                title: "Desenfoque de Movimiento".into(),
                status: "optimal".into(),
                explanation: "Motion blur desactivado para máxima claridad.".into(),
                category: "graphics".into(),
            },
            ConfigItem {
                key: "SSAO".into(),
                section: "Gráficos (rendererDX11*.ini)".into(),
                current_value: "1 (Activo)".into(),
                recommended_value: "0".into(),
                status: "recommended".into(),
                title: "Desactivar SSAO para Ganar FPS".into(),
                explanation: "Ahorra recursos de GPU en parrillas concurridas.".into(),
                category: "graphics".into(),
            },
        ],
    }
}
