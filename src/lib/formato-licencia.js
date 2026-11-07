/** Unified formatter for Sports Car licence & Road telemetry metrics. */
export function localeDeIdioma(lang) {
  var code = String(lang || "en").toLowerCase().split("-")[0];
  if (code === "es") return "es-ES";
  if (code === "ca") return "ca-ES";
  if (code === "fr") return "fr-FR";
  return "en-US";
}

export function formatoAprox(value, kind, locale) {
  if (value == null || value === "") return kind === "k" ? "No iRating" : "No data";
  var n = Number(value);
  if (!isFinite(n)) return kind === "k" ? "No iRating" : "No data";
  var loc = locale || "en-US";
  var opt = { minimumFractionDigits: 1, maximumFractionDigits: 1 };
  if (kind === "sr") {
    var sr = Math.round(n * 10) / 10;
    return "≈" + sr.toLocaleString(loc, opt);
  }
  if (kind === "h") {
    var hrs = Math.round(n * 10) / 10;
    return (hrs >= 100 ? Math.round(hrs).toLocaleString(loc) : hrs.toLocaleString(loc, opt)) + " h";
  }
  var miles = Math.round((n / 1000) * 10) / 10;
  return "≈" + miles.toLocaleString(loc, opt) + "k";
}
