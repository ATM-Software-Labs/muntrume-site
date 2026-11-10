(function () {
  var version = document.getElementById("mmtSyncVersion");
  var size = document.getElementById("mmtSyncSize");
  if (!version || !size) return;
  fetch("https://api.github.com/repos/atrumin16/muntrume-site/releases/latest", {
    headers: { Accept: "application/vnd.github+json" }
  }).then(function (res) {
    return res.ok ? res.json() : null;
  }).then(function (data) {
    if (!data || String(data.tag_name || "").indexOf("desktop-v") !== 0) return;
    version.textContent = String(data.tag_name).replace(/^desktop-v/, "");
    var assets = data.assets || [];
    var exe = null;
    for (var i = 0; i < assets.length; i++) {
      if (/-setup\.exe$/i.test(assets[i].name || "")) exe = assets[i];
    }
    if (exe && typeof exe.size === "number") {
      size.textContent = (exe.size / 1048576).toLocaleString("es-ES", { maximumFractionDigits: 1 }) + " MB";
    }
  }).catch(function () {});
})();
