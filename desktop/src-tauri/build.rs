fn main() {
    tauri_build::try_build(
        tauri_build::Attributes::new().app_manifest(
            tauri_build::AppManifest::new().commands(&[
                "snapshot",
                "auth_start",
                "auth_cancel",
                "auth_poll",
                "open_verify",
                "logout",
                "sync_now",
                "save_settings",
                "pick_folder",
                "detect_folder",
                "pick_sto",
                "clear_staged",
                "upload_staged",
                "install_update",
                "inspect_config",
                "check_iracing_status",
                "toggle_overlay",
                "quit",
            ]),
        ),
    )
    .expect("failed to run tauri-build");
}
