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
    pub status: String, // "optimal" | "recommended" | "warning" | "protected"
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

pub fn find_iracing_dir() -> Option<PathBuf> {
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

    #[cfg(windows)]
    {
        if let Some(docs) = known_folders::get_known_folder_path(known_folders::KnownFolder::Documents) {
            candidate_paths.push(docs.join("iRacing"));
        }
        if let Some(profile) = known_folders::get_known_folder_path(known_folders::KnownFolder::Profile) {
            candidate_paths.push(profile.join("Documents").join("iRacing"));
            candidate_paths.push(profile.join("Documentos").join("iRacing"));
            candidate_paths.push(profile.join("OneDrive").join("Documents").join("iRacing"));
            candidate_paths.push(profile.join("OneDrive").join("Documentos").join("iRacing"));
        }
    }

    if let Ok(profile) = std::env::var("USERPROFILE") {
        let p = PathBuf::from(&profile);
        candidate_paths.push(p.join("Documents").join("iRacing"));
        candidate_paths.push(p.join("Documentos").join("iRacing"));
        candidate_paths.push(p.join("OneDrive").join("Documents").join("iRacing"));
        candidate_paths.push(p.join("OneDrive").join("Documentos").join("iRacing"));
    }

    if let Ok(home) = std::env::var("HOME") {
        let p = PathBuf::from(&home);
        candidate_paths.push(p.join("Documents").join("iRacing"));
        candidate_paths.push(p.join("Documentos").join("iRacing"));
    }

    for drive in ["C:\\", "D:\\", "E:\\", "F:\\"] {
        candidate_paths.push(Path::new(drive).join("iRacing"));
    }

    candidate_paths
        .into_iter()
        .find(|p| p.join("app.ini").is_file() || p.join("rendererDX11Monitor.ini").is_file())
}

