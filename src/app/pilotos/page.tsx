import React from "react";
import DriverCard from "../../components/DriverCard";
import { PILOTOS } from "../../lib/pilotos";

export const metadata = {
  title: "Pilotos del Equipo | Muntrume Motorsport",
  description: "Alineación oficial de 4 pilotos de Muntrume Motorsport en iRacing."
};

export default function PilotosPage() {
  const drivers = PILOTOS.map((p) => {
    let irating: number | null = null;
    let license: string | null = null;

    if (p.cust_id === 993381) {
      irating = 3912;
      license = "A 4.99";
    } else if (p.cust_id === 1134615) {
      irating = 3410;
      license = "A 4.85";
    } else if (p.cust_id === 1076585) {
      irating = 3720;
      license = "A 4.90";
    }

    return {
      slug: p.slug,
      dorsal: p.dorsal,
      name: p.name,
      fullName: p.fullName,
      badge: p.badge,
      role: p.role,
      cust_id: p.cust_id,
      irating,
      license,
      flag: `${p.flag} ${p.flag_code}`,
      fav_category: p.fav_category,
      helmet_url: p.helmet_url,
      initials: p.initials,
      fav_car: p.fav_car,
      most_used: p.cust_id === 993381 ? { car: "Porsche 911 GT3 R (992)", pct: 42 } : null,
      status: p.cust_id ? "Activo" : "En el Paddock"
    };
  });

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
        <div className="flex flex-wrap items-center justify-center gap-2 pt-3">
          <button
            type="button"
            className="px-3.5 py-1.5 rounded-full text-xs font-mono font-bold bg-[#00E699] text-neutral-950 transition"
          >
            Todos (4)
          </button>
          <button
            type="button"
            className="px-3.5 py-1.5 rounded-full text-xs font-mono font-bold bg-[#1A2120] text-[#9AA8A3] border border-[#242E2C] hover:text-white transition"
          >
            GTP
          </button>
          <button
            type="button"
            className="px-3.5 py-1.5 rounded-full text-xs font-mono font-bold bg-[#1A2120] text-[#9AA8A3] border border-[#242E2C] hover:text-white transition"
          >
            GT3
          </button>
          <button
            type="button"
            className="px-3.5 py-1.5 rounded-full text-xs font-mono font-bold bg-[#1A2120] text-[#9AA8A3] border border-[#242E2C] hover:text-white transition"
          >
            Monoplazas
          </button>
        </div>
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
