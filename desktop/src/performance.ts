import { inTauri } from "./env";

export interface RaceSessionEntry {
  subSessionId: number;
  fecha: string;
  circuito: string;
  coche: string;
  tipoSesion: string;
  posSalida: number;
  posFinal: number;
  incidentes: number;
  deltaIRating: number;
  mejorVuelta: number;
  vueltaMedia: number;
  consistenciaPct: number;
  vueltasValidas?: number;
  favorite?: boolean;
  ibtPath?: string;
}

export interface StreakSummary {
  cleanRaceStreak: number;
  top5PodiumStreak: number;
  validLapsStreak: number;
  netPositionsGained10: number;
  avgConsistencyPct: number;
  totalRaces: number;
}

export interface RaceHistoryResponse {
  sessions: RaceSessionEntry[];
  streaks: StreakSummary;
}

const LOCAL_FALLBACK_KEY = "mmt_race_history_v2";

function formatLapSec(sec: number): string {
  if (!Number.isFinite(sec) || sec <= 0) return "--:--.---";
  const m = Math.floor(sec / 60);
  const s = (sec % 60).toFixed(3).padStart(6, "0");
  return `${m}:${s}`;
}

function escapeHtml(s: string): string {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function computeLocalStreaks(sessions: RaceSessionEntry[]): StreakSummary {
  const races = sessions.filter((s) => s.tipoSesion.toLowerCase().includes("race"));
  const src = races.length > 0 ? races : sessions;
  let cleanRaceStreak = 0;
  for (const s of src) {
    if (s.incidentes < 4) cleanRaceStreak++;
    else break;
  }
  let top5PodiumStreak = 0;
  for (const s of src) {
    if (s.posFinal > 0 && s.posFinal <= 5) top5PodiumStreak++;
    else break;
  }
  let validLapsStreak = 0;
  for (const s of sessions) {
    if (s.incidentes === 0) validLapsStreak += Math.max(1, s.vueltasValidas ?? 1);
    else break;
  }
  const last10 = src.slice(0, 10);
  let netPositionsGained10 = 0;
  let sumCons = 0;
  let cntCons = 0;
  for (const s of last10) {
    if (s.posSalida > 0 && s.posFinal > 0) netPositionsGained10 += s.posSalida - s.posFinal;
    if (s.consistenciaPct > 0) {
      sumCons += s.consistenciaPct;
      cntCons++;
    }
  }
  return {
    cleanRaceStreak,
    top5PodiumStreak,
    validLapsStreak,
    netPositionsGained10,
    avgConsistencyPct: cntCons > 0 ? Math.round((sumCons / cntCons) * 10) / 10 : 0,
    totalRaces: src.length,
  };
}

export async function fetchRaceHistory(): Promise<RaceHistoryResponse> {
  if (inTauri()) {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const res = await Promise.race<RaceHistoryResponse>([
        invoke<RaceHistoryResponse>("get_race_history"),
        new Promise<RaceHistoryResponse>((_, reject) => setTimeout(() => reject(new Error("timeout")), 1500)),
      ]);
      try {
        localStorage.setItem(LOCAL_FALLBACK_KEY, JSON.stringify(res.sessions || []));
      } catch {}
      return res;
    } catch {
      // Fallback immediately to cached race_history.json snapshot in localStorage
    }
  }
  try {
    const raw = localStorage.getItem(LOCAL_FALLBACK_KEY);
    const sessions: RaceSessionEntry[] = raw ? JSON.parse(raw) : [];
    return { sessions, streaks: computeLocalStreaks(sessions) };
  } catch {
    return { sessions: [], streaks: computeLocalStreaks([]) };
  }
}

export async function recordRaceSession(entry: RaceSessionEntry): Promise<RaceHistoryResponse> {
  if (inTauri()) {
    const { invoke } = await import("@tauri-apps/api/core");
    return invoke<RaceHistoryResponse>("record_race_session", { entry });
  }
  const cur = await fetchRaceHistory();
  const next = [entry, ...cur.sessions.filter((s) => s.subSessionId !== entry.subSessionId)].slice(0, 50);
  try {
    localStorage.setItem(LOCAL_FALLBACK_KEY, JSON.stringify(next));
  } catch {}
  return { sessions: next, streaks: computeLocalStreaks(next) };
}

export async function toggleFavoriteRace(subSessionId: number): Promise<RaceHistoryResponse> {
  if (inTauri()) {
    const { invoke } = await import("@tauri-apps/api/core");
    return invoke<RaceHistoryResponse>("toggle_favorite_session", { subSessionId });
  }
  const cur = await fetchRaceHistory();
  const next = cur.sessions.map((s) => (s.subSessionId === subSessionId ? { ...s, favorite: !s.favorite } : s));
  try {
    localStorage.setItem(LOCAL_FALLBACK_KEY, JSON.stringify(next));
  } catch {}
  return { sessions: next, streaks: computeLocalStreaks(next) };
}

