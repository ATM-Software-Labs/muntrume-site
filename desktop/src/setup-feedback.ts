/**
 * Post-Stint Setup Feedback Module for MMT Sync Desktop
 * Asks the driver how the setup performed (5 mood faces, delta vs Top Split best lap,
 * average stint lap time, and driver notes) and submits to muntru.me moderated by MMT Steward Bot.
 */

const REVIEWS_API = "https://muntrume.atrumin16.workers.dev/api/setups/reviews";

const MOODS = [
  { val: 1, emoji: "😤", label: "Intratable" },
  { val: 2, emoji: "😕", label: "Difícil" },
  { val: 3, emoji: "😐", label: "Correcto" },
  { val: 4, emoji: "🙂", label: "Muy bueno" },
  { val: 5, emoji: "🤩", label: "Volando" },
] as const;

export interface FeedbackPrefill {
  setupFile?: string;
  carKey?: string;
  track?: string;
  avgLapTime?: string;
  driverName?: string;
}

function readTelemetryContext(): FeedbackPrefill {
  const setupEl = document.getElementById("lsSetup");
  const carEl = document.getElementById("lsCarModel");
  const avgEl = document.getElementById("lsAvgTime");
  const pilotEl = document.getElementById("lsPilot");

  const rawSetup = (setupEl?.textContent || "").trim();
  const rawCar = (carEl?.textContent || "").trim();
  const rawAvg = (avgEl?.textContent || "").trim();
  const rawPilot = (pilotEl?.textContent || "").trim();

  const validSetup = rawSetup && !/esperando/i.test(rawSetup) ? rawSetup : "";
  const validCar = rawCar && !/ning[uú]n coche/i.test(rawCar) ? rawCar.toLowerCase().replace(/[^a-z0-9]/g, "") : "";
  const validAvg = rawAvg && !rawAvg.includes("--") ? rawAvg : "";

  return {
    setupFile: validSetup,
    carKey: validCar,
    avgLapTime: validAvg,
    driverName: rawPilot || "Piloto MMT",
  };
}

