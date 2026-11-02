/**
 * 🏁 Muntrume Motorsport · pilot.js
 * Pilot profile dynamic rendering & state controller
 */

const DRIVERS_DATA = {
  "alberto-trujillo": {
    slug: "alberto-trujillo",
    name: "Alberto Trujillo",
    firstName: "Alberto",
    initials: "AT",
    number: "#1",
    colorClass: "border-emerald-500 text-emerald-400 bg-emerald-950/50",
    ambientColor: "rgba(16, 185, 129, 0.15)",
    role: "FOUNDER & TEAM PRINCIPAL",
    primaryCar: "Aston Martin Valkyrie GTP / GT3",
    specialty: "Resistencia & Estrategia",
    email: "alberto@muntru.me",
    location: "🇪🇸 Barcelona, España",
    bio: "Fundador y Team Principal de Muntrume Motorsport. Especialista en estrategia de resistencia, stint management en clásicas de 24 horas y telemetría de suspensiones para GTP y GT3.",
    telemetryText: "Optimización aerodinámica y de estabilidad para carreras de largo recorrido, equilibrando velocidad punta y consistencia en tráfico multi-clase.",
    roleDesc: "Dirección general del equipo, supervisión del Setup Vault y coordinación deportiva de la escudería.",
    watermark: "muntru.me - Muntrume Motorsport. Setup by Alberto Trujillo."
  },
  "mateo-berbis": {
    slug: "mateo-berbis",
    name: "Mateo Berbis",
    firstName: "Mateo",
    initials: "MB",
    number: "#2",
    colorClass: "border-amber-400 text-amber-300 bg-amber-950/50",
    ambientColor: "rgba(245, 158, 11, 0.15)",
    role: "PILOTO OFICIAL · SPRINT & QUALIFYING",
    primaryCar: "Porsche 992 GT3 R / GT3",
    specialty: "Sprint & Vuelta Rápida",
    email: "mateo@muntru.me",
    location: "🇪🇸 España",
    bio: "Piloto oficial de Muntrume Motorsport. Especialista en ritmo de clasificación a una vuelta y stints agresivos de sprint en categorías de alto nivel competitivo.",
    telemetryText: "Puesta a punto enfocada en reactividad en entrada a curva lenta, rotación ágil del tren trasero y aprovechamiento máximo del neumático nuevo en vuelta de qualy.",
    roleDesc: "Extracción del máximo rendimiento en clasificación para situar los coches del equipo en las primeras filas de parrilla.",
    watermark: "muntru.me - Muntrume Motorsport. Piloto Oficial: Mateo Berbis."
  },
  "eduardo-chongkan": {
    slug: "eduardo-chongkan",
    name: "Eduardo Chongkan",
    firstName: "Eduardo",
    initials: "EC",
    number: "#3",
    colorClass: "border-slate-400 text-slate-300 bg-slate-900/60",
    ambientColor: "rgba(148, 163, 184, 0.15)",
    role: "INGENIERO DE CARRERA & PILOTO PROTOTIPOS",
    primaryCar: "Dallara P217 LMP2 / Prototipos",
    specialty: "Telemetría & Cinemática",
    email: "eduardo@muntru.me",
    location: "🇪🇸 España",
    bio: "Ingeniero de carrera y piloto de prototipos en Muntrume Motorsport. Aporta análisis matemático, modelado de amortiguación damper-velocity y gestión de combustible.",
    telemetryText: "Ajuste milimétrico de alturas de marcha dinámicas y reparto de frenada para preservar la estabilidad en frenadas pronunciadas y curvas rápidas.",
    roleDesc: "Supervisión técnica de telemetría a 60 Hz en el garaje del equipo y optimización de consumo en carreras de resistencia.",
    watermark: "muntru.me - Muntrume Motorsport. Piloto Oficial: Eduardo Chongkan."
  },
  "juanlu-carrillo": {
    slug: "juanlu-carrillo",
    name: "Juanlu Carrillo",
    firstName: "Juanlu",
    initials: "JC",
    number: "#4",
    colorClass: "border-orange-500 text-orange-400 bg-orange-950/50",
    ambientColor: "rgba(249, 115, 22, 0.15)",
    role: "PILOTO OFICIAL · DEV SQUAD & FÓRMULAS",
    primaryCar: "Super Formula Lights / Mazda MX-5",
    specialty: "Monoplazas & Carreras en Pelotón",
    email: "juanlu@muntru.me",
    location: "🇪🇸 España",
    bio: "Piloto del programa de desarrollo y líder en monoplazas de Muntrume Motorsport. Especialista en draft control, luchas rueda a rueda y copas monomarca.",
    telemetryText: "Puesta a punto equilibrada para maximizar la tracción mecánica en salida de curva y estabilidad en rebufo cerrado a alta velocidad.",
    roleDesc: "Punta de lanza en el desarrollo de setups para las series de monoplazas y copas de formación del equipo.",
    watermark: "muntru.me - Muntrume Motorsport. Piloto Oficial: Juanlu Carrillo."
  }
};