function ringSvg(pct: number, color: string): string {
  const r = 18;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, pct));
  const offset = c - (clamped / 100) * c;
  return `
    <svg width="46" height="46" viewBox="0 0 46 46" class="shrink-0">
      <circle cx="23" cy="23" r="${r}" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="4" />
      <circle cx="23" cy="23" r="${r}" fill="none" stroke="${color}" stroke-width="4"
        stroke-linecap="round" stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${offset.toFixed(1)}"
        transform="rotate(-90 23 23)" class="mmt-perf-ring" />
    </svg>
  `;
}

export function unmountPerformanceDashboard(): void {
  const host = document.getElementById("perfDashboardRoot");
  if (host) host.innerHTML = "";
}

export async function mountPerformanceDashboard(): Promise<void> {
  const host = document.getElementById("perfDashboardRoot");
  if (!host) return;

  const data = await fetchRaceHistory();
  const { streaks, sessions } = data;
  const consColor = streaks.avgConsistencyPct >= 97 ? "#10b981" : streaks.avgConsistencyPct >= 94 ? "#f59e0b" : "#f43f5e";
  const cleanPct = Math.min(100, streaks.cleanRaceStreak * 20);
  const top5Pct = Math.min(100, streaks.top5PodiumStreak * 25);
  const netSign = streaks.netPositionsGained10 > 0 ? "+" : "";
  const netColor = streaks.netPositionsGained10 >= 0 ? "text-emerald-400" : "text-rose-400";

  const cardsHtml = `
    <div class="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
      <div class="mmt-perf-card rounded-xl p-3.5 bg-[#0e131a]/85 backdrop-blur border border-emerald-500/25 flex items-center justify-between gap-3" style="animation-delay:0ms">
        <div>
          <span class="font-mono text-[10px] uppercase tracking-wider text-r-muted block">🔥 Racha Limpia</span>
          <strong class="font-display text-3xl text-white leading-none mt-1 block">${streaks.cleanRaceStreak}</strong>
          <span class="font-mono text-[10px] text-emerald-400">${streaks.validLapsStreak}v sin off-track</span>
        </div>
        ${ringSvg(cleanPct, "#10b981")}
      </div>
      <div class="mmt-perf-card rounded-xl p-3.5 bg-[#0e131a]/85 backdrop-blur border border-emerald-500/25 flex items-center justify-between gap-3" style="animation-delay:80ms">
        <div>
          <span class="font-mono text-[10px] uppercase tracking-wider text-r-muted block">🏆 Top 5 / Podios</span>
          <strong class="font-display text-3xl text-white leading-none mt-1 block">${streaks.top5PodiumStreak}</strong>
          <span class="font-mono text-[10px] text-amber-300">${streaks.totalRaces} carreras</span>
        </div>
        ${ringSvg(top5Pct, "#f59e0b")}
      </div>
      <div class="mmt-perf-card rounded-xl p-3.5 bg-[#0e131a]/85 backdrop-blur border border-emerald-500/25 flex items-center justify-between gap-3" style="animation-delay:160ms">
        <div>
          <span class="font-mono text-[10px] uppercase tracking-wider text-r-muted block">🎯 Consistencia</span>
          <strong class="font-display text-3xl text-white leading-none mt-1 block">${streaks.avgConsistencyPct > 0 ? `${streaks.avgConsistencyPct.toFixed(1)}%` : "--"}</strong>
          <span class="font-mono text-[10px] text-r-muted">Ritmo últimas 10</span>
        </div>
        ${ringSvg(streaks.avgConsistencyPct, consColor)}
      </div>
      <div class="mmt-perf-card rounded-xl p-3.5 bg-[#0e131a]/85 backdrop-blur border border-emerald-500/25 flex items-center justify-between gap-3" style="animation-delay:240ms">
        <div>
          <span class="font-mono text-[10px] uppercase tracking-wider text-r-muted block">📈 Pos. Ganadas</span>
          <strong class="font-display text-3xl ${netColor} leading-none mt-1 block">${netSign}${streaks.netPositionsGained10}</strong>
          <span class="font-mono text-[10px] text-r-muted">Últimas 10 carreras</span>
        </div>
        <span class="text-2xl opacity-75">⚡</span>
      </div>
    </div>
  `;

  const last10 = sessions.slice(0, 10);
  const rowsHtml = last10.length
    ? last10
        .map((s) => {
          const delta = s.posSalida > 0 && s.posFinal > 0 ? s.posSalida - s.posFinal : 0;
          const deltaBadge =
            delta > 0
              ? `<span class="text-emerald-400 font-bold">▲ +${delta}</span>`
              : delta < 0
              ? `<span class="text-rose-400 font-bold">▼ ${delta}</span>`
              : `<span class="text-r-muted">• 0</span>`;
          const incBadge =
            s.incidentes === 0
              ? `<span class="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-400/30 font-bold">0x</span>`
              : `<span class="px-1.5 py-0.5 rounded bg-white/10 text-white/80">${s.incidentes}x</span>`;
          return `
            <details class="rounded-xl border border-r-line bg-r-surface/80 overflow-hidden">
              <summary class="px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-3 cursor-pointer hover:bg-white/[0.03] font-mono text-xs select-none">
                <div class="flex items-center gap-2.5 min-w-0">
                  <span class="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-300">${escapeHtml(s.tipoSesion)}</span>
                  <strong class="text-white truncate">${escapeHtml(s.circuito)}</strong>
                  <span class="text-r-muted truncate hidden sm:inline">${escapeHtml(s.coche)}</span>
                </div>
                <div class="flex items-center gap-3 shrink-0 tabular-nums">
                  <span class="text-white font-bold">P${s.posFinal || "-"}</span>
                  ${deltaBadge}
                  ${incBadge}
                  <span class="text-r-accent">${formatLapSec(s.mejorVuelta)}</span>
                  <button type="button" data-perf-fav="${s.subSessionId}" class="px-2 py-0.5 rounded border border-r-line text-[10px] ${s.favorite ? "bg-amber-500/20 text-amber-300 border-amber-400/40" : "text-r-muted"}" title="Proteger .ibt">${s.favorite ? "★ Favorita" : "☆"}</button>
                </div>
              </summary>
              <div class="px-3.5 py-2.5 border-t border-r-line/60 bg-r-bg/50 grid sm:grid-cols-4 gap-2 font-mono text-[11px] text-r-muted tabular-nums">
                <div>Fecha: <strong class="text-r-text">${escapeHtml(s.fecha)}</strong></div>
                <div>Vuelta media: <strong class="text-r-text">${formatLapSec(s.vueltaMedia)}</strong></div>
                <div>Consistencia: <strong class="text-emerald-400">${s.consistenciaPct.toFixed(1)}%</strong></div>
                <div>Δ iRating: <strong class="${s.deltaIRating >= 0 ? "text-emerald-400" : "text-rose-400"}">${s.deltaIRating >= 0 ? "+" : ""}${s.deltaIRating}</strong></div>
              </div>
            </details>
          `;
        })
        .join("")
    : `<div class="p-6 rounded-xl border border-r-line bg-r-surface/60 text-center font-mono text-xs text-r-muted">Completa una sesión en iRacing para registrar tu primera carrera, rachas y consistencia.</div>`;

  host.innerHTML = `
    ${cardsHtml}
    <div class="space-y-2 mt-4">
      <div class="flex items-center justify-between">
        <h3 class="font-mono text-[11px] uppercase tracking-wider text-r-muted font-bold">Timeline de últimas carreras</h3>
        <span class="font-mono text-[10px] text-r-muted">Local · race_history.json (máx. 50)</span>
      </div>
      <div class="space-y-2">${rowsHtml}</div>
    </div>
  `;

  host.querySelectorAll<HTMLButtonElement>("[data-perf-fav]").forEach((btn) => {
    btn.addEventListener("click", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      const id = Number(btn.dataset.perfFav || 0);
      if (!id) return;
      void toggleFavoriteRace(id).then(() => mountPerformanceDashboard());
    });
  });
}

