/**
 * 🏁 Muntrume Motorsport · mail.js
 * Institutional Client Engine & Pilot Security Gateway
 */

const INITIAL_EMAILS = [
  {
    id: "msg-001",
    folder: "briefings",
    senderName: "Alberto Trujillo",
    senderEmail: "alberto@muntru.me",
    senderInitials: "AT",
    recipient: "equipo@muntru.me",
    subject: "🏁 Briefing Oficial 24H Le Mans 26S4: Ajuste de Rake y Consumo en Mulsanne",
    date: "01 Nov 2026, 17:30",
    timestamp: 1730478600000,
    category: "briefing",
    categoryLabel: "RACE BRIEFING",
    categoryColor: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
    isRead: false,
    isStarred: true,
    attachment: "MTM_26S4_W07_LeMans_Endur.sto",
    bodyHtml: `
      <p>Hola equipo,</p>
      <p>Hemos completado el análisis de telemetría a 60 Hz en los GTP (Aston Martin Valkyrie y Cadillac) para las 24 Horas de Le Mans de esta semana:</p>
      <ul class="list-disc pl-5 space-y-1">
        <li><strong>Relación de Cambio:</strong> Obligatorio utilizar <em>GearStack: Long</em>. Con el Short estábamos tocando limitador de 7ª a 304 km/h en Les Hunaudières.</li>
        <li><strong>Alerón Trasero:</strong> Calibrado en 4.5° para minimizar el drag aerodinámico y proyectar Vmax de 329.5 km/h.</li>
        <li><strong>Presiones de Neumáticos:</strong> Arrancar la Vuelta 1 a 159 kPa para estabilizar a 169.5 kPa calientes tras las chicanes.</li>
        <li><strong>Consumo de Combustible:</strong> 3.42 L/vuelta estimado en modo mezcla Race. Stints máximos de 11 vueltas.</li>
      </ul>
      <p>Por favor, sincronizad los nuevos .sto desde la carpeta de equipo de Garage 61 o descargadlos directamente desde el Vault.</p>
      <p class="font-bold text-white">— Alberto Trujillo · Team Principal</p>
    `
  },
  {
    id: "msg-002",
    folder: "setups",
    senderName: "Eduardo Chongkan",
    senderEmail: "eduardo@muntru.me",
    senderInitials: "EC",
    recipient: "alberto@muntru.me",
    subject: "🛠️ Telemetría Damper Histogram: Absorción de pianos en Indianapolis & Porsche Curves",
    date: "01 Nov 2026, 15:45",
    timestamp: 1730472300000,
    category: "setup",
    categoryLabel: "TELEMETRÍA",
    categoryColor: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20",
    isRead: true,
    isStarred: false,
    attachment: "MTM_26S4_W07_LeMans_Qualy.sto",
    bodyHtml: `
      <p>Alberto,</p>
      <p>Revisé la traza .ibt de la sesión de clasificación de las 11:36. El heave spring delantero a 80 N/mm eliminó el 95% del bottoming que sufríamos en la compresión previa a Indianápolis.</p>
      <p>El difusor ya no roza el asfalto a >250 km/h, lo que nos da +1.4 km/h netos antes de la frenada fuerte. El coche es mucho más dócil en la entrada a las curvas Porsche.</p>
      <p>He dejado subida la versión Qualy al Vault para que Mateo haga su simulación de pole esta tarde.</p>
      <p class="font-bold text-white">— Eduardo Chongkan · Telemetry Lead</p>
    `
  },
  {
    id: "msg-003",
    folder: "briefings",
    senderName: "Mateo Berbis",
    senderEmail: "mateo@muntru.me",
    senderInitials: "MB",
    recipient: "equipo@muntru.me",
    subject: "⏱️ Vuelta Rápida en Qualy: 3:21.140 registrada en Garage 61",
    date: "01 Nov 2026, 14:10",
    timestamp: 1730466600000,
    category: "briefing",
    categoryLabel: "QUALY REPORT",
    categoryColor: "text-amber-400 bg-amber-500/10 border-amber-500/20",
    isRead: true,
    isStarred: true,
    attachment: null,
    bodyHtml: `
      <p>Buenas noticias equipo,</p>
      <p>Con la carga de 11 litros de gasolina de Qualy y presiones de 163.5 kPa de salida, he conseguido clavar <strong>3:21.140</strong> en la primera vuelta lanzada con el Valkyrie.</p>
      <p>El coche rota de maravilla en las curvas Tertre Rouge y Mulsanne. Estamos a solo 0.25s del tiempo de referencia de los mejores splits internacionales.</p>
      <p>Listos para la tanda de clasificación del fin de semana.</p>
      <p class="font-bold text-white">— Mateo Berbis · Sprint & Qualy</p>
    `
  },
  {
    id: "msg-004",
    folder: "inbox",
    senderName: "Juanlu Carrillo",
    senderEmail: "juanlu@muntru.me",
    senderInitials: "JC",
    recipient: "alberto@muntru.me",
    subject: "💬 Test de Monoplazas SFL: Progresión en Red Bull Ring con Setup MTM",
    date: "31 Oct 2026, 21:20",
    timestamp: 1730406000000,
    category: "general",
    categoryLabel: "DEV SQUAD",
    categoryColor: "text-orange-400 bg-orange-500/10 border-orange-500/20",
    isRead: true,
    isStarred: false,
    attachment: null,
    bodyHtml: `
      <p>Hola Alberto,</p>
      <p>Completé las 30 vueltas de simulación de carrera con el Super Formula Lights en Spielberg. El equilibrio de barras estabilizadoras blandas me permitió adelantar en la curva 3 sin perder tracción en la subida.</p>
      <p>El desgaste de goma trasera se mantuvo por debajo del 12% tras 20 vueltas a ritmo de podio.</p>
      <p class="font-bold text-white">— Juanlu Carrillo · Junior Squad</p>
    `
  },
  {
    id: "msg-005",
    folder: "inbox",
    senderName: "Race Control Muntrume",
    senderEmail: "racecontrol@muntru.me",
    senderInitials: "RC",
    recipient: "equipo@muntru.me",
    subject: "🚨 Aviso de Dirección de Carrera: Verificación de Watermark y Licencias",
    date: "30 Oct 2026, 18:00",
    timestamp: 1730307600000,
    category: "urgent",
    categoryLabel: "DIRECCIÓN DE CARRERA",
    categoryColor: "text-purple-400 bg-purple-500/10 border-purple-500/20",
    isRead: true,
    isStarred: false,
    attachment: null,
    bodyHtml: `
      <p>A todos los pilotos de Muntrume Motorsport,</p>
      <p>Recordamos que todos los setups compartidos en eventos oficiales deben llevar la marca de agua criptográfica institucional:</p>
      <p class="font-mono p-2.5 rounded bg-black/40 text-emerald-400 border border-white/5">muntru.me - Muntrume Motorsport. Setup by Alberto Trujillo.</p>
      <p>Queda prohibida la redistribución no autorizada fuera del equipo. El sistema de auditoría registra las descargas por IP y firma de piloto.</p>
      <p class="font-bold text-white">— Race Control Esports</p>
    `
  }
];

