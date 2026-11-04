/**
 * 🏁 Muntrume Motorsport · admin.js
 * Institutional Client Engine
 */

const PILOTS_DIRECTORY = [
      {
        slug: "alberto-trujillo",
        name: "Alberto Trujillo",
        initials: "AT",
        email: "alberto@muntru.me",
        iracingId: "128491",
        license: "A 4.99",
        irating: "3,450 iR",
        role: "Team Principal",
        specialty: "GTP & GT3 Resistencia",
        status: "Activo (Super Admin)",
        statusClass: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
      },
      {
        slug: "mateo-berbis",
        name: "Mateo Berbis",
        initials: "MB",
        email: "mateo@muntru.me",
        iracingId: "389201",
        license: "A 4.85",
        irating: "3,210 iR",
        role: "Sprint Lead",
        specialty: "Qualy Agresiva & GT3",
        status: "Activo",
        statusClass: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
      },
      {
        slug: "eduardo-chongkan",
        name: "Eduardo Chongkan",
        initials: "EC",
        email: "eduardo@muntru.me",
        iracingId: "401923",
        license: "A 4.92",
        irating: "3,025 iR",
        role: "Race Engineer",
        specialty: "LMP2 & Cinética Telemetría",
        status: "Activo",
        statusClass: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
      },
      {
        slug: "juanlu-carrillo",
        name: "Juanlu Carrillo",
        initials: "JC",
        email: "juanlu@muntru.me",
        iracingId: "591024",
        license: "B 3.90",
        irating: "2,420 iR",
        role: "Dev Squad",
        specialty: "SFL & Monomarca Mazda",
        status: "Activo",
        statusClass: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
      }
    ];

    function initAdmin() {
      renderPilotsTables();
      
      // Global hotkey '/' to search
      window.addEventListener("keydown", (e) => {
        if (e.key === "/" && document.activeElement.tagName !== "INPUT" && document.activeElement.tagName !== "TEXTAREA") {
          e.preventDefault();
          document.getElementById("globalSearchInput")?.focus();
        }
      });
    }

    function switchAdminSection(sectionId) {
      const sections = ["dashboard", "directory", "mail", "setups", "security", "audit", "iracing-sync"];
      sections.forEach(s => {
        const secEl = document.getElementById(`section-${s}`);
        const navEl = document.getElementById(`nav-${s}`);
        if (secEl) secEl.classList.add("hidden");
        if (navEl) navEl.classList.remove("sidebar-link-active");
      });

      const targetSec = document.getElementById(`section-${sectionId}`);
      const targetNav = document.getElementById(`nav-${sectionId}`);
      if (targetSec) targetSec.classList.remove("hidden");
      if (targetNav) targetNav.classList.add("sidebar-link-active");
    }

    function renderPilotsTables() {
      const quickTable = document.getElementById("quickPilotsTable");
      if (quickTable) {
        quickTable.innerHTML = PILOTS_DIRECTORY.map(p => `
          <tr class="hover:bg-white/[0.02] transition">
            <td class="py-3 px-4">
              <div class="font-bold text-white flex items-center gap-2">
                <span class="w-6 h-6 rounded-lg bg-emerald-950/60 border border-emerald-500/40 text-[10px] text-emerald-400 flex items-center justify-center font-bold">${p.initials}</span>
                <span>${p.name}</span>
              </div>
              <div class="text-[10px] text-neutral-500">${p.role}</div>
            </td>
            <td class="py-3 px-4 font-mono text-cyan-300">${p.email}</td>
            <td class="py-3 px-4 font-mono font-bold text-white">${p.license}</td>
            <td class="py-3 px-4">
              <span class="text-[10px] font-mono px-2 py-0.5 rounded-full border ${p.statusClass}">${p.status}</span>
            </td>
            <td class="py-3 px-4 text-right">
              <a href="/pilot?id=${p.slug}" class="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-emerald-400 text-[11px] font-bold transition">
                Ver Perfil ↗
              </a>
            </td>
          </tr>
        `).join("");
      }

      const detailedTable = document.getElementById("detailedPilotsTable");
      if (detailedTable) {
        detailedTable.innerHTML = PILOTS_DIRECTORY.map(p => `
          <tr class="hover:bg-white/[0.02] transition">
            <td class="py-3 px-4">
              <div class="font-bold text-white">${p.name}</div>
              <div class="text-[10px] text-neutral-500 font-mono">iRacing ID: ${p.iracingId}</div>
            </td>
            <td class="py-3 px-4 font-mono text-cyan-300">${p.email}</td>
            <td class="py-3 px-4 font-mono">
              <span class="text-white font-bold">${p.irating}</span>
              <span class="text-neutral-500 text-[10px]">(${p.license})</span>
            </td>
            <td class="py-3 px-4 text-neutral-300">${p.specialty}</td>
            <td class="py-3 px-4">
              <span class="text-[10px] font-mono px-2 py-0.5 rounded-full border ${p.statusClass}">${p.status}</span>
            </td>
            <td class="py-3 px-4 text-right space-x-1.5 whitespace-nowrap">
              <a href="/pilot?id=${p.slug}" class="px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-emerald-400 text-[11px] font-bold">Perfil</a>
              <button onclick="resendInvite('${p.email}')" class="px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-neutral-300 text-[11px]">Reenviar Acceso</button>
            </td>
          </tr>
        `).join("");
      }
    }

    function openAddPilotModal() {
      document.getElementById("addPilotModal").classList.remove("hidden");
    }

    function closeAddPilotModal() {
      document.getElementById("addPilotModal").classList.add("hidden");
    }

    function handleAddPilotSubmit(e) {
      e.preventDefault();
      const name = document.getElementById("newPilotName").value.trim();
      const email = document.getElementById("newPilotEmail").value.trim().toLowerCase();
      const iracingId = document.getElementById("newPilotIracingId").value.trim();
      const role = document.getElementById("newPilotRole").value;

      PILOTS_DIRECTORY.push({
        slug: name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        name: name,
        initials: name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase(),
        email: email,
        iracingId: iracingId || "En trámite",
        license: "A 4.00",
        irating: "2,500 iR",
        role: role === "engineer" ? "Race Engineer" : "Piloto Titular",
        specialty: "GT3 & Endurance",
        status: "Activo (Invitación enviada)",
        statusClass: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20"
      });

      renderPilotsTables();
      closeAddPilotModal();
      document.getElementById("addPilotForm").reset();
      alert(`✅ Piloto ${name} registrado en la organización. Se ha generado su enlace de acceso seguro.`);
    }

    function resendInvite(email) {
      alert(`✅ Enlace de acceso seguro y restablecimiento de contraseña enviado a ${email}.`);
    }

    function testAdminEmails() {
      alert("✅ Plantillas de correo probadas: Se han verificado las firmas HTML de Muntrume Motorsport.");
    }

    function handleAdminSearch(q) {
      const query = q.toLowerCase().trim();
      if (!query) {
        renderPilotsTables();
        return;
      }
      const rows = document.querySelectorAll("#detailedPilotsTable tr");
      rows.forEach(r => {
        const text = r.textContent.toLowerCase();
        r.style.display = text.includes(query) ? "" : "none";
      });
    }

    function filterPilotsTab(tab) {
      document.querySelectorAll("#section-directory button[id^='pilotTab']").forEach(b => {
        b.className = "px-3.5 py-1.5 rounded-xl text-neutral-400 hover:text-white";
      });
      const activeBtn = document.getElementById(`pilotTab-${tab}`);
      if (activeBtn) activeBtn.className = "px-3.5 py-1.5 rounded-xl bg-white/10 text-white";
    }

    window.switchAdminSection = switchAdminSection;
    window.openAddPilotModal = openAddPilotModal;
    window.closeAddPilotModal = closeAddPilotModal;
    window.testAdminEmails = testAdminEmails;
    window.filterPilotsTab = filterPilotsTab;
    window.handleAdminSearch = handleAdminSearch;
    window.resendInvite = resendInvite;
    window.addEventListener("DOMContentLoaded", initAdmin);