export async function showPostRaceRecapModal(entry: RaceSessionEntry): Promise<void> {
  const modal = document.getElementById("postRaceRecapModal");
  if (!modal) return;
  const res = await recordRaceSession(entry);
  const delta = entry.posSalida > 0 && entry.posFinal > 0 ? entry.posSalida - entry.posFinal : 0;

  const setTxt = (id: string, txt: string) => {
    const el = document.getElementById(id);
    if (el) el.textContent = txt;
  };
  setTxt("recapTrackCar", `${entry.circuito} · ${entry.coche}`);
  setTxt("recapFinalPos", `P${entry.posFinal || "-"}`);
  setTxt("recapGain", `${delta > 0 ? "+" : ""}${delta}`);
  setTxt("recapConsistency", `${entry.consistenciaPct.toFixed(1)}%`);
  setTxt("recapBestLap", formatLapSec(entry.mejorVuelta));
  setTxt("recapStreak", `${res.streaks.cleanRaceStreak} carreras limpias · ${res.streaks.top5PodiumStreak} Top 5`);

  const favBtn = document.getElementById("recapFavBtn") as HTMLButtonElement | null;
  if (favBtn) {
    favBtn.textContent = entry.favorite ? "★ Sesión Favorita Guardada" : "★ Guardar como Sesión Favorita";
    favBtn.onclick = () => {
      void toggleFavoriteRace(entry.subSessionId).then((updated) => {
        const saved = updated.sessions.find((s) => s.subSessionId === entry.subSessionId);
        favBtn.textContent = saved?.favorite ? "★ Sesión Favorita Guardada" : "★ Guardar como Sesión Favorita";
      });
    };
  }
  const closeBtn = document.getElementById("recapCloseBtn");
  if (closeBtn) {
    closeBtn.onclick = () => {
      modal.hidden = true;
    };
  }
  modal.hidden = false;
}