const PILOTS_ROSTER = {
  "alberto@muntru.me": { name: "Alberto Trujillo", email: "alberto@muntru.me", initials: "AT", role: "Team Principal & Telemetry Lead" },
  "mateo@muntru.me": { name: "Mateo Berbis", email: "mateo@muntru.me", initials: "MB", role: "Piloto Oficial · Sprint & Qualy" },
  "eduardo@muntru.me": { name: "Eduardo Chongkan", email: "eduardo@muntru.me", initials: "EC", role: "Ingeniero de Carrera & Prototipos" },
  "juanlu@muntru.me": { name: "Juanlu Carrillo", email: "juanlu@muntru.me", initials: "JC", role: "Piloto Oficial · Monoplazas" },
  "admin@muntru.me": { name: "Race Control & Staff", email: "admin@muntru.me", initials: "RC", role: "Race Operations & Governance" }
};

let currentPilot = PILOTS_ROSTER["alberto@muntru.me"];
let emails = [];
let currentFolder = "inbox";
let activeMessageId = null;

// Authentication Gate Controllers
function handleMailLogin(event) {
  if (event) event.preventDefault();
  const emailSelect = document.getElementById("authPilotEmail");
  const passInput = document.getElementById("authPasscode");
  const errorMsg = document.getElementById("authErrorMsg");
  
  if (!emailSelect || !passInput) return;
  const email = emailSelect.value.trim().toLowerCase();
  const passcode = passInput.value.trim().toLowerCase();

  const validPins = ["muntrume2026", "muntrume", "2026", "admin2026", "1234"];
  const pilotPrefix = email.split("@")[0];

  if (passcode === pilotPrefix + "2026" || passcode === pilotPrefix || validPins.includes(passcode)) {
    sessionStorage.setItem("muntrume_mail_auth", JSON.stringify({ email: email, authenticatedAt: Date.now() }));
    if (errorMsg) errorMsg.classList.add("hidden");
    passInput.value = "";
    unlockMailWorkspace(email);
  } else {
    if (errorMsg) errorMsg.classList.remove("hidden");
    passInput.focus();
  }
}