function ensureFeedbackModal(): HTMLDivElement {
  let modal = document.getElementById("mmtDesktopFeedbackModal") as HTMLDivElement | null;
  if (modal) return modal;

  modal = document.createElement("div");
  modal.id = "mmtDesktopFeedbackModal";
  modal.hidden = true;
  modal.className =
    "fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm";
  modal.innerHTML = `
    <div class="w-full max-w-lg rounded-2xl border border-r-line bg-r-surface text-r-text p-5 shadow-2xl space-y-4">
      <div class="flex items-start justify-between gap-3">
        <div>
          <span class="font-mono text-[10px] uppercase tracking-widest text-r-accent font-bold">Post-Stint Feedback · Web muntru.me</span>
          <h2 class="font-display text-xl font-extrabold text-white mt-0.5">¿Cómo te fue el setup en pista?</h2>
          <p class="text-[11px] text-r-muted mt-0.5">Tu valoración ayuda a destacar los mejores setups en la web (moderado por MMT Steward Bot).</p>
        </div>
        <button type="button" id="fbCloseBtn" aria-label="Cerrar" class="w-8 h-8 rounded-lg border border-r-line hover:border-r-accent text-r-muted hover:text-white flex items-center justify-center cursor-pointer">×</button>
      </div>

      <form id="fbForm" class="space-y-3 text-xs">
        <div class="grid grid-cols-2 gap-2.5">
          <label class="block space-y-1">
            <span class="font-mono text-[10px] uppercase text-r-muted">Setup (.sto) *</span>
            <input id="fbSetupFile" required maxlength="140" placeholder="MMT_F296_SPA_END_V2.sto" class="w-full px-3 py-2 rounded-xl border border-r-line bg-r-bg text-r-text font-mono text-xs focus:border-r-accent outline-none" />
          </label>
          <label class="block space-y-1">
            <span class="font-mono text-[10px] uppercase text-r-muted">Circuito</span>
            <input id="fbTrack" maxlength="96" placeholder="Spa-Francorchamps" class="w-full px-3 py-2 rounded-xl border border-r-line bg-r-bg text-r-text text-xs focus:border-r-accent outline-none" />
          </label>
        </div>

        <input type="hidden" id="fbCarKey" />

        <div>
          <span class="block font-mono text-[10px] uppercase text-r-muted mb-1.5">Sensaciones del coche</span>
          <div id="fbMoodGrid" class="grid grid-cols-5 gap-1.5">
            ${MOODS.map(
              (m) => `
              <button type="button" data-fb-mood="${m.val}" class="flex flex-col items-center gap-1 py-2 px-1 rounded-xl border border-r-line bg-r-bg hover:border-r-accent transition cursor-pointer">
                <span class="text-xl leading-none">${m.emoji}</span>
                <span class="text-[10px] font-mono text-r-muted">${m.label}</span>
              </button>`
            ).join("")}
          </div>
        </div>

        <div class="grid grid-cols-2 gap-2.5">
          <label class="block space-y-1">
            <span class="font-mono text-[10px] uppercase text-r-muted">Delta vs mejor vuelta Top Split</span>
            <input id="fbDeltaTopSplit" maxlength="24" placeholder="+0.35s" class="w-full px-3 py-2 rounded-xl border border-r-line bg-r-bg text-r-text font-mono font-bold text-xs focus:border-r-accent outline-none" />
          </label>
          <label class="block space-y-1">
            <span class="font-mono text-[10px] uppercase text-r-muted">Tu tiempo promedio</span>
            <input id="fbAvgLap" maxlength="24" placeholder="2:18.450" class="w-full px-3 py-2 rounded-xl border border-r-line bg-r-bg text-r-text font-mono font-bold text-xs focus:border-r-accent outline-none" />
          </label>
        </div>

        <label class="block space-y-1">
          <span class="font-mono text-[10px] uppercase text-r-muted">Piloto / Dorsal</span>
          <input id="fbDriverName" maxlength="64" placeholder="#16 Alberto Trujillo" class="w-full px-3 py-2 rounded-xl border border-r-line bg-r-bg text-r-text text-xs focus:border-r-accent outline-none" />
        </label>

        <label class="block space-y-1">
          <span class="font-mono text-[10px] uppercase text-r-muted">Notas del setup (balance, frenos, degradación)</span>
          <textarea id="fbNotes" rows="3" maxlength="380" placeholder="Ej. Muy estable en frenada fuerte, aguanta bien todo el stint con 28 °C de asfalto..." class="w-full px-3 py-2 rounded-xl border border-r-line bg-r-bg text-r-text text-xs focus:border-r-accent outline-none resize-none"></textarea>
        </label>

        <div id="fbNotice" hidden class="p-2.5 rounded-xl font-mono text-[11px] leading-snug"></div>

        <div class="flex items-center justify-between gap-2 pt-1">
          <span class="font-mono text-[10px] text-r-muted">🛡 Moderado por MMT Steward Bot</span>
          <button type="submit" id="fbSubmitBtn" class="px-4 py-2.5 rounded-xl bg-r-accent text-r-ink font-display font-extrabold uppercase tracking-wider text-xs cursor-pointer hover:opacity-90 transition">
            Publicar en muntru.me
          </button>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(modal);

  let selectedMood = 4;
  const paintMood = (val: number) => {
    selectedMood = val;
    modal!.querySelectorAll<HTMLButtonElement>("[data-fb-mood]").forEach((btn) => {
      const on = Number(btn.dataset.fbMood) === selectedMood;
      btn.classList.toggle("border-r-accent", on);
      btn.classList.toggle("bg-r-accent/15", on);
      btn.classList.toggle("border-r-line", !on);
      btn.classList.toggle("bg-r-bg", !on);
    });
  };
  paintMood(4);

  modal.querySelectorAll<HTMLButtonElement>("[data-fb-mood]").forEach((btn) => {
    btn.addEventListener("click", () => paintMood(Number(btn.dataset.fbMood || 4)));
  });

  const close = () => {
    modal!.hidden = true;
  };
  modal.querySelector("#fbCloseBtn")?.addEventListener("click", close);
  modal.addEventListener("click", (e) => {
    if (e.target === modal) close();
  });

  const form = modal.querySelector("#fbForm") as HTMLFormElement;
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = modal!.querySelector("#fbSubmitBtn") as HTMLButtonElement;
    const notice = modal!.querySelector("#fbNotice") as HTMLDivElement;
    btn.disabled = true;
    btn.textContent = "Verificando con Bot…";
    notice.hidden = true;

    const payload = {
      setupFile: (modal!.querySelector("#fbSetupFile") as HTMLInputElement).value.trim(),
      carKey: (modal!.querySelector("#fbCarKey") as HTMLInputElement).value.trim(),
      track: (modal!.querySelector("#fbTrack") as HTMLInputElement).value.trim(),
      driverName: (modal!.querySelector("#fbDriverName") as HTMLInputElement).value.trim() || "Piloto MMT",
      mood: selectedMood,
      deltaTopSplit: (modal!.querySelector("#fbDeltaTopSplit") as HTMLInputElement).value.trim(),
      avgLapTime: (modal!.querySelector("#fbAvgLap") as HTMLInputElement).value.trim(),
      comment: (modal!.querySelector("#fbNotes") as HTMLTextAreaElement).value.trim(),
      source: "desktop",
    };

    try {
      const res = await fetch(REVIEWS_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      notice.hidden = false;
      if (res.ok && data.success) {
        notice.className = data.published
          ? "p-2.5 rounded-xl font-mono text-[11px] bg-emerald-500/15 text-emerald-300 border border-emerald-500/35"
          : "p-2.5 rounded-xl font-mono text-[11px] bg-amber-500/15 text-amber-300 border border-amber-500/35";
        notice.textContent = data.message || "Valoración enviada a muntru.me.";
        if (data.published) {
          (modal!.querySelector("#fbNotes") as HTMLTextAreaElement).value = "";
          setTimeout(close, 1500);
        }
      } else {
        notice.className = "p-2.5 rounded-xl font-mono text-[11px] bg-rose-500/15 text-rose-300 border border-rose-500/35";
        notice.textContent = data.error || "No se pudo publicar la valoración.";
      }
    } catch {
      notice.hidden = false;
      notice.className = "p-2.5 rounded-xl font-mono text-[11px] bg-rose-500/15 text-rose-300 border border-rose-500/35";
      notice.textContent = "Sin conexión con muntru.me. Inténtalo de nuevo en unos segundos.";
    } finally {
      btn.disabled = false;
      btn.textContent = "Publicar en muntru.me";
    }
  });

  (modal as HTMLDivElement & { openWith?: (p?: FeedbackPrefill) => void }).openWith = (prefill = {}) => {
    const ctx = readTelemetryContext();
    (modal!.querySelector("#fbSetupFile") as HTMLInputElement).value = prefill.setupFile || ctx.setupFile || "";
    (modal!.querySelector("#fbCarKey") as HTMLInputElement).value = prefill.carKey || ctx.carKey || "";
    (modal!.querySelector("#fbTrack") as HTMLInputElement).value = prefill.track || ctx.track || "";
    (modal!.querySelector("#fbAvgLap") as HTMLInputElement).value = prefill.avgLapTime || ctx.avgLapTime || "";
    (modal!.querySelector("#fbDriverName") as HTMLInputElement).value = prefill.driverName || ctx.driverName || "";
    const notice = modal!.querySelector("#fbNotice") as HTMLDivElement;
    if (notice) notice.hidden = true;
    paintMood(4);
    modal!.hidden = false;
  };

  return modal;
}

export function openSetupFeedbackModal(prefill?: FeedbackPrefill): void {
  const modal = ensureFeedbackModal() as HTMLDivElement & { openWith?: (p?: FeedbackPrefill) => void };
  modal.openWith?.(prefill);
}

export function initSetupFeedback(): void {
  const openBtns = document.querySelectorAll<HTMLElement>("[data-open-setup-feedback]");
  openBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      openSetupFeedbackModal({
        setupFile: btn.dataset.setup || undefined,
        carKey: btn.dataset.car || undefined,
        track: btn.dataset.track || undefined,
      });
    });
  });

  // Watch #lsLapsCount so when a driver finishes a stint (>= 3 laps), show a subtle post-stint prompt banner
  const lapsEl = document.getElementById("lsLapsCount");
  const promptBanner = document.getElementById("lsFeedbackPrompt");
  if (lapsEl && promptBanner) {
    let prompted = false;
    const obs = new MutationObserver(() => {
      if (prompted) return;
      const m = (lapsEl.textContent || "").match(/(\d+)/);
      if (m && Number(m[1]) >= 3) {
        prompted = true;
        promptBanner.hidden = false;
      }
    });
    obs.observe(lapsEl, { childList: true, characterData: true, subtree: true });
  }
}
