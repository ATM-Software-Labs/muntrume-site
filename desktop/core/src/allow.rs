//! Destinos de red que la app puede usar. Cualquier otra URL se rechaza.

use thiserror::Error;
use url::Url;

pub const API_ORIGIN: &str = "https://muntrume.atrumin16.workers.dev";

#[derive(Debug, Error, PartialEq, Eq)]
pub enum ApiUrlError {
    #[error("la ruta del API no es válida")]
    Path,
    #[error("el destino no es el API de Muntrume")]
    Host,
}

pub fn api_url(path: &str) -> Result<Url, ApiUrlError> {
    if !path.starts_with('/') || path.starts_with("//") || path.contains('\\') || path.contains("..")
    {
        return Err(ApiUrlError::Path);
    }
    if path.chars().any(|c| c.is_control() || c == '?' || c == '#') {
        return Err(ApiUrlError::Path);
    }
    let url = Url::parse(&format!("{API_ORIGIN}{path}")).map_err(|_| ApiUrlError::Path)?;
    if url.scheme() != "https" || url.host_str() != Some("muntrume.atrumin16.workers.dev") {
        return Err(ApiUrlError::Host);
    }
    if !url.username().is_empty() || url.password().is_some() {
        return Err(ApiUrlError::Host);
    }
    Ok(url)
}

pub fn allowed_verify_url(raw: &str) -> Option<String> {
    let url = Url::parse(raw).ok()?;
    if url.scheme() != "https" {
        return None;
    }
    match url.host_str() {
        Some("muntru.me") | Some("www.muntru.me") => {}
        _ => return None,
    }
    if !url.username().is_empty() || url.password().is_some() {
        return None;
    }
    Some(url.to_string())
}

pub fn canonical_link_url(user_code: &str) -> Option<String> {
    if !(4..=64).contains(&user_code.len()) {
        return None;
    }
    if !user_code
        .bytes()
        .all(|byte| byte.is_ascii_alphanumeric() || byte == b'-')
    {
        return None;
    }
    Some(format!("https://muntru.me/app/vincular/?code={user_code}"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn api_url_stays_on_the_workers_host() {
        let url = api_url("/api/desktop/manifest").unwrap();
        assert_eq!(url.scheme(), "https");
        assert_eq!(url.host_str(), Some("muntrume.atrumin16.workers.dev"));
        assert_eq!(url.path(), "/api/desktop/manifest");
        assert!(api_url("/api/desktop/setups/abc_1/file").is_ok());
    }

    #[test]
    fn api_url_rejects_escape_and_other_hosts() {
        assert!(api_url("https://evil.example/api").is_err());
        assert!(api_url("//evil.example").is_err());
        assert!(api_url("/api/../admin").is_err());
        assert!(api_url("/api/desktop?x=1").is_err());
        assert!(api_url(r"/api\desktop").is_err());
        assert!(api_url("/api/desktop\n").is_err());
    }

    #[test]
    fn verify_url_is_only_muntru_me() {
        assert!(allowed_verify_url("https://muntru.me/app/vincular/?code=MMT-7K2Q").is_some());
        assert!(allowed_verify_url("https://www.muntru.me/app/vincular/").is_some());
        assert!(allowed_verify_url("http://muntru.me/app/vincular/").is_none());
        assert!(allowed_verify_url("https://muntru.me.evil.com/").is_none());
        assert!(allowed_verify_url("https://evil.com/muntru.me").is_none());
        assert!(allowed_verify_url("https://user:pass@muntru.me/").is_none());
        assert!(allowed_verify_url("javascript:alert(1)").is_none());
        assert!(allowed_verify_url("https://muntrume.atrumin16.workers.dev/").is_none());
    }

    #[test]
    fn canonical_link_encodes_only_a_device_code() {
        assert_eq!(
            canonical_link_url("MMT-7K2Q").as_deref(),
            Some("https://muntru.me/app/vincular/?code=MMT-7K2Q")
        );
        assert!(canonical_link_url("MMT 1").is_none());
        assert!(canonical_link_url("../x").is_none());
        assert!(canonical_link_url("ab").is_none());
    }
}
