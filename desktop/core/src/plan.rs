//! Diff entre el manifiesto del equipo y el índice local.
//! No borra nada: solo describe descargas y borrados que el llamador puede ejecutar.

use serde::{Deserialize, Serialize};

use crate::manifest::{parse_sha256, RemoteSetup, MAX_STO_BYTES};
use crate::pathsafe::{MmtPath, PathError};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct LocalSetup {
    pub id: String,
    pub relative_path: String,
    pub sha256: String,
    pub size: u64,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum FileState {
    Nuevo,
    Actualizado,
    AlDia,
}

impl FileState {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Nuevo => "nuevo",
            Self::Actualizado => "actualizado",
            Self::AlDia => "al_dia",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Download {
    pub id: String,
    pub relative: String,
    pub sha256: String,
    pub size: u64,
    pub car: String,
    pub state: FileState,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Deletion {
    pub id: String,
    pub relative: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Rejected {
    pub id: String,
    pub reason: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Action {
    Download(Download),
    Unchanged { id: String },
    /// El piloto desinstaló este coche: no se descarga y no se borra lo que ya hay.
    Skipped { id: String },
    Delete(Deletion),
    KeepRetired { id: String, relative: String },
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SyncPlan {
    pub actions: Vec<Action>,
    pub rejected: Vec<Rejected>,
}

pub fn file_state(remote_sha: &str, local_sha: Option<&str>) -> FileState {
    match local_sha {
        None => FileState::Nuevo,
        Some(local) if sha_eq(local, remote_sha) => FileState::AlDia,
        Some(_) => FileState::Actualizado,
    }
}

pub fn plan_sync(remote: &[RemoteSetup], local: &[LocalSetup], delete_retired: bool) -> SyncPlan {
    plan_sync_cars(remote, local, delete_retired, &[])
}

pub fn plan_sync_cars(
    remote: &[RemoteSetup],
    local: &[LocalSetup],
    delete_retired: bool,
    disabled_cars: &[String],
) -> SyncPlan {
    let mut actions = Vec::new();
    let mut rejected = Vec::new();
    let mut seen_ids = Vec::new();
    let mut seen_relative = Vec::new();

    for setup in remote {
        match accept_remote(setup) {
            Ok((relative, sha)) => {
                if seen_ids.iter().any(|id: &String| id == &setup.id)
                    || seen_relative.iter().any(|rel: &String| rel == &relative)
                {
                    rejected.push(Rejected {
                        id: setup.id.clone(),
                        reason: "el manifiesto repite un id o una ruta".into(),
                    });
                    continue;
                }
                seen_ids.push(setup.id.clone());
                seen_relative.push(relative.clone());
                if disabled_cars.iter().any(|car| car == &setup.car_folder) {
                    actions.push(Action::Skipped { id: setup.id.clone() });
                    continue;
                }
                let local_sha = local_sha_for(local, &setup.id, &relative);
                let state = file_state(&sha, local_sha.as_deref());
                if state == FileState::AlDia {
                    actions.push(Action::Unchanged { id: setup.id.clone() });
                } else {
                    actions.push(Action::Download(Download {
                        id: setup.id.clone(),
                        relative,
                        sha256: sha,
                        size: setup.size,
                        car: setup.car.clone(),
                        state,
                    }));
                }
            }
            Err(reason) => rejected.push(Rejected {
                id: setup.id.clone(),
                reason,
            }),
        }
    }

    for entry in local {
        if seen_ids.iter().any(|id| id == &entry.id) {
            continue;
        }
        if seen_relative.iter().any(|rel| rel == &entry.relative_path) {
            continue;
        }
        if MmtPath::from_relative(&entry.relative_path).is_err() {
            continue;
        }
        let car = entry.relative_path.split('/').next().unwrap_or("");
        if disabled_cars.iter().any(|disabled| disabled == car) {
            actions.push(Action::KeepRetired {
                id: entry.id.clone(),
                relative: entry.relative_path.clone(),
            });
            continue;
        }
        if delete_retired {
            actions.push(Action::Delete(Deletion {
                id: entry.id.clone(),
                relative: entry.relative_path.clone(),
            }));
        } else {
            actions.push(Action::KeepRetired {
                id: entry.id.clone(),
                relative: entry.relative_path.clone(),
            });
        }
    }

    SyncPlan { actions, rejected }
}

pub fn toast_message(file_count: usize, cars: &[String]) -> Option<String> {
    if file_count == 0 {
        return None;
    }
    let mut unique = Vec::new();
    for car in cars {
        let name = car.trim();
        if name.is_empty() || unique.iter().any(|seen: &String| seen == name) {
            continue;
        }
        unique.push(name.to_string());
    }
    let noun = if file_count == 1 {
        "1 setup sincronizado".to_string()
    } else {
        format!("{file_count} setups sincronizados")
    };
    if unique.is_empty() {
        return Some(noun);
    }
    let list = if unique.len() <= 3 {
        unique.join(", ")
    } else {
        format!("{}, {} y {} más", unique[0], unique[1], unique.len() - 2)
    };
    Some(format!("{noun}: {list}"))
}

pub fn clean_track_folder(raw: &str) -> String {
    let t = raw.to_ascii_lowercase();
    if t.contains("vln") || t.contains("gesamtstrecke") {
        "Nurburgring Combined VLN".to_string()
    } else if t.contains("gp-strecke") || t.contains("gp strecke") {
        "Nurburgring GP-Strecke".to_string()
    } else if t.contains("nurburgring") || t.contains("nordschleife") {
        "Nurburgring".to_string()
    } else if t.contains("indy") || t.contains("indianapolis") {
        "Indianapolis".to_string()
    } else if t.contains("silverstone") {
        "Silverstone".to_string()
    } else if t.contains("road atlanta") || t.contains("atlanta") {
        "Road Atlanta".to_string()
    } else if t.contains("zandvoort") {
        "Zandvoort".to_string()
    } else if t.contains("motegi") {
        "Motegi".to_string()
    } else if t.contains("red bull") || t.contains("rbr") || t.contains("spielberg") {
        "Red Bull Ring".to_string()
    } else if t.contains("long beach") || t.contains("longbeach") {
        "Long Beach".to_string()
    } else if t.contains("the bend") || t.contains("thebend") || t.contains("bend") {
        "The Bend".to_string()
    } else if t.contains("montreal") || t.contains("villeneuve") {
        "Montreal".to_string()
    } else if t.contains("cota") || t.contains("austin") || t.contains("americas") {
        "COTA".to_string()
    } else if t.contains("le mans") || t.contains("lemans") || t.contains("sarthe") {
        "Le Mans".to_string()
    } else if t.contains("mexico") || t.contains("hermanos") {
        "Mexico".to_string()
    } else if t.contains("spa") || t.contains("francorchamps") {
        "Spa".to_string()
    } else if t.contains("suzuka") {
        "Suzuka".to_string()
    } else if t.contains("misano") {
        "Misano".to_string()
    } else if t.contains("sebring") {
        "Sebring".to_string()
    } else if t.contains("monza") {
        "Monza".to_string()
    } else if t.contains("mugello") {
        "Mugello".to_string()
    } else if t.contains("fuji") {
        "Fuji".to_string()
    } else if t.contains("watkins") {
        "Watkins Glen".to_string()
    } else if t.contains("catalunya") || t.contains("barcelona") {
        "Catalunya".to_string()
    } else if t.contains("bathurst") || t.contains("panorama") {
        "Bathurst".to_string()
    } else if t.contains("road america") {
        "Road America".to_string()
    } else if t.contains("hockenheim") {
        "Hockenheim".to_string()
    } else if t.contains("zolder") {
        "Zolder".to_string()
    } else {
        sanitize_track_folder(raw)
    }
}

fn sanitize_track_folder(raw: &str) -> String {
    let clean: String = raw
        .chars()
        .map(|c| match c {
            '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|' => '_',
            other => other,
        })
        .collect();
    let trimmed = clean.trim().trim_matches('.').trim();
    if trimmed.is_empty() {
        "General".to_string()
    } else {
        trimmed.to_string()
    }
}

fn extract_week_folder(week_opt: Option<u32>, filename: &str, _track: &str) -> String {
    if let Some(w) = week_opt {
        if (1..=14).contains(&w) {
            return format!("WEEK {:02}", w);
        }
    }
    let upper = filename.to_ascii_uppercase();
    for prefix in ["_W", "-W", ".W", "WEEK"] {
        if let Some(pos) = upper.find(prefix) {
            let rest = &upper[pos + prefix.len()..];
            let num_str: String = rest.chars().take_while(|c| c.is_ascii_digit()).collect();
            if let Ok(num) = num_str.parse::<u32>() {
                if (1..=14).contains(&num) {
                    return format!("WEEK {:02}", num);
                }
            }
        }
    }
    "sin-semana".to_string()
}

fn accept_remote(setup: &RemoteSetup) -> Result<(String, String), String> {
    if crate::manifest::parse_id(&setup.id).is_none() {
        return Err("id no válido".into());
    }
    let Some(sha) = parse_sha256(&setup.sha256) else {
        return Err("sha256 no válido".into());
    };
    if setup.size == 0 || setup.size > MAX_STO_BYTES {
        return Err("el tamaño tiene que estar entre 1 byte y 1 MB".into());
    }
    let week_folder = extract_week_folder(setup.week, &setup.filename, &setup.track);
    let track_folder = clean_track_folder(&setup.track);
    let season = if setup.season.trim().is_empty() { "26S4" } else { setup.season.trim() };

    let path = MmtPath::new_hierarchical(
        &setup.car_folder,
        "MMT by Muntrume",
        &[season, &week_folder, &track_folder],
        &setup.filename,
    )
    .map_err(|err| match err {
        PathError::Extension => "el archivo tiene que ser .sto".to_string(),
        PathError::Escape => "la ruta sale de la carpeta de setups".to_string(),
        PathError::Empty => "la ruta está vacía".to_string(),
        PathError::Name => "el nombre no es válido en Windows".to_string(),
    })?;
    Ok((path.relative(), sha))
}

fn local_sha_for(local: &[LocalSetup], id: &str, relative: &str) -> Option<String> {
    local
        .iter()
        .find(|entry| entry.id == id && entry.relative_path == relative)
        .map(|entry| entry.sha256.clone())
}

fn sha_eq(left: &str, right: &str) -> bool {
    parse_sha256(left).as_deref() == parse_sha256(right).as_deref()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn remote(id: &str, sha: &str, car_folder: &str, file: &str) -> RemoteSetup {
        RemoteSetup {
            id: id.into(),
            car: "Ferrari 296 GT3".into(),
            car_folder: car_folder.into(),
            track: if file.to_ascii_lowercase().contains("monza") {
                "Monza".into()
            } else {
                "Spa".into()
            },
            season: "26S4".into(),
            kind: "Race".into(),
            filename: file.into(),
            sha256: sha.into(),
            size: 128,
            updated_at: "2026-11-10T10:00:00Z".into(),
            week: None,
            notes: None,
            guide: None,
        }
    }

    fn sha(byte: u8) -> String {
        format!("{:02x}", byte).repeat(32)
    }

    fn local(id: &str, relative: &str, sha: &str) -> LocalSetup {
        LocalSetup {
            id: id.into(),
            relative_path: relative.into(),
            sha256: sha.into(),
            size: 128,
        }
    }

    #[test]
    fn states_follow_the_hash() {
        let digest = sha(1);
        assert_eq!(file_state(&digest, None), FileState::Nuevo);
        assert_eq!(file_state(&digest, Some(&sha(2))), FileState::Actualizado);
        assert_eq!(
            file_state(&digest, Some(&digest.to_uppercase())),
            FileState::AlDia
        );
    }

    #[test]
    fn downloads_only_new_or_changed_and_keeps_retired_by_default() {
        let same = sha(1);
        let old = sha(2);
        let new_hash = sha(3);
        let remote = vec![
            remote("a", &same, "ferrari296gt3", "spa.sto"),
            remote("b", &new_hash, "ferrari296gt3", "monza.sto"),
            remote("c", &sha(4), "porsche992rgt3", "spa.sto"),
        ];
        let local = vec![
            local("a", "ferrari296gt3/MMT by Muntrume/26S4/sin-semana/Spa/spa.sto", &same),
            local("b", "ferrari296gt3/MMT by Muntrume/26S4/sin-semana/Monza/monza.sto", &old),
            local("gone", "porsche992rgt3/MMT/26S4/old.sto", &sha(9)),
            local("evil", "../../Windows/System32/evil.sto", &sha(8)),
            local("outside", "porsche992rgt3/other/26S4/x.sto", &sha(7)),
        ];
        let plan = plan_sync(&remote, &local, false);
        assert!(plan.rejected.is_empty());
        assert!(plan.actions.iter().any(|action| matches!(action, Action::Unchanged { id } if id == "a")));
        assert!(plan.actions.iter().any(|action| matches!(
            action,
            Action::Download(item) if item.id == "b" && item.state == FileState::Actualizado
        )));
        assert!(plan.actions.iter().any(|action| matches!(
            action,
            Action::Download(item) if item.id == "c" && item.state == FileState::Nuevo
                && item.relative == "porsche992rgt3/MMT by Muntrume/26S4/sin-semana/Spa/spa.sto"
        )));
        assert!(plan.actions.iter().any(|action| matches!(
            action,
            Action::KeepRetired { id, .. } if id == "gone"
        )));
        assert!(!plan.actions.iter().any(|action| matches!(action, Action::Delete(_))));
        assert!(!plan.actions.iter().any(|action| {
            let relative = match action {
                Action::KeepRetired { relative, .. } => relative.as_str(),
                Action::Delete(item) => item.relative.as_str(),
                _ => return false,
            };
            relative.contains("..") || !relative.contains("/MMT")
        }));
        let kept: Vec<_> = plan
            .actions
            .iter()
            .filter_map(|action| match action {
                Action::KeepRetired { id, .. } => Some(id.as_str()),
                _ => None,
            })
            .collect();
        assert_eq!(kept, vec!["gone"]);
    }

    #[test]
    fn retired_files_are_deleted_only_when_asked_and_only_inside_mmt() {
        let remote = vec![remote("a", &sha(1), "ferrari296gt3", "spa.sto")];
        let local = vec![
            local("a", "ferrari296gt3/MMT by Muntrume/26S4/sin-semana/Spa/spa.sto", &sha(1)),
            local("gone", "ferrari296gt3/MMT/26S4/old.sto", &sha(2)),
            local("nope", "../secret.sto", &sha(3)),
            local("nope2", "ferrari296gt3/MMT/../../secret.sto", &sha(3)),
        ];
        let plan = plan_sync(&remote, &local, true);
        let deletes: Vec<_> = plan
            .actions
            .iter()
            .filter_map(|action| match action {
                Action::Delete(item) => Some(item.relative.as_str()),
                _ => None,
            })
            .collect();
        assert_eq!(deletes, vec!["ferrari296gt3/MMT/26S4/old.sto"]);
    }

    #[test]
    fn rejects_bad_hashes_sizes_and_traversal_without_blocking_the_rest() {
        let mut bad_hash = remote("bad", "zzzz", "ferrari296gt3", "a.sto");
        bad_hash.sha256 = "nope".into();
        let mut empty = remote("empty", &sha(1), "ferrari296gt3", "b.sto");
        empty.size = 0;
        let mut huge = remote("huge", &sha(1), "ferrari296gt3", "c.sto");
        huge.size = MAX_STO_BYTES + 1;
        let escape = remote("esc", &sha(1), "..", "d.sto");
        let ok = remote("ok", &sha(1), "ferrari296gt3", "ok.sto");
        let plan = plan_sync(&[bad_hash, empty, huge, escape, ok], &[], false);
        assert_eq!(plan.rejected.len(), 4);
        assert!(plan.actions.iter().any(|action| matches!(
            action,
            Action::Download(item) if item.id == "ok"
        )));
    }

    #[test]
    fn duplicate_destination_is_rejected() {
        let one = remote("one", &sha(1), "ferrari296gt3", "spa.sto");
        let two = remote("two", &sha(2), "ferrari296gt3", "spa.sto");
        let plan = plan_sync(&[one, two], &[], false);
        assert_eq!(plan.rejected.len(), 1);
        assert_eq!(plan.rejected[0].id, "two");
    }

    #[test]
    fn toast_names_the_count_and_the_cars() {
        assert_eq!(toast_message(0, &[]), None);
        assert_eq!(
            toast_message(1, &["Ferrari 296 GT3".into()]),
            Some("1 setup sincronizado: Ferrari 296 GT3".into())
        );
        assert_eq!(
            toast_message(2, &["Ferrari 296 GT3".into(), "Ferrari 296 GT3".into(), "Porsche 992 GT3 R".into()]),
            Some("2 setups sincronizados: Ferrari 296 GT3, Porsche 992 GT3 R".into())
        );
        let cars = vec![
            "A".into(),
            "B".into(),
            "C".into(),
            "D".into(),
        ];
        assert_eq!(
            toast_message(4, &cars),
            Some("4 setups sincronizados: A, B y 2 más".into())
        );
    }

    #[test]
    fn a_disabled_car_is_not_downloaded_or_deleted() {
        let remote = vec![
            remote("a", &sha(1), "ferrari296gt3", "spa.sto"),
            remote("b", &sha(2), "porsche992rgt3", "monza.sto"),
        ];
        let local = vec![local("old", "ferrari296gt3/MMT/26S4/old.sto", &sha(9))];
        let plan = plan_sync_cars(&remote, &local, true, &["ferrari296gt3".into()]);
        assert!(plan.actions.iter().any(|action| matches!(action, Action::Skipped { id } if id == "a")));
        assert!(plan.actions.iter().any(|action| matches!(action, Action::Download(item) if item.id == "b")));
        assert!(!plan.actions.iter().any(|action| matches!(action, Action::Delete(_))));
    }
}
