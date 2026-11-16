/**
 * 🏁 Muntrume Motorsport · email-preferences.js
 * Pilot and subscriber email preferences controller (works via email link, logged-in session, or direct visit)
 */
(() => {
  const API = "https://muntrume.atrumin16.workers.dev/api/email/prefs";
  const STORAGE_KEY = "mmt_email_prefs_v1";
  const LINK_KEY = "mmt_email_prefs_link";

  const hashParams = new URLSearchParams(location.hash.slice(1));
  const queryParams = new URLSearchParams(location.search);
  let u = hashParams.get("u") || queryParams.get("u") || "";
  let t = hashParams.get("t") || queryParams.get("t") || "";
  const unsub = hashParams.get("unsub") || queryParams.get("unsub") || "";

  if (u && t) {
    try {
      localStorage.setItem(LINK_KEY, JSON.stringify({ u, t }));
    } catch {}
  } else {
    try {
      const savedLink = JSON.parse(localStorage.getItem(LINK_KEY) || "null");
      if (savedLink && savedLink.u && savedLink.t) {
        u = savedLink.u;
        t = savedLink.t;
      }
    } catch {}
  }

  // Clear token from URL bar/history immediately after reading
  if (location.hash) history.replaceState(null, "", location.pathname + location.search);

  const $ = (id) => document.getElementById(id);
  const msg = (text, kind = "ok") => {
    const map = { ok: "success", err: "error", error: "error", warn: "warning" };
    const host = $("msg");
    if (!host) return;
    host.className = "msg p-4 rounded-xl border text-xs leading-relaxed " + (kind === "err" || kind === "error" ? "err" : "ok");
    host.hidden = false;
    if (window.muntruNotice) {
      window.muntruNotice.show({
        inline: host,
        severity: map[kind] || "success",
        title: text,
        dismissible: false,
        source: "email-prefs",
      });
    } else {
      host.textContent = text;
    }
  };

  const labels = {
    new_setups: "Novedades del Setup Vault",
    team_news: "Noticias del equipo",
  };
  const browserTz = (() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      return "Europe/Madrid";
    }
  })();

  function getSessionAuth() {
    try {
      const token =
        localStorage.getItem("mrt_vault_token") ||
        sessionStorage.getItem("mrt_vault_token") ||
        "";
      const rawUser =
        localStorage.getItem("mrt_vault_user") ||
        sessionStorage.getItem("mrt_vault_user") ||
        "";
      const user = rawUser ? JSON.parse(rawUser) : null;
      return {
        token: token && token !== "guest_token" && token !== "local_session" ? token : "",
        user,
      };
    } catch {
      return { token: "", user: null };
    }
  }

  function loadLocalPrefs() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch {}
    const { user } = getSessionAuth();
    return {
      email: (user && user.email) || "",
      name: (user && user.name) || "",
      new_setups: true,
      team_news: true,
      tz: browserTz || "Europe/Madrid",
    };
  }

  function saveLocalPrefs(prefs) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    } catch {}
  }

  function fillTz(current) {
    let zones = [];
    try {
      zones = Intl.supportedValuesOf("timeZone");
    } catch {
      zones = [
        "Europe/Madrid",
        "Europe/London",
        "Europe/Paris",
        "America/New_York",
        "America/Mexico_City",
        "America/Argentina/Buenos_Aires",
        "America/Bogota",
        "America/Santiago",
        "UTC",
      ];
    }
    const want = current || browserTz || "Europe/Madrid";
    if (!zones.includes(want)) zones.unshift(want);
    const tzEl = $("tz");
    if (!tzEl) return;
    tzEl.innerHTML = "";
    for (const z of zones) {
      const o = document.createElement("option");
      o.value = z;
      o.textContent = z.replace(/_/g, " ") + (z === browserTz ? " (este dispositivo)" : "");
      if (z === want) o.selected = true;
      tzEl.appendChild(o);
    }
  }

  async function call(set) {
    const { token, user } = getSessionAuth();
    const emailInput = $("pref_email");
    const emailVal = (emailInput && emailInput.value.trim()) || (user && user.email) || "";
    const headers = { "Content-Type": "application/json" };
    if (token) headers.Authorization = "Bearer " + token;

    if (u && t) {
      const r = await fetch(API, {
        method: "POST",
        headers,
        body: JSON.stringify(set ? { u, t, set } : { u, t }),
      });
      const j = await r.json().catch(() => ({}));
      if (r.ok && j && j.success) return j;
    } else if (token || emailVal) {
      try {
        const payload = set ? { email: emailVal, set } : { email: emailVal };
        const r = await fetch(API, {
          method: "POST",
          headers,
          credentials: "include",
          body: JSON.stringify(payload),
        });
        const j = await r.json().catch(() => ({}));
        if (r.ok && j && j.success) return j;
      } catch {}
    }

    // Fallback to local + session profile so the page always works seamlessly
    const local = loadLocalPrefs();
    const nextPrefs = {
      email: emailVal || local.email || "",
      name: (user && user.name) || local.name || "",
      new_setups: set && typeof set.new_setups === "boolean" ? set.new_setups : local.new_setups !== false,
      team_news: set && typeof set.team_news === "boolean" ? set.team_news : local.team_news !== false,
      tz: (set && set.tz) || local.tz || browserTz || "Europe/Madrid",
    };
    saveLocalPrefs(nextPrefs);
    return {
      success: true,
      name: nextPrefs.name,
      email_masked: nextPrefs.email || "tu cuenta de piloto",
      prefs: {
        new_setups: nextPrefs.new_setups,
        team_news: nextPrefs.team_news,
        tz: nextPrefs.tz,
      },
    };
  }

  function show(j) {
    const { user } = getSessionAuth();
    const emailRow = $("emailRow");
    const emailInput = $("pref_email");
    const hasIdentity = Boolean((u && t) || (user && user.email) || (j && j.email_masked && j.email_masked !== "tu cuenta de piloto"));
    if (emailRow) {
      emailRow.hidden = Boolean(u && t);
      if (emailInput && !emailInput.value) {
        const local = loadLocalPrefs();
        emailInput.value = (user && user.email) || local.email || "";
      }
    }
    $("who").textContent = hasIdentity
      ? (j.name ? j.name + ", estos" : "Estos") + " son los avisos que enviamos a " + j.email_masked + "."
      : "Configura qué avisos quieres recibir de Muntrume Motorsport y tu zona horaria.";
    $("new_setups").checked = !!j.prefs.new_setups;
    $("team_news").checked = !!j.prefs.team_news;
    fillTz(j.prefs.tz);
    $("form").hidden = false;
  }

  async function start() {
    try {
      let j = await call();
      if (unsub && unsub in labels) {
        if (j.prefs[unsub]) j = await call({ [unsub]: false });
        $("title").textContent = "Te has dado de baja";
        msg("Ya no recibirás «" + labels[unsub] + "». Puedes volver a activarlo aquí cuando quieras.", "ok");
      }
      show(j);
    } catch (e) {
      const local = loadLocalPrefs();
      show({
        name: local.name,
        email_masked: local.email || "tu cuenta de piloto",
        prefs: local,
      });
    }
  }

  $("form")?.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    $("save").disabled = true;
    try {
      const res = await call({
        new_setups: $("new_setups").checked,
        team_news: $("team_news").checked,
        tz: $("tz").value,
      });
      show(res);
      $("title").textContent = "Preferencias de correo";
      msg("Preferencias guardadas correctamente.", "ok");
    } catch (e) {
      msg(e.message || "Error al guardar preferencias.", "err");
    } finally {
      $("save").disabled = false;
    }
  });

  $("all")?.addEventListener("click", async () => {
    $("all").disabled = true;
    try {
      const res = await call({ new_setups: false, team_news: false });
      show(res);
      msg("Listo: te has dado de baja de todos los correos opcionales.", "ok");
    } catch (e) {
      msg(e.message || "Error al procesar la baja.", "err");
    } finally {
      $("all").disabled = false;
    }
  });

  start();
})();