function handleMailLogout() {
  sessionStorage.removeItem("muntrume_mail_auth");
  const gate = document.getElementById("mailAuthGate");
  const workspace = document.getElementById("mailWorkspace");
  if (workspace) workspace.classList.add("hidden");
  if (gate) gate.classList.remove("hidden");
  const passInput = document.getElementById("authPasscode");
  if (passInput) passInput.value = "";
  const errorMsg = document.getElementById("authErrorMsg");
  if (errorMsg) errorMsg.classList.add("hidden");
}

function unlockMailWorkspace(email) {
  const gate = document.getElementById("mailAuthGate");
  const workspace = document.getElementById("mailWorkspace");
  if (gate) gate.classList.add("hidden");
  if (workspace) workspace.classList.remove("hidden");
  switchIdentity(email);
  renderList();
  if (emails.length > 0 && !activeMessageId) {
    selectMessage(emails[0].id);
  }
}

function checkMailSession() {
  try {
    const raw = sessionStorage.getItem("muntrume_mail_auth");
    if (raw) {
      const data = JSON.parse(raw);
      if (data && data.email && PILOTS_ROSTER[data.email]) {
        unlockMailWorkspace(data.email);
        return true;
      }
    }
  } catch (e) {
    console.warn("Session check error", e);
  }
  const gate = document.getElementById("mailAuthGate");
  const workspace = document.getElementById("mailWorkspace");
  if (gate) gate.classList.remove("hidden");
  if (workspace) workspace.classList.add("hidden");
  return false;
}

function switchIdentity(email) {
  if (PILOTS_ROSTER[email]) {
    currentPilot = PILOTS_ROSTER[email];
    const userBadge = document.getElementById("currentUserBadge");
    if (userBadge) userBadge.textContent = currentPilot.initials;
    const identSelect = document.getElementById("identitySelect");
    if (identSelect) identSelect.value = email;
    const activeBadge = document.getElementById("activeMailBadge");
    if (activeBadge) activeBadge.textContent = currentPilot.email;
    const composeFrom = document.getElementById("composeFrom");
    if (composeFrom) composeFrom.value = `${currentPilot.email} (${currentPilot.name})`;
    localStorage.setItem("muntrume_active_pilot", email);
  }
}

function applyQuickTemplate(type) {
  const subjectInput = document.getElementById("composeSubject");
  const bodyInput = document.getElementById("composeBody");
  const catSelect = document.getElementById("composeCategory");

  if (type === "briefing") {
    if (catSelect) catSelect.value = "briefing";
    if (subjectInput) subjectInput.value = "🏁 Race Briefing Oficial: Le Mans / IMSA — Estrategia de Stints y Combustible";
    if (bodyInput) bodyInput.value = `Hola equipo,

Comparto la hoja de ruta técnica para la próxima cita:
- Circuito: Circuit de la Sarthe / Le Mans
- Coche: Aston Martin Valkyrie GTP
- Carga de Combustible Qualy: 16.5 L (suficiente para 2 vueltas lanzadas + out-lap)
- Carga de Combustible Carrera: 62.4 L por stint
- Relación de marchas: GearStack Long (345+ km/h en Mulsanne)

Por favor, confirmad asistencia y turnos de stint.

— ${currentPilot.name} · ${currentPilot.role}`;
  } else if (type === "setup") {
    if (catSelect) catSelect.value = "setup";
    if (subjectInput) subjectInput.value = "🏎️ Setup Verificado MMT: Aston Martin Valkyrie GTP [MMT_VALK_LMS_Q2 / R]";
    if (bodyInput) bodyInput.value = `Equipo,

Ya tenéis disponible en el Setup Vault (y sincronizado en Garage 61) el setup oficial verificado:
- Coche: Aston Martin Valkyrie GTP
- Versión: MMT_VALK_LMS_Q2_SAFE
- Aero: Alerón 4.5° de baja carga
- Balance: Tracción optimizada en curvas Porsche

Descarga directa en: https://muntru.me/setups

— ${currentPilot.name}`;
  } else if (type === "training") {
    if (catSelect) catSelect.value = "general";
    if (subjectInput) subjectInput.value = "⏱️ Convocatoria: Sesión Oficial de Entrenamientos y Práctica de Pit-Stops";
    if (bodyInput) bodyInput.value = `Buenas a todos,

Convocamos sesión privada de entreno para poner a punto las paradas en boxes y relevos de piloto:
- Día / Hora: Jueves 21:30 CEST
- Servidor: Muntrume Motorsport Practice Server
- Sesión: Outlap + 3 stints completos de ritmo de carrera

Nos vemos en el canal de voz de Discord.

— ${currentPilot.name}`;
  }
}