function renderDriver(slug) {
  const driver = DRIVERS_DATA[slug] || DRIVERS_DATA["alberto-trujillo"];
  
  const titleEl = document.getElementById("pageTitle");
  if (titleEl) titleEl.textContent = `${driver.name} — Perfil Oficial · Muntrume Motorsport`;
  
  const selectEl = document.getElementById("driverSelect");
  if (selectEl) selectEl.value = driver.slug;

  const nameEl = document.getElementById("driverName");
  if (nameEl) nameEl.textContent = driver.name;

  const bioEl = document.getElementById("driverBio");
  if (bioEl) bioEl.textContent = driver.bio;

  const avatarEl = document.getElementById("driverAvatar");
  if (avatarEl) {
    avatarEl.textContent = driver.initials;
    avatarEl.className = `w-32 h-32 sm:w-40 sm:h-40 rounded-3xl border-2 flex items-center justify-center text-4xl sm:text-5xl font-black shadow-2xl ${driver.colorClass}`;
  }

  const numEl = document.getElementById("driverNumberBadge");
  if (numEl) numEl.textContent = driver.number;

  const roleEl = document.getElementById("roleBadge");
  if (roleEl) roleEl.textContent = driver.role;

  const locEl = document.getElementById("locationBadge");
  if (locEl) locEl.textContent = driver.location;

  const glowEl = document.getElementById("ambientGlow");
  if (glowEl) glowEl.style.backgroundColor = driver.ambientColor;

  const carEl = document.getElementById("primaryCar");
  if (carEl) carEl.textContent = driver.primaryCar;

  const specEl = document.getElementById("specialty");
  if (specEl) specEl.textContent = driver.specialty;

  const mailEl = document.getElementById("driverEmail");
  if (mailEl) mailEl.textContent = driver.email;

  const noticeName = document.getElementById("pilotNameNotice");
  if (noticeName) noticeName.textContent = driver.name;

  const vaultBtnText = document.getElementById("vaultSetupsText");
  if (vaultBtnText) {
    vaultBtnText.textContent = `🏎️ Ver Setups de ${driver.firstName} en Vault`;
  }

  const vaultLink = document.getElementById("vaultSetupsLink");
  if (vaultLink) vaultLink.href = `/setups?q=${encodeURIComponent(driver.firstName)}`;

  const sendMailLink = document.getElementById("sendMailLink");
  if (sendMailLink) sendMailLink.href = `/mail?to=${encodeURIComponent(driver.email)}`;

  const composeBtn = document.getElementById("composeMessageBtn");
  if (composeBtn) composeBtn.href = `/mail?to=${encodeURIComponent(driver.email)}`;

  const composeBtnName = document.getElementById("composeBtnName");
  if (composeBtnName) composeBtnName.textContent = driver.firstName;

  const prefSpec = document.getElementById("prefSpecialty");
  if (prefSpec) prefSpec.textContent = driver.specialty;

  const telemPhil = document.getElementById("telemetryPhilosophy");
  if (telemPhil) telemPhil.textContent = driver.telemetryText;

  const teamRole = document.getElementById("teamRoleDescription");
  if (teamRole) teamRole.textContent = driver.roleDesc;

  const watermarkEl = document.getElementById("driverWatermark");
  if (watermarkEl) watermarkEl.textContent = driver.watermark;

  const newUrl = `${window.location.pathname}?id=${driver.slug}`;
  window.history.replaceState({ slug: driver.slug }, '', newUrl);
}

function onDriverChange(slug) {
  renderDriver(slug);
}

window.renderDriver = renderDriver;
window.onDriverChange = onDriverChange;

document.addEventListener("DOMContentLoaded", () => {
  const urlParams = new URLSearchParams(window.location.search);
  const initialId = urlParams.get("id") || urlParams.get("p") || "alberto-trujillo";
  renderDriver(initialId);
});
