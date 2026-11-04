import React from "react";
import DriverCard, { DriverData } from "../../components/DriverCard";

export const metadata = {
  title: "Pilotos del Equipo | Muntrume Motorsport",
  description: "Alineación oficial de 4 pilotos de Muntrume Motorsport en iRacing."
};

const INITIAL_DRIVERS: DriverData[] = [
  {
    dorsal: "#1",
    name: "Alberto Trujillo",
    badge: "FOUNDER",
    role: "Team Principal & Telemetry",
    cust_id: "993381",
    irating: null,
    license: null,
    flag: "🇪🇸 ES",
    fav_category: "GT3 Pro",
    helmet_url: "https://members-ng.iracing.com/member/GetHelmetImage?custId=993381",
    most_used: null,
    fav_car: null,
    initials: "AT"
  },
  {
    dorsal: "#2",
    name: "Mateo Berbis",
    badge: "DRIVER",
    role: "Endurance & GT3 Driver",
    cust_id: "1134615",
    irating: null,
    license: null,
    flag: "🇪🇸 ES",
    fav_category: "GT3 Endurance",
    helmet_url: "https://members-ng.iracing.com/member/GetHelmetImage?custId=1134615",
    most_used: null,
    fav_car: null,
    initials: "MB"
  },
  {
    dorsal: "#3",
    name: "Eduardo Chongkan",
    badge: "DRIVER",
    role: "Prototype & Formula Driver",
    cust_id: "1076585",
    irating: null,
    license: null,
    flag: "🇪🇸 ES",
    fav_category: "Prototipos GTP",
    helmet_url: "https://members-ng.iracing.com/member/GetHelmetImage?custId=1076585",
    most_used: null,
    fav_car: null,
    initials: "EC"
  },
  {
    dorsal: "#4",
    name: "Juanlu Carrillo",
    badge: "FOUNDER",
    role: "Touring & Single-Seater",
    cust_id: null,
    irating: null,
    license: null,
    flag: "🇪🇸 ES",
    fav_category: "Monoplazas",
    helmet_url: null,
    initials: "JC",
    status: "En el Paddock"
  }
];

export default async function PilotosPage() {
  let drivers = INITIAL_DRIVERS;

  try {
    // Sincronización con el Cloudflare Worker seguro
    const apiUrl = process.env.NODE_ENV === "development"
      ? "http://localhost:8787/api/drivers"
      : "https://muntrume.atrumin16.workers.dev/api/drivers";

    const res = await fetch(apiUrl, { next: { revalidate: 21600 } });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length) {
        drivers = data;
      }
    }
  } catch {
    // Fallback seguro: datos iniciales sin inventar números
  }

  return (
    <main className="min-h-screen bg-[#0E1211] text-[#F5F5F5] pt-20 pb-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
      <section className="text-center max-w-3xl mx-auto space-y-3.5 pt-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#1A2120] border border-[#242E2C] text-xs font-mono text-[#00E699]">
          <span className="w-2 h-2 rounded-full bg-[#00E699] animate-pulse" />
          <span>ALINEACIÓN OFICIAL · 4 PILOTOS · iRACING ESPORTS DIVISION · SANT ANDREU, BCN</span>
        </div>
        <h1 className="text-4xl sm:text-6xl font-extrabold text-white tracking-tight font-display">
          PILOTOS <span className="text-[#00E699]">DEL EQUIPO</span>
        </h1>
        <p className="text-sm sm:text-base text-[#9AA8A3] leading-relaxed max-w-xl mx-auto">
          Roster oficial de competición para campeonatos de resistencia y sprint en iRacing.
        </p>
      </section>

      <section>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {drivers.map((driver) => (
            <DriverCard key={driver.dorsal} driver={driver} />
          ))}
        </div>
      </section>
    </main>
  );
}
