//! El token vive solo en el Administrador de credenciales de Windows.
//! En modo demostración se queda en memoria y no se escribe a disco.

#[cfg(windows)]
const SERVICE: &str = "MMT Sync";
#[cfg(windows)]
const USER: &str = "desktop-token";

pub fn token_ok(token: &str) -> bool {
    (8..=4096).contains(&token.len())
        && !token.chars().any(|c| c.is_control() || c.is_whitespace())
}

#[cfg(windows)]
pub fn store_token(token: &str) -> Result<(), String> {
    if !token_ok(token) {
        return Err("El token recibido no es válido.".into());
    }
    let entry = keyring::Entry::new(SERVICE, USER).map_err(|err| err.to_string())?;
    entry.set_password(token).map_err(|err| err.to_string())
}

#[cfg(windows)]
pub fn load_token() -> Result<String, String> {
    let entry = keyring::Entry::new(SERVICE, USER).map_err(|err| err.to_string())?;
    let token = entry.get_password().map_err(|_| "Inicia sesión para sincronizar.".to_string())?;
    if !token_ok(&token) {
        return Err("La credencial guardada no es válida.".into());
    }
    Ok(token)
}

#[cfg(windows)]
pub fn clear_token() -> Result<(), String> {
    let entry = keyring::Entry::new(SERVICE, USER).map_err(|err| err.to_string())?;
    match entry.delete_credential() {
        Ok(()) => Ok(()),
        Err(err) => {
            let text = err.to_string().to_ascii_lowercase();
            if text.contains("no entry") || text.contains("not found") || text.contains("no credential") {
                Ok(())
            } else {
                Err(err.to_string())
            }
        }
    }
}

#[cfg(not(windows))]
pub fn store_token(_token: &str) -> Result<(), String> {
    Err("MMT Sync solo guarda el token en el Administrador de credenciales de Windows.".into())
}

#[cfg(not(windows))]
pub fn load_token() -> Result<String, String> {
    Err("Inicia sesión en Windows para sincronizar.".into())
}

#[cfg(not(windows))]
pub fn clear_token() -> Result<(), String> {
    Ok(())
}