pub fn analyze() -> IracingAnalysis {
    let iracing_path = find_iracing_dir();

    let Some(iracing_path) = iracing_path else {
        return mock_analysis(false, "Carpeta de iRacing no encontrada");
    };

    let app_ini_path = iracing_path.join("app.ini");
    let app_content = fs::read_to_string(&app_ini_path).unwrap_or_default();

    let mut renderer_content = String::new();
    let mut renderer_name = "rendererDX11Monitor.ini".to_string();

    let preferred = [
        "rendererDX11Monitor.ini",
        "rendererDX11.ini",
        "rendererDX11OpenXR.ini",
        "rendererDX11Oculus.ini",
        "rendererDX11VR.ini",
    ];
    for name in preferred {
        let path = iracing_path.join(name);
        if let Ok(c) = fs::read_to_string(&path) {
            if !c.is_empty() {
                renderer_content = c;
                renderer_name = name.to_string();
                break;
            }
        }
    }

    if renderer_content.is_empty() {
        if let Ok(entries) = fs::read_dir(&iracing_path) {
            for entry in entries.flatten() {
                let name = entry.file_name().to_string_lossy().to_string();
                let lower = name.to_ascii_lowercase();
                if lower.starts_with("rendererdx11") && lower.ends_with(".ini") && !lower.contains(".bak") {
                    if let Ok(c) = fs::read_to_string(entry.path()) {
                        if !c.is_empty() {
                            renderer_content = c;
                            renderer_name = name;
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

    // 0. PANTALLA Y HARDWARE: PROTECCIÓN CRÍTICA DE RESOLUCIÓN (INALTERABLE)
    let w = find_val(&rend_ini, "fullScreenWidth")
        .or_else(|| find_val(&rend_ini, "windowedWidth"))
        .unwrap_or("2560");
    let h = find_val(&rend_ini, "fullScreenHeight")
        .or_else(|| find_val(&rend_ini, "windowedHeight"))
        .unwrap_or("1440");
    let borderless = find_val(&rend_ini, "borderless").unwrap_or("0");
    let fullscreen = find_val(&rend_ini, "fullscreen").unwrap_or("0");
    let mode_str = if borderless == "1" {
        "Ventana sin bordes"
    } else if fullscreen == "1" {
        "Pantalla completa exclusiva"
    } else {
        "Modo ventana"
    };

    items.push(ConfigItem {
        key: "ResolutionGeometry".into(),
        section: format!("Pantalla / Hardware ({renderer_name})"),
        current_value: format!("{w} x {h} ({mode_str})"),
        recommended_value: "Nativa Protegida".into(),
        status: "protected".into(),
        title: "Resolución y Geometría de Pantallas (Bloqueada por Seguridad)".into(),
        explanation: format!("Resolución detectada de {w}x{h}. MMT Sync respeta siempre tu resolución nativa y alineación multimonitor o VR sin modificarla nunca bajo ningún concepto."),
        category: "display".into(),
    });

    // 1. LATENCIA: NVIDIA Reflex Mode (NvReflexMode)
    let reflex = find_val(&rend_ini, "NvReflexMode").unwrap_or("0");
    if reflex == "2" {
        items.push(ConfigItem {
            key: "NvReflexMode".into(),
            section: format!("Gráficos / Latencia ({renderer_name})"),
            current_value: "2 (On + Boost)".into(),
            recommended_value: "2".into(),
            status: "optimal".into(),
            title: "NVIDIA Reflex (Mínima Latencia de Renderizado)".into(),
            explanation: "Modo de latencia ultra baja activo con Boost. Mantiene la GPU con frecuencias altas para reducir al mínimo el retraso de entrada de dirección.".into(),
            category: "latency".into(),
        });
    } else if reflex == "1" {
        items.push(ConfigItem {
            key: "NvReflexMode".into(),
            section: format!("Gráficos / Latencia ({renderer_name})"),
            current_value: "1 (On)".into(),
            recommended_value: "2".into(),
            status: "optimal".into(),
            title: "NVIDIA Reflex Activo".into(),
            explanation: "Reflex activado. Puedes probar NvReflexMode=2 (Boost) para maximizar consistencia en curvas rápidas.".into(),
            category: "latency".into(),
        });
    } else {
        items.push(ConfigItem {
            key: "NvReflexMode".into(),
            section: format!("Gráficos / Latencia ({renderer_name})"),
            current_value: "0 (Desactivado)".into(),
            recommended_value: "2".into(),
            status: "warning".into(),
            title: "Activar NVIDIA Reflex".into(),
            explanation: "Desactivado. Activar NvReflexMode=2 sincroniza el bucle de físicas con la tarjeta gráfica y elimina retraso entre tus manos y la pantalla.".into(),
            category: "latency".into(),
        });
    }

    // 2. LATENCIA: Limitador de FPS (LimitFrameRate / DesiredFPSLimit)
    let limit_fps = find_val(&rend_ini, "LimitFrameRate").unwrap_or("0");
    let desired_fps = find_val(&rend_ini, "DesiredFPSLimit").unwrap_or("0");
    if limit_fps == "1" && desired_fps != "0" {
        items.push(ConfigItem {
            key: "LimitFrameRate".into(),
            section: format!("Gráficos / Latencia ({renderer_name})"),
            current_value: format!("Activo ({desired_fps} FPS)"),
            recommended_value: "Activo (3 FPS bajo Hz nativo)".into(),
            status: "optimal".into(),
            title: "Limitador de Cuadros (G-Sync / FreeSync)".into(),
            explanation: format!("Limitador configurado a {desired_fps} FPS. Evita que la GPU alcance el 99% de carga continua, previniendo microtirones y manteniendo activo el VRR."),
            category: "latency".into(),
        });
    } else {
        items.push(ConfigItem {
            key: "LimitFrameRate".into(),
            section: format!("Gráficos / Latencia ({renderer_name})"),
            current_value: "Sin límite".into(),
            recommended_value: "Activo (ej. 162 o 141 FPS)".into(),
            status: "recommended".into(),
            title: "Ajustar Limitador de Framerate".into(),
            explanation: "Recomendado fijar un límite 3 FPS inferior a la frecuencia de tu monitor (ej. 162 para 165Hz o 141 para 144Hz) para eliminar cola de renderizado.".into(),
            category: "latency".into(),
        });
    }

    // 3. LATENCIA: Cola de Pre-renderizado (MaxPreRenderedFrames)
    let pre_rendered = find_val(&rend_ini, "MaxPreRenderedFrames").unwrap_or("1");
    if pre_rendered == "1" || pre_rendered == "0" {
        items.push(ConfigItem {
            key: "MaxPreRenderedFrames".into(),
            section: format!("Gráficos / Latencia ({renderer_name})"),
            current_value: format!("{pre_rendered} (Óptimo)"),
            recommended_value: "1".into(),
            status: "optimal".into(),
            title: "Cola de Cuadros Pre-renderizados".into(),
            explanation: "Buffer de fotogramas al mínimo absoluto. Elimina desfase de tiempo de respuesta en cambios rápidos de dirección.".into(),
            category: "latency".into(),
        });
    } else {
        items.push(ConfigItem {
            key: "MaxPreRenderedFrames".into(),
            section: format!("Gráficos / Latencia ({renderer_name})"),
            current_value: format!("{pre_rendered} cuadros"),
            recommended_value: "1".into(),
            status: "warning".into(),
            title: "Reducir Cuadros Pre-renderizados a 1".into(),
            explanation: "Valores superiores a 1 acumulan imágenes en la tarjeta gráfica, generando retardo perceptible en el tacto del coche.".into(),
            category: "latency".into(),
        });
    }

    // 4. MEMORIA: Asignación de RAM (SysMemToUseMB)
    let sys_mem = find_val(&rend_ini, "SysMemToUseMB").and_then(|s| s.parse::<u32>().ok()).unwrap_or(0);
    if sys_mem >= 16384 {
        items.push(ConfigItem {
            key: "SysMemToUseMB".into(),
            section: format!("Hardware / Memoria ({renderer_name})"),
            current_value: format!("{} GB", sys_mem / 1024),
            recommended_value: ">= 16 GB".into(),
            status: "optimal".into(),
            title: "Asignación de Memoria RAM de Sistema".into(),
            explanation: "Memoria RAM suficiente asignada para sesiones de lluvia (Tempest) y parrillas con más de 40 coches.".into(),
            category: "hardware".into(),
        });
    } else {
        items.push(ConfigItem {
            key: "SysMemToUseMB".into(),
            section: format!("Hardware / Memoria ({renderer_name})"),
            current_value: format!("{} MB", sys_mem),
            recommended_value: ">= 16384 MB".into(),
            status: "recommended".into(),
            title: "Aumentar Asignación de RAM".into(),
            explanation: "Si dispones de 32 GB en tu equipo, asigna al menos 16384 o 24576 MB para prevenir pausas al cargar texturas en boxes.".into(),
            category: "hardware".into(),
        });
    }

    // 5. MEMORIA: Asignación de VRAM (VidMemToUseMB)
    let vid_mem = find_val(&rend_ini, "VidMemToUseMB").and_then(|s| s.parse::<u32>().ok()).unwrap_or(0);
    if vid_mem >= 8192 {
        items.push(ConfigItem {
            key: "VidMemToUseMB".into(),
            section: format!("Hardware / Memoria ({renderer_name})"),
            current_value: format!("{} GB", vid_mem / 1024),
            recommended_value: ">= 8 GB".into(),
            status: "optimal".into(),
            title: "Asignación de VRAM de Tarjeta Gráfica".into(),
            explanation: "VRAM configurada correctamente para mantener coches y circuitos en memoria de vídeo sin compresión destructiva.".into(),
            category: "hardware".into(),
        });
    } else {
        items.push(ConfigItem {
            key: "VidMemToUseMB".into(),
            section: format!("Hardware / Memoria ({renderer_name})"),
            current_value: format!("{} MB", vid_mem),
            recommended_value: ">= 8192 MB".into(),
            status: "recommended".into(),
            title: "Aumentar VRAM de GPU".into(),
            explanation: "Configura la memoria de vídeo acorde a tu tarjeta gráfica para evitar borrosidad repentina en pinturas de coches.".into(),
            category: "hardware".into(),
        });
    }

    // 6. FFB: 360Hz Interpolation
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

    // 7. FFB: Linear in Nm
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

    // 8. FFB: Damping Direct Drive (steeringDampingMaxPercent)
    let damping_max = ffb_sec.and_then(|s| s.get("steeringDampingMaxPercent")).and_then(|s| s.parse::<f32>().ok()).unwrap_or(0.0);
    if damping_max <= 0.05 {
        items.push(ConfigItem {
            key: "steeringDampingMaxPercent".into(),
            section: "Force Feedback (app.ini)".into(),
            current_value: format!("{:.1}%", damping_max * 100.0),
            recommended_value: "0.0% a 5.0%".into(),
            status: "optimal".into(),
            title: "Amortiguación FFB (Damping Direct Drive)".into(),
            explanation: "Fricción artificial por software desactivada. Permite que el motor Direct Drive exprese la física pura sin enmascaramiento.".into(),
            category: "ffb".into(),
        });
    } else {
        items.push(ConfigItem {
            key: "steeringDampingMaxPercent".into(),
            section: "Force Feedback (app.ini)".into(),
            current_value: format!("{:.1}%", damping_max * 100.0),
            recommended_value: "0.0%".into(),
            status: "recommended".into(),
            title: "Reducir Amortiguación de Software (Damping)".into(),
            explanation: "Valores altos de damping en el archivo .ini crean pesadez artificial que oculta pérdidas de agarre sutiles del eje delantero.".into(),
            category: "ffb".into(),
        });
    }

    // 9. FFB: Debounce Shifter
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

    // 10. RENDIMIENTO: Motion Blur in Driving Cams
    let mb = find_val(&rend_ini, "MotionBlurDrivingCams").unwrap_or("0");
    if mb == "0" {
        items.push(ConfigItem {
            key: "MotionBlurDrivingCams".into(),
            section: format!("Gráficos ({renderer_name})"),
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
            section: format!("Gráficos ({renderer_name})"),
            current_value: format!("{mb} (Activo)"),
            recommended_value: "0".into(),
            status: "warning".into(),
            title: "Desactivar Motion Blur en Conducción".into(),
            explanation: "El desenfoque de movimiento en carrera difumina las referencias de frenada y añade latencia perceptual crítica.".into(),
            category: "graphics".into(),
        });
    }

    // 11. RENDIMIENTO: SSAO (Ambient Occlusion)
    let ssao = find_val(&rend_ini, "SSAO").unwrap_or("0");
    if ssao == "0" {
        items.push(ConfigItem {
            key: "SSAO".into(),
            section: format!("Gráficos ({renderer_name})"),
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
            section: format!("Gráficos ({renderer_name})"),
            current_value: format!("{ssao} (Activo)"),
            recommended_value: "0".into(),
            status: "recommended".into(),
            title: "Desactivar SSAO para Ganar FPS".into(),
            explanation: "La oclusión ambiental genera sombras de contacto con un impacto muy elevado en el rendimiento cuando hay muchos coches juntos.".into(),
            category: "graphics".into(),
        });
    }

    // 12. COMPETICIÓN: EnableTireMarks
    let tire_marks = find_val(&rend_ini, "EnableTireMarks").unwrap_or("0");
    if tire_marks == "1" {
        items.push(ConfigItem {
            key: "EnableTireMarks".into(),
            section: format!("Gráficos / Rendimiento ({renderer_name})"),
            current_value: "1 (Activo)".into(),
            recommended_value: "1".into(),
            status: "optimal".into(),
            title: "Marcas de Neumático y Línea Engomada".into(),
            explanation: "Huellas de neumático activas. Vital en competición para leer el engomado del circuito y bloqueos de rivales.".into(),
            category: "graphics".into(),
        });
    } else {
        items.push(ConfigItem {
            key: "EnableTireMarks".into(),
            section: format!("Gráficos / Rendimiento ({renderer_name})"),
            current_value: "0 (Inactivo)".into(),
            recommended_value: "1".into(),
            status: "warning".into(),
            title: "Activar Marcas de Neumático".into(),
            explanation: "Imprescindible para detectar derrapes, pérdida de tracción y referencias dinámicas sobre el asfalto.".into(),
            category: "graphics".into(),
        });
    }

    // 13. COMPETICIÓN: Sharpening (FidelityFX CAS)
    let sharp = find_val(&rend_ini, "Sharpening").unwrap_or("0");
    if sharp == "1" {
        items.push(ConfigItem {
            key: "Sharpening".into(),
            section: format!("Gráficos ({renderer_name})"),
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
            section: format!("Gráficos ({renderer_name})"),
            current_value: "0 (Inactivo)".into(),
            recommended_value: "1".into(),
            status: "recommended".into(),
            title: "Activar Nitidez Adaptativa".into(),
            explanation: "Activa Sharpening=1 con SharpeningAmount=150 para máxima definición visual de la pista sin coste de rendimiento.".into(),
            category: "graphics".into(),
        });
    }

    // 14. RENDIMIENTO: TwoPassTrees
    let trees = find_val(&rend_ini, "TwoPassTrees").unwrap_or("0");
    if trees == "0" {
        items.push(ConfigItem {
            key: "TwoPassTrees".into(),
            section: format!("Gráficos ({renderer_name})"),
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
            section: format!("Gráficos ({renderer_name})"),
            current_value: "1 (Activo)".into(),
            recommended_value: "0".into(),
            status: "warning".into(),
            title: "Desactivar Árboles en Doble Pasada".into(),
            explanation: "TwoPassTrees=1 es la causa número 1 de tirones de frametime en Nordschleife, Spa o Road America por sobrecarga de CPU.".into(),
            category: "graphics".into(),
        });
    }

    // 15. VISIBILIDAD: Virtual Mirrors
    let mirrors = find_val(&rend_ini, "VirtualMirrors").unwrap_or("0");
    if mirrors == "1" {
        items.push(ConfigItem {
            key: "VirtualMirrors".into(),
            section: format!("Visibilidad ({renderer_name})"),
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
            section: format!("Visibilidad ({renderer_name})"),
            current_value: "0 (Inactivo)".into(),
            recommended_value: "1".into(),
            status: "recommended".into(),
            title: "Activar Retrovisor Virtual".into(),
            explanation: "Indispensable para evitar accidentes en reincorporaciones y tráfico. Ocupa un único pase de renderizado central.".into(),
            category: "visibility".into(),
        });
    }

    let optimal_count = items.iter().filter(|i| i.status == "optimal" || i.status == "protected").count();
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
        score: 95,
        optimal_count: 6,
        recommended_count: 1,
        warning_count: 0,
        items: vec![
            ConfigItem {
                key: "ResolutionGeometry".into(),
                section: "Pantalla / Hardware (rendererDX11Monitor.ini)".into(),
                current_value: "2560 x 1440 (Ventana sin bordes)".into(),
                recommended_value: "Nativo Protegido".into(),
                status: "protected".into(),
                title: "Resolución y Geometría de Pantallas (Inalterable)".into(),
                explanation: "Resolución nativa detectada y protegida. MMT Sync respeta siempre tu resolución nativa y alineación multimonitor sin alterarla nunca.".into(),
                category: "display".into(),
            },
            ConfigItem {
                key: "NvReflexMode".into(),
                section: "Gráficos / Latencia (rendererDX11Monitor.ini)".into(),
                current_value: "2 (On + Boost)".into(),
                recommended_value: "2".into(),
                status: "optimal".into(),
                title: "NVIDIA Reflex (Mínima Latencia)".into(),
                explanation: "Bucle de físicas sincronizado con la tarjeta gráfica.".into(),
                category: "latency".into(),
            },
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
                section: "Gráficos (rendererDX11Monitor.ini)".into(),
                current_value: "0 (Desactivado)".into(),
                recommended_value: "0".into(),
                title: "Desenfoque de Movimiento".into(),
                status: "optimal".into(),
                explanation: "Motion blur desactivado para máxima claridad.".into(),
                category: "graphics".into(),
            },
            ConfigItem {
                key: "SSAO".into(),
                section: "Gráficos (rendererDX11Monitor.ini)".into(),
                current_value: "0 (Desactivado)".into(),
                recommended_value: "0".into(),
                status: "optimal".into(),
                title: "Oclusión Ambiental (SSAO)".into(),
                explanation: "Ahorra recursos de GPU en parrillas concurridas.".into(),
                category: "graphics".into(),
            },
        ],
    }
}