function initMail() {
  const stored = localStorage.getItem("muntrume_webmail_store");
  if (stored) {
    try {
      emails = JSON.parse(stored);
    } catch {
      emails = [...INITIAL_EMAILS];
    }
  } else {
    emails = [...INITIAL_EMAILS];
    saveEmails();
  }

  const params = new URLSearchParams(window.location.search);
  const asParam = params.get("as") || params.get("from") || localStorage.getItem("muntrume_active_pilot");
  if (asParam) {
    const foundKey = Object.keys(PILOTS_ROSTER).find(k => k === asParam || k.startsWith(asParam.split("-")[0]));
    if (foundKey) {
      const authEmailSelect = document.getElementById("authPilotEmail");
      if (authEmailSelect) authEmailSelect.value = foundKey;
    }
  }

  const toParam = params.get("to");
  if (toParam) {
    openComposeModal(toParam);
  }

  checkMailSession();
}

function saveEmails() {
  localStorage.setItem("muntrume_webmail_store", JSON.stringify(emails));
}

function switchFolder(folder) {
  currentFolder = folder;
  document.querySelectorAll("aside nav button").forEach(b => b.classList.remove("mail-active"));
  const btn = document.getElementById(`folder-${folder}`);
  if (btn) btn.classList.add("mail-active");

  const titles = {
    inbox: "Bandeja de Entrada",
    briefings: "Race Briefings",
    setups: "Setups & Telemetría",
    starred: "Mensajes Destacados",
    sent: "Mensajes Enviados"
  };
  const titleEl = document.getElementById("currentFolderTitle");
  if (titleEl) titleEl.textContent = titles[folder] || folder;
  renderList();
}

function renderList() {
  const searchInput = document.getElementById("mailSearchInput");
  const query = (searchInput?.value || "").toLowerCase().trim();
  let filtered = emails.filter(m => {
    if (currentFolder === "inbox") return m.folder === "inbox" || m.folder === "briefings" || m.folder === "setups";
    if (currentFolder === "briefings") return m.category === "briefing";
    if (currentFolder === "setups") return m.category === "setup";
    if (currentFolder === "starred") return m.isStarred === true;
    if (currentFolder === "sent") return m.folder === "sent";
    return true;
  });

  if (query) {
    filtered = filtered.filter(m => 
      m.subject.toLowerCase().includes(query) ||
      m.senderName.toLowerCase().includes(query) ||
      m.senderEmail.toLowerCase().includes(query)
    );
  }

  const unreadBadge = document.getElementById("unreadInboxBadge");
  if (unreadBadge) {
    const unreadCount = emails.filter(m => !m.isRead).length;
    unreadBadge.textContent = unreadCount;
  }

  const container = document.getElementById("mailListContainer");
  if (!container) return;

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="p-8 text-center text-xs text-neutral-500 space-y-1">
        <div>📭</div>
        <div>No hay comunicados en esta carpeta</div>
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.map(m => {
    const isSelected = m.id === activeMessageId;
    return `
      <div 
        onclick="selectMessage('${m.id}')"
        class="p-3.5 hover:bg-white/[0.04] cursor-pointer transition flex gap-3 relative ${isSelected ? 'bg-white/[0.06] border-l-2 border-emerald-400' : ''} ${!m.isRead ? 'font-bold' : ''}"
      >
        <div class="w-8 h-8 rounded-xl bg-emerald-950/60 border border-emerald-500/30 flex items-center justify-center font-bold text-xs text-emerald-400 flex-shrink-0 mt-0.5">
          ${m.senderInitials || 'MT'}
        </div>
        <div class="flex-1 min-w-0 space-y-1">
          <div class="flex items-center justify-between gap-1">
            <span class="text-xs truncate ${!m.isRead ? 'text-white font-extrabold' : 'text-neutral-300'}">${escapeHtml(m.senderName)}</span>
            <span class="text-[10px] text-neutral-500 whitespace-nowrap font-mono">${escapeHtml(m.date.split(',')[0])}</span>
          </div>
          <div class="text-xs text-neutral-200 truncate ${!m.isRead ? 'font-bold text-white' : ''}">
            ${escapeHtml(m.subject)}
          </div>
          <div class="flex items-center gap-1.5 pt-0.5">
            <span class="text-[9px] font-mono px-1.5 py-0.2 rounded border ${m.categoryColor || 'text-neutral-400 bg-white/5 border-white/10'}">
              ${m.categoryLabel || 'COMUNICADO'}
            </span>
            ${m.attachment ? '<span class="text-[10px]" title="Setup .sto adjunto">🏎️</span>' : ''}
            ${m.isStarred ? '<span class="text-[10px] text-amber-400">★</span>' : ''}
          </div>
        </div>
        ${!m.isRead ? '<span class="w-2 h-2 rounded-full bg-emerald-400 absolute right-2 top-3"></span>' : ''}
      </div>
    `;
  }).join("");
}

