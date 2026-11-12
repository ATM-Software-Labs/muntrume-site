//! Núcleo sin interfaz de MMT Sync: rutas, diff, URLs permitidas y el índice local.
//! No abre red ni guarda tokens.

mod allow;
mod fixed;
mod ibt;
mod manifest;
mod pathsafe;
mod place;
mod plan;
mod session;
mod store;
mod upload;

pub use allow::{allowed_verify_url, api_url, canonical_link_url, ApiUrlError};
pub use fixed::{install_allowed, yaml_fixed_flag, SeriesLock, SeriesWeek};
pub use ibt::{
    parse_ibt, read_live_sample, read_live_sample_with, resolve_var_table, session_info_update,
    IbtError, VarTable,
};
pub use manifest::{flexible_id, Manifest, RemoteSetup, MAX_STO_BYTES};
pub use pathsafe::{sanitize_filename, sanitize_segment, MmtPath, PathError};
pub use place::{locate_mmt_file, prepare_mmt_destination, PlaceError};
pub use plan::{
    file_state, plan_sync, plan_sync_cars, toast_message, Action, Deletion, Download, FileState,
    LocalSetup, SyncPlan,
};
pub use session::{
    compare_laps, fuel_plan, pack_reference_lap, synthetic_session, track_xy, FuelInput, FuelPlan,
    Lap, Sample, Session, MAX_REFERENCE_BYTES,
};
pub use store::{atomic_write, hash_bytes, load_index, save_index, IndexFile, StoreError};
pub use upload::{normalize_kind, validate_upload, UploadError};
