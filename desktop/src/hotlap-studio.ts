import { inTauri } from "./env";

export interface HotlapRefResult {
  videoId: string;
  title: string;
  channel: string;
  lapTime: string | null;
  thumbnailUrl: string;
  embedUrl: string;
}

export interface ReplayClipInfo {
  path: string;
  filename: string;
  sizeMb: number;
  modifiedEpoch: number;
}

function escapeHtml(s: string): string {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function parseLapSeconds(lapStr: string | null): number {
  if (!lapStr) return 0;
  const parts = lapStr.split(":");
  if (parts.length !== 2) return 0;
  return Number(parts[0]) * 60 + Number(parts[1]);
}

export function unmountHotlapStudio(): void {
  const mount = document.getElementById("hotlapStudioMount");
  if (mount) {
    mount.innerHTML = "";
    mount.hidden = true;
  }
}

export async function mountHotlapStudio(params: {
  car: string;
  track: string;
  season?: string;
  myBestLapStr?: string;
  myBestLapSec?: number;
  videosDir?: string;
}): Promise<void> {
  const mount = document.getElementById("hotlapStudioMount");
  if (!mount) return;
  mount.hidden = false;
  mount.innerHTML = `<div class="p-4 text-center font-mono text-xs text-r-muted">Buscando hotlap de referencia (HYMO / VRS / GnG)…</div>`;

  let ref: HotlapRefResult | null = null;
  let clip: ReplayClipInfo | null = null;

  if (inTauri()) {
    const { invoke } = await import("@tauri-apps/api/core");
    const [refRes, clipRes] = await Promise.allSettled([
      invoke<HotlapRefResult>("find_reference_hotlap", {
        car: params.car || "Ferrari 296 GT3",
        track: params.track || "Fuji Speedway",
        season: params.season || "2026",
      }),
      params.videosDir
        ? invoke<ReplayClipInfo | null>("find_latest_replay_clip", { dir: params.videosDir })
        : Promise.resolve(null),
    ]);
    if (refRes.status === "fulfilled") ref = refRes.value;
    if (clipRes.status === "fulfilled") clip = clipRes.value;
  }

  const refSec = parseLapSeconds(ref?.lapTime || null);
  const mySec = params.myBestLapSec || 0;
  const diffStr = mySec > 0 && refSec > 0 ? `${mySec - refSec >= 0 ? "+" : ""}${(mySec - refSec).toFixed(3)}s` : "—";

  let localMediaHtml = `
    <div class="h-56 rounded-xl border border-r-line bg-black/50 flex flex-col items-center justify-center p-4 text-center gap-3">
      <p class="font-mono text-xs text-r-muted">Sin clip local detectado en tu carpeta de vídeos (ShadowPlay / OBS).</p>
      <button type="button" id="hotlapLaunchIrReplay" class="px-3 py-1.5 rounded-lg bg-r-accent/15 border border-r-accent/40 text-r-accent font-mono text-xs font-bold hover:bg-r-accent/25">Ver en iRacing Replay</button>
    </div>
  `;

  if (clip && inTauri()) {
    const { convertFileSrc } = await import("@tauri-apps/api/core");
    const src = convertFileSrc(clip.path);
    localMediaHtml = `
      <video id="hotlapLocalVideo" controls class="w-full h-56 rounded-xl bg-black border border-r-line object-contain" src="${escapeHtml(src)}"></video>
      <div class="mt-1 font-mono text-[10px] text-r-muted truncate">${escapeHtml(clip.filename)} (${clip.sizeMb} MB)</div>
    `;
  }

  const ytHtml = ref
    ? `<iframe id="hotlapYtFrame" class="w-full h-56 rounded-xl border border-r-line bg-black" src="${escapeHtml(ref.embedUrl)}" title="${escapeHtml(ref.title)}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
       <div class="mt-1 font-mono text-[10px] text-r-muted truncate">${escapeHtml(ref.channel)} · ${escapeHtml(ref.title)}</div>`
    : `<div class="h-56 rounded-xl border border-r-line bg-black/50 flex items-center justify-center font-mono text-xs text-r-muted">No se encontró referencia en YouTube para ${escapeHtml(params.car)} en ${escapeHtml(params.track)}.</div>`;

  mount.innerHTML = `
    <div class="space-y-3">
      <div class="grid sm:grid-cols-4 gap-2 p-2.5 rounded-xl bg-r-bg/70 border border-r-line font-mono text-xs tabular-nums">
        <div><span class="text-r-muted block text-[10px]">TU MEJOR VUELTA</span><strong class="text-white">${escapeHtml(params.myBestLapStr || "--:--.---")}</strong></div>
        <div><span class="text-r-muted block text-[10px]">REFERENCIA (${escapeHtml(ref?.channel || "YT")})</span><strong class="text-emerald-400">${escapeHtml(ref?.lapTime || "--:--.---")}</strong></div>
        <div><span class="text-r-muted block text-[10px]">DIFERENCIA TOTAL</span><strong class="text-amber-300">${diffStr}</strong></div>
        <div><span class="text-r-muted block text-[10px]">SECTORES</span><strong class="text-r-muted text-[11px]">S1 / S2 / S3</strong></div>
      </div>

      <div class="flex flex-wrap items-center gap-1.5 font-mono text-[11px]">
        <button type="button" data-hotlap-seek="0" class="px-2.5 py-1 rounded-lg bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 font-bold">Sincronizar Paso por Meta</button>
        <button type="button" data-hotlap-seek="8" class="px-2 py-1 rounded-lg border border-r-line text-r-muted hover:text-white">Curva 1</button>
        <button type="button" data-hotlap-seek="25" class="px-2 py-1 rounded-lg border border-r-line text-r-muted hover:text-white">Sector 1</button>
        <button type="button" data-hotlap-seek="52" class="px-2 py-1 rounded-lg border border-r-line text-r-muted hover:text-white">Sector 2</button>
        <button type="button" data-hotlap-seek="76" class="px-2 py-1 rounded-lg border border-r-line text-r-muted hover:text-white">Sector 3</button>
        <button type="button" id="hotlapCloseBtn" class="ml-auto px-2.5 py-1 rounded-lg border border-rose-500/40 text-rose-300">Cerrar Studio</button>
      </div>

      <div class="grid lg:grid-cols-2 gap-3">
        <div>
          <p class="font-mono text-[10px] uppercase tracking-wider text-r-muted mb-1">Tu Mejor Vuelta</p>
          ${localMediaHtml}
        </div>
        <div>
          <p class="font-mono text-[10px] uppercase tracking-wider text-r-muted mb-1">Referencia HYMO / VRS / GnG</p>
          ${ytHtml}
        </div>
      </div>
    </div>
  `;

  mount.querySelectorAll<HTMLButtonElement>("[data-hotlap-seek]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const sec = Number(btn.dataset.hotlapSeek || 0);
      const localVid = document.getElementById("hotlapLocalVideo") as HTMLVideoElement | null;
      if (localVid) {
        localVid.currentTime = sec;
        void localVid.play().catch(() => {});
      }
      const yt = document.getElementById("hotlapYtFrame") as HTMLIFrameElement | null;
      if (yt?.contentWindow) {
        yt.contentWindow.postMessage(JSON.stringify({ event: "command", func: "seekTo", args: [sec, true] }), "*");
        yt.contentWindow.postMessage(JSON.stringify({ event: "command", func: "playVideo", args: [] }), "*");
      }
    });
  });

  document.getElementById("hotlapCloseBtn")?.addEventListener("click", () => {
    unmountHotlapStudio();
  });
}