function selectMessage(id) {
  activeMessageId = id;
  const msg = emails.find(m => m.id === id);
  if (!msg) return;

  msg.isRead = true;
  saveEmails();
  renderList();

  const emptyPane = document.getElementById("emptyPane");
  if (emptyPane) emptyPane.classList.add("hidden");
  
  const pane = document.getElementById("readingPane");
  if (pane) pane.classList.remove("hidden");

  const paneSubject = document.getElementById("paneSubject");
  if (paneSubject) paneSubject.textContent = msg.subject;

  const paneBadge = document.getElementById("paneCategoryBadge");
  if (paneBadge) {
    paneBadge.textContent = msg.categoryLabel || "COMUNICADO";
    paneBadge.className = `text-[10px] font-bold font-mono px-2.5 py-0.5 rounded-full border uppercase ${msg.categoryColor || ''}`;
  }

  const paneDate = document.getElementById("paneDate");
  if (paneDate) paneDate.textContent = msg.date;

  const paneSenderName = document.getElementById("paneSenderName");
  if (paneSenderName) paneSenderName.textContent = msg.senderName;

  const paneSenderEmail = document.getElementById("paneSenderEmail");
  if (paneSenderEmail) paneSenderEmail.textContent = `<${msg.senderEmail}>`;

  const paneSenderAvatar = document.getElementById("paneSenderAvatar");
  if (paneSenderAvatar) paneSenderAvatar.textContent = msg.senderInitials || "MT";

  const paneRecipient = document.getElementById("paneRecipient");
  if (paneRecipient) paneRecipient.textContent = msg.recipient;

  const paneStar = document.getElementById("paneStarBtn");
  if (paneStar) {
    paneStar.textContent = msg.isStarred ? "★" : "⭐";
    paneStar.className = msg.isStarred ? "p-1.5 rounded-lg hover:bg-white/10 text-amber-400 font-bold" : "p-1.5 rounded-lg hover:bg-white/10 text-neutral-400 hover:text-amber-400";
  }

  const attBox = document.getElementById("paneAttachmentBox");
  if (attBox) {
    if (msg.attachment) {
      attBox.classList.remove("hidden");
      const attName = document.getElementById("paneAttachmentName");
      if (attName) attName.textContent = msg.attachment;
    } else {
      attBox.classList.add("hidden");
    }
  }

  const paneBody = document.getElementById("paneBody");
  if (paneBody) paneBody.innerHTML = msg.bodyHtml;
}

function toggleStarActiveMessage() {
  if (!activeMessageId) return;
  const msg = emails.find(m => m.id === activeMessageId);
  if (msg) {
    msg.isStarred = !msg.isStarred;
    saveEmails();
    selectMessage(msg.id);
  }
}

function deleteActiveMessage() {
  if (!activeMessageId) return;
  emails = emails.filter(m => m.id !== activeMessageId);
  saveEmails();
  activeMessageId = null;
  const pane = document.getElementById("readingPane");
  if (pane) pane.classList.add("hidden");
  const empty = document.getElementById("emptyPane");
  if (empty) empty.classList.remove("hidden");
  renderList();
}

function markAllAsRead() {
  emails.forEach(m => m.isRead = true);
  saveEmails();
  renderList();
}

function onSearchMail(q) {
  renderList();
}

