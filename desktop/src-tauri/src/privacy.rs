use serde::Serialize;

const REDACTED_KEYS: &[&str] = &[
    "UserID:",
    "CustID:",
    "SessionID:",
    "SubSessionID:",
    "CarNumber:",
    "CarNumberRaw:",
    "UserName:",
    "AbbrevName:",
    "TeamName:",
    "IRating:",
];

/// Strips personal identifiers and car numbers from an iRacing SessionInfo YAML block.
pub fn redact_session_yaml(raw_yaml: &str) -> String {
    let mut out = String::with_capacity(raw_yaml.len());
    for line in raw_yaml.lines() {
        let trimmed = line.trim_start();
        if let Some(key) = REDACTED_KEYS.iter().find(|&&k| trimmed.starts_with(k)) {
            let indent_len = line.len() - trimmed.len();
            out.push_str(&line[..indent_len]);
            out.push_str(key);
            out.push_str(" [REDACTED]\n");
        } else {
            out.push_str(line);
            out.push('\n');
        }
    }
    out
}

#[allow(dead_code)]
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AnonymizedSessionSummary {
    pub car_folder: String,
    pub track_name: String,
    pub best_lap_s: f32,
    pub avg_lap_s: f32,
    pub valid_laps: u32,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn redact_session_yaml_masks_sensitive_fields() {
        let raw = "  UserName: Alberto\n  CustID: 123456\n  CarNumber: \"77\"\n  TrackName: spa\n";
        let clean = redact_session_yaml(raw);
        assert!(!clean.contains("Alberto"));
        assert!(!clean.contains("123456"));
        assert!(!clean.contains("77"));
        assert!(clean.contains("TrackName: spa"));
        assert!(clean.contains("CustID: [REDACTED]"));
    }
}
