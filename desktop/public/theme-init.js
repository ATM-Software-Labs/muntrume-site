(function () {
  var query = new URLSearchParams(location.search).get("theme");
  var stored = null;
  try {
    stored = localStorage.getItem("mmt-sync-theme");
  } catch (e) {
    stored = null;
  }
  var theme = query || stored;
  if (theme !== "light" && theme !== "dark") {
    theme = window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  }
  document.documentElement.setAttribute("data-theme", theme);
})();
