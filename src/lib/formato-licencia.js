/** Una sola función para las cifras públicas de la licencia Sports Car. */
export function localeDeIdioma(lang) {
  var code = String(lang || "es").toLowerCase().split("-")[0];
  if (code === "en") return "en-GB";
  if (code === "ca") return "ca-ES";
  if (code === "fr") return "fr-FR";
  return "es-ES";
}

export function formatoAprox(value, kind, locale) {
  if (value == null || value === "") return kind === "k" ? "Sin iRating" : "Sin datos";
  var n = Number(value);
  if (!isFinite(n)) return kind === "k" ? "Sin iRating" : "Sin datos";
  var loc = locale || "es-ES";
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