function openComposeModal(to = "") {
  const modal = document.getElementById("composeModal");
  if (modal) modal.classList.remove("hidden");
  if (to) {
    const sel = document.getElementById("composeTo");
    if (sel) {
      for (let i = 0; i < sel.options.length; i++) {
        if (sel.options[i].value === to) {
          sel.selectedIndex = i;
          break;
        }
      }
    }
  }
}

function closeComposeModal() {
  const modal = document.getElementById("composeModal");
  if (modal) modal.classList.add("hidden");
}

function quickComposeTo(to) {
  openComposeModal(to);
}

function handleSendCompose(e) {
  if (e) e.preventDefault();
  const toEl = document.getElementById("composeTo");
  const catEl = document.getElementById("composeCategory");
  const subEl = document.getElementById("composeSubject");
  const bodyEl = document.getElementById("composeBody");

  const to = toEl?.value || "equipo@muntru.me";
  const category = catEl?.value || "general";
  const subject = subEl?.value || "Comunicado interno";
  const body = bodyEl?.value || "";

  const categoryLabels = {
    briefing: { label: "RACE BRIEFING", color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" },
    setup: { label: "TELEMETRÍA", color: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20" },
    urgent: { label: "URGENTE", color: "text-purple-400 bg-purple-500/10 border-purple-500/20" },
    general: { label: "GENERAL", color: "text-neutral-400 bg-white/5 border-white/10" }
  };

  const newMsg = {
    id: "msg-" + Date.now(),
    folder: "sent",
    senderName: currentPilot.name,
    senderEmail: currentPilot.email,
    senderInitials: currentPilot.initials,
    recipient: to,
    subject: subject,
    date: new Date().toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }),
    timestamp: Date.now(),
    category: category,
    categoryLabel: categoryLabels[category]?.label || "COMUNICADO",
    categoryColor: categoryLabels[category]?.color || "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
    isRead: true,
    isStarred: false,
    attachment: null,
    bodyHtml: `<p>${escapeHtml(body).replace(/\n/g, '<br>')}</p><p class="pt-2 text-neutral-400 font-mono text-xs">— Enviado desde Muntrume Webmail Seguro</p>`
  };

  emails.unshift(newMsg);
  saveEmails();
  closeComposeModal();

  switchFolder("sent");
  selectMessage(newMsg.id);
  alert("✅ Comunicado interno enviado y registrado en el servidor de correo @muntru.me.");
}

function sendQuickReply() {
  const replyInput = document.getElementById("quickReplyText");
  const text = replyInput?.value.trim();
  if (!text || !activeMessageId) return;

  const current = emails.find(m => m.id === activeMessageId);
  if (!current) return;

  const replyMsg = {
    id: "msg-" + Date.now(),
    folder: "sent",
    senderName: currentPilot.name,
    senderEmail: currentPilot.email,
    senderInitials: currentPilot.initials,
    recipient: current.senderEmail,
    subject: "Re: " + current.subject,
    date: new Date().toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }),
    timestamp: Date.now(),
    category: current.category,
    categoryLabel: current.categoryLabel,
    categoryColor: current.categoryColor,
    isRead: true,
    isStarred: false,
    attachment: null,
    bodyHtml: `<p>${escapeHtml(text).replace(/\n/g, '<br>')}</p><hr class="border-white/10 my-3"><p class="text-[11px] text-neutral-500">En respuesta a: "${escapeHtml(current.subject)}" de ${escapeHtml(current.senderName)}</p>`
  };

  emails.unshift(replyMsg);
  saveEmails();
  if (replyInput) replyInput.value = "";
  alert("✅ Respuesta enviada con éxito.");
  renderList();
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// Window Global Attachments
window.handleMailLogin = handleMailLogin;
window.handleMailLogout = handleMailLogout;
window.openComposeModal = openComposeModal;
window.closeComposeModal = closeComposeModal;
window.quickComposeTo = quickComposeTo;
window.handleSendCompose = handleSendCompose;
window.sendQuickReply = sendQuickReply;
window.switchFolder = switchFolder;
window.selectMessage = selectMessage;
window.toggleStarActiveMessage = toggleStarActiveMessage;
window.deleteActiveMessage = deleteActiveMessage;
window.markAllAsRead = markAllAsRead;
window.onSearchMail = onSearchMail;
window.switchIdentity = switchIdentity;
window.applyQuickTemplate = applyQuickTemplate;

window.addEventListener("DOMContentLoaded", initMail);
