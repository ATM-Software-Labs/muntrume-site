/* Muntrume Motorsport — Live Setup Ratings & MMT Steward Bot Comments Widget */
(function () {
  "use strict";

  var API = "https://muntrume.atrumin16.workers.dev/api/setups/reviews";
  var MOODS = {
    1: { emoji: "😤", label: "Intratable" },
    2: { emoji: "😕", label: "Difícil" },
    3: { emoji: "😐", label: "Correcto" },
    4: { emoji: "🙂", label: "Muy bueno" },
    5: { emoji: "🤩", label: "Volando · Top" }
  };

  function esc(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function moodMeta(val) {
    var n = Math.max(1, Math.min(5, Math.round(Number(val) || 4)));
    return MOODS[n] || MOODS[4];
  }

  function fmtDeltaMs(ms) {
    if (ms == null || !Number.isFinite(Number(ms))) return "";
    var s = Number(ms) / 1000;
    return (s >= 0 ? "+" : "") + s.toFixed(2) + "s vs Top Split";
  }

  function ensureModal() {
    var existing = document.getElementById("mmtReviewModal");
    if (existing) return existing;
    var modal = document.createElement("div");
    modal.id = "mmtReviewModal";
    modal.hidden = true;
    modal.style.cssText =
      "position:fixed;inset:0;z-index:999;display:none;align-items:center;justify-content:center;padding:16px;background:rgba(4,8,10,0.78);backdrop-filter:blur(6px);";
    modal.innerHTML =
      '<div style="width:100%;max-width:490px;border-radius:18px;border:1px solid var(--r-line,rgba(255,255,255,0.14));background:var(--r-surface,#0f1419);color:var(--r-text,#f3f6fa);padding:22px;box-shadow:0 24px 64px rgba(0,0,0,0.55);font-family:var(--r-sans,system-ui,sans-serif)">' +
        '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px">' +
          '<div>' +
            '<span style="font:700 10.5px/1 ui-monospace,monospace;text-transform:uppercase;letter-spacing:0.08em;color:var(--r-accent,#00e699)">Feedback Post-Stint · MMT Steward Bot</span>' +
            '<h3 style="margin:4px 0 0;font-size:18px;font-weight:800">¿Cómo te fue este setup?</h3>' +
          '</div>' +
          '<button type="button" id="mmtRevClose" aria-label="Cerrar" style="width:32px;height:32px;border-radius:8px;border:1px solid var(--r-line,rgba(255,255,255,0.14));background:transparent;color:var(--r-text,#fff);cursor:pointer;font-size:18px">×</button>' +
        '</div>' +
        '<form id="mmtRevForm" style="display:grid;gap:12px">' +
          '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">' +
            '<label style="display:grid;gap:4px;font-size:11.5px;color:var(--r-muted,#94a3b8)">Setup (.sto)' +
              '<input id="mmtRevSetup" required maxlength="140" placeholder="MMT_F296_SPA_END_V2.sto" style="padding:8px 10px;border-radius:10px;border:1px solid var(--r-line,rgba(255,255,255,0.14));background:var(--r-bg-2,#151c24);color:var(--r-text,#fff);font:600 12px ui-monospace,monospace" />' +
            '</label>' +
            '<label style="display:grid;gap:4px;font-size:11.5px;color:var(--r-muted,#94a3b8)">Circuito' +
              '<input id="mmtRevTrack" maxlength="96" placeholder="Spa-Francorchamps" style="padding:8px 10px;border-radius:10px;border:1px solid var(--r-line,rgba(255,255,255,0.14));background:var(--r-bg-2,#151c24);color:var(--r-text,#fff);font-size:12.5px" />' +
            '</label>' +
          '</div>' +
          '<input type="hidden" id="mmtRevCar" />' +
          '<div>' +
            '<span style="display:block;font-size:11.5px;color:var(--r-muted,#94a3b8);margin-bottom:6px">Sensación en pista</span>' +
            '<div id="mmtRevMoods" style="display:grid;grid-template-columns:repeat(5,1fr);gap:6px">' +
              [1, 2, 3, 4, 5].map(function (n) {
                var m = MOODS[n];
                return '<button type="button" data-mood="' + n + '" style="display:flex;flex-direction:column;align-items:center;gap:3px;padding:8px 4px;border-radius:10px;border:1px solid var(--r-line,rgba(255,255,255,0.14));background:var(--r-bg-2,#151c24);color:var(--r-text,#fff);cursor:pointer;font-size:10px">' +
                  '<span style="font-size:20px;line-height:1">' + m.emoji + '</span><span>' + m.label.split(" ")[0] + '</span></button>';
              }).join("") +
            '</div>' +
          '</div>' +
          '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">' +
            '<label style="display:grid;gap:4px;font-size:11.5px;color:var(--r-muted,#94a3b8)">Delta vs mejor vuelta Top Split' +
              '<input id="mmtRevDelta" maxlength="24" placeholder="+0.35s" style="padding:8px 10px;border-radius:10px;border:1px solid var(--r-line,rgba(255,255,255,0.14));background:var(--r-bg-2,#151c24);color:var(--r-text,#fff);font:700 12.5px ui-monospace,monospace" />' +
            '</label>' +
            '<label style="display:grid;gap:4px;font-size:11.5px;color:var(--r-muted,#94a3b8)">Tu tiempo promedio' +
              '<input id="mmtRevAvg" maxlength="24" placeholder="2:18.450" style="padding:8px 10px;border-radius:10px;border:1px solid var(--r-line,rgba(255,255,255,0.14));background:var(--r-bg-2,#151c24);color:var(--r-text,#fff);font:700 12.5px ui-monospace,monospace" />' +
            '</label>' +
          '</div>' +
          '<label style="display:grid;gap:4px;font-size:11.5px;color:var(--r-muted,#94a3b8)">Tu nombre / dorsal' +
            '<input id="mmtRevDriver" maxlength="64" placeholder="Ej. #16 Alberto Trujillo" style="padding:8px 10px;border-radius:10px;border:1px solid var(--r-line,rgba(255,255,255,0.14));background:var(--r-bg-2,#151c24);color:var(--r-text,#fff);font-size:12.5px" />' +
          '</label>' +
          '<label style="display:grid;gap:4px;font-size:11.5px;color:var(--r-muted,#94a3b8)">Notas del setup (balance, frenada, degradación)' +
            '<textarea id="mmtRevComment" rows="3" maxlength="380" placeholder="Ej. Muy estable en Pouhon, permite bajar 1 clic de BB a mitad de stint..." style="padding:8px 10px;border-radius:10px;border:1px solid var(--r-line,rgba(255,255,255,0.14));background:var(--r-bg-2,#151c24);color:var(--r-text,#fff);font-size:12.5px;resize:vertical"></textarea>' +
          '</label>' +
          '<div id="mmtRevNotice" style="display:none;font:600 12px/1.4 ui-monospace,monospace;padding:8px 10px;border-radius:9px"></div>' +
          '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px">' +
            '<span style="font:600 10.5px ui-monospace,monospace;color:var(--r-muted,#94a3b8)">🛡 Revisado por MMT Steward Bot</span>' +
            '<button type="submit" id="mmtRevSubmit" style="padding:9px 16px;border-radius:10px;border:0;background:var(--r-accent,#00e699);color:#04130d;font-weight:800;font-size:12.5px;cursor:pointer">Publicar valoración</button>' +
          '</div>' +
        '</form>' +
      '</div>';

    document.body.appendChild(modal);

    var selectedMood = 4;
    function paintMood(val) {
      selectedMood = val;
      modal.querySelectorAll("[data-mood]").forEach(function (b) {
        var on = Number(b.getAttribute("data-mood")) === selectedMood;
        b.style.borderColor = on ? "var(--r-accent,#00e699)" : "var(--r-line,rgba(255,255,255,0.14))";
        b.style.background = on ? "rgba(0,230,153,0.14)" : "var(--r-bg-2,#151c24)";
      });
    }
    paintMood(4);

    modal.querySelectorAll("[data-mood]").forEach(function (b) {
      b.addEventListener("click", function () { paintMood(Number(b.getAttribute("data-mood"))); });
    });

    function close() {
      modal.hidden = true;
      modal.style.display = "none";
    }
    modal.querySelector("#mmtRevClose").addEventListener("click", close);
    modal.addEventListener("click", function (e) { if (e.target === modal) close(); });

    modal.querySelector("#mmtRevForm").addEventListener("submit", async function (e) {
      e.preventDefault();
      var btn = modal.querySelector("#mmtRevSubmit");
      var notice = modal.querySelector("#mmtRevNotice");
      btn.disabled = true;
      btn.textContent = "Verificando con Bot…";
      notice.style.display = "none";
      try {
        var res = await fetch(API, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            setupFile: modal.querySelector("#mmtRevSetup").value.trim(),
            carKey: modal.querySelector("#mmtRevCar").value.trim(),
            track: modal.querySelector("#mmtRevTrack").value.trim(),
            driverName: modal.querySelector("#mmtRevDriver").value.trim() || "Piloto MMT",
            mood: selectedMood,
            deltaTopSplit: modal.querySelector("#mmtRevDelta").value.trim(),
            avgLapTime: modal.querySelector("#mmtRevAvg").value.trim(),
            comment: modal.querySelector("#mmtRevComment").value.trim(),
            source: "web"
          })
        });
        var data = await res.json().catch(function () { return {}; });
        notice.style.display = "block";
        if (res.ok && data.success) {
          notice.style.background = data.published ? "rgba(16,185,129,0.14)" : "rgba(245,158,11,0.14)";
          notice.style.color = data.published ? "#10b981" : "#f59e0b";
          notice.textContent = data.message || "Valoración guardada.";
          if (data.published) {
            modal.querySelector("#mmtRevComment").value = "";
            hydrateAll();
            setTimeout(close, 1300);
          }
        } else {
          notice.style.background = "rgba(244,63,94,0.14)";
          notice.style.color = "#f43f5e";
          notice.textContent = data.error || "No se pudo guardar la valoración.";
        }
      } catch (err) {
        notice.style.display = "block";
        notice.style.background = "rgba(244,63,94,0.14)";
        notice.style.color = "#f43f5e";
        notice.textContent = "Error de conexión al enviar la valoración.";
      } finally {
        btn.disabled = false;
        btn.textContent = "Publicar valoración";
      }
    });

    modal._openWith = function (opts) {
      opts = opts || {};
      modal.querySelector("#mmtRevSetup").value = opts.setup || "";
      modal.querySelector("#mmtRevCar").value = opts.car || "";
      modal.querySelector("#mmtRevTrack").value = opts.track || "";
      var notice = modal.querySelector("#mmtRevNotice");
      if (notice) notice.style.display = "none";
      try {
        var rawUser = localStorage.getItem("mrt_vault_user") || sessionStorage.getItem("mrt_vault_user");
        var u = rawUser ? JSON.parse(rawUser) : null;
        if (u && u.name && !modal.querySelector("#mmtRevDriver").value) {
          modal.querySelector("#mmtRevDriver").value = u.name;
        }
      } catch (e) {}
      paintMood(4);
      modal.hidden = false;
      modal.style.display = "flex";
    };
    return modal;
  }

  window.openMmtSetupReviewModal = function (opts) {
    var modal = ensureModal();
    modal._openWith(opts);
  };

  async function hydrateAll() {
    var data;
    try {
      var res = await fetch(API + "?limit=36");
      if (!res.ok) return;
      data = await res.json();
    } catch (e) { return; }
    if (!data || !data.success) return;

    var reviews = data.reviews || [];
    var topSetups = data.topSetups || [];
    var stats = data.stats || {};

    // 1. Hydrate pilot profile featured setup cards ([data-setup-rating-slot])
    document.querySelectorAll("[data-setup-rating-slot]").forEach(function (slot) {
      var carKey = (slot.getAttribute("data-car-key") || "").toLowerCase();
      var setupFile = slot.getAttribute("data-setup-file") || "";
      var match = topSetups.find(function (t) {
        return (setupFile && t.setup_file === setupFile) || (carKey && String(t.car_key || "").toLowerCase() === carKey);
      });
      var carRevs = reviews.filter(function (r) {
        return (setupFile && r.setup_file === setupFile) || (carKey && String(r.car_key || "").toLowerCase() === carKey);
      });
      if (!match && !carRevs.length) {
        slot.innerHTML =
          '<span style="font:600 11px ui-monospace,monospace;color:var(--r-muted)">⭐ Destacado MMT · Sin valoraciones aún</span>';
        return;
      }
      var avgMood = match ? match.avg_mood : carRevs[0].mood;
      var m = moodMeta(avgMood);
      var deltaStr = match && match.avg_delta_ms != null
        ? fmtDeltaMs(match.avg_delta_ms)
        : (carRevs[0] && carRevs[0].delta_top_split ? carRevs[0].delta_top_split + " vs Top Split" : "");
      var avgLap = carRevs[0] && carRevs[0].avg_lap_time ? " · Media " + carRevs[0].avg_lap_time : "";
      var latestComment = carRevs.find(function (r) { return r.comment; });

      slot.innerHTML =
        '<div style="display:flex;flex-wrap:wrap;align-items:center;gap:6px;font:700 11px ui-monospace,monospace">' +
          '<span style="padding:2px 7px;border-radius:999px;background:rgba(0,230,153,0.14);color:var(--r-accent,#00e699)">' + m.emoji + ' ' + Number(avgMood).toFixed(1) + '/5 (' + (match ? match.review_count : carRevs.length) + ')</span>' +
          (deltaStr ? '<span style="color:var(--r-text)">' + esc(deltaStr) + esc(avgLap) + '</span>' : '') +
        '</div>' +
        (latestComment
          ? '<p style="margin:6px 0 0;font-size:12px;color:var(--r-muted);line-height:1.4">“' + esc(latestComment.comment) + '” — <strong style="color:var(--r-text)">' + esc(latestComment.driver_name) + '</strong></p>'
          : '');
    });

    // 2. Hydrate Garage Community Reviews Feed (#garageReviewsFeed)
    var feed = document.getElementById("garageReviewsFeed");
    var statEl = document.getElementById("garageReviewsStat");
    if (statEl) {
      statEl.textContent =
        (stats.totalReviews || reviews.length) + " valoraciones verificadas · 🛡 MMT Steward Bot (" + (stats.botCleaned || 0) + " filtradas)";
    }
    if (feed) {
      if (!reviews.length) {
        feed.innerHTML =
          '<div style="grid-column:1/-1;padding:24px;border-radius:14px;border:1px dashed var(--r-line);text-align:center;color:var(--r-muted);font-size:13px">' +
            'Todavía no hay comentarios de pista. Sé el primero en valorar un setup desde <strong>MMT Sync</strong> o pulsando <strong>Valorar un setup</strong>.' +
          '</div>';
      } else {
        feed.innerHTML = reviews.slice(0, 9).map(function (r) {
          var m = moodMeta(r.mood);
          return (
            '<article style="padding:14px 16px;border-radius:14px;border:1px solid var(--r-line);background:var(--r-surface);display:flex;flex-direction:column;gap:8px">' +
              '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px">' +
                '<span style="font:700 12px ui-monospace,monospace;color:var(--r-accent)">' + m.emoji + ' ' + esc(m.label) + ' (' + r.mood + '/5)</span>' +
                '<span style="font:600 10.5px ui-monospace,monospace;color:var(--r-muted)">' + (r.source === "desktop" ? "MMT Sync App" : "Web") + '</span>' +
              '</div>' +
              '<code style="font-size:12px;font-weight:700;color:var(--r-text);word-break:break-all">' + esc(r.setup_file) + '</code>' +
              '<div style="display:flex;flex-wrap:wrap;gap:6px;font:600 11px ui-monospace,monospace;color:var(--r-muted)">' +
                (r.track ? '<span>📍 ' + esc(r.track) + '</span>' : '') +
                (r.delta_top_split ? '<span style="color:var(--r-text)">⚡ ' + esc(r.delta_top_split) + ' vs Top Split</span>' : '') +
                (r.avg_lap_time ? '<span>⏱ Promedio ' + esc(r.avg_lap_time) + '</span>' : '') +
              '</div>' +
              (r.comment ? '<p style="margin:0;font-size:12.5px;color:var(--r-text);line-height:1.45">“' + esc(r.comment) + '”</p>' : '') +
              '<div style="margin-top:auto;padding-top:6px;border-top:1px solid var(--r-line);display:flex;align-items:center;justify-content:space-between;font:600 11px ui-monospace,monospace;color:var(--r-muted)">' +
                '<span>' + esc(r.driver_name) + '</span>' +
                '<span title="Revisado por MMT Steward Bot">🛡 Bot OK</span>' +
              '</div>' +
            '</article>'
          );
        }).join("");
      }
    }
  }

  document.addEventListener("click", function (e) {
    var btn = e.target && e.target.closest ? e.target.closest("[data-open-setup-review]") : null;
    if (!btn) return;
    window.openMmtSetupReviewModal({
      setup: btn.getAttribute("data-setup") || "",
      car: btn.getAttribute("data-car") || "",
      track: btn.getAttribute("data-track") || ""
    });
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", hydrateAll);
  } else {
    hydrateAll();
  }
})();
