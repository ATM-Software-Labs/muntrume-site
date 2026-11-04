import React from "react";
import { PILOTOS } from "../../../lib/pilotos";

export async function generateStaticParams() {
  return [
    { slug: "albertot" },
    { slug: "mateob" },
    { slug: "eduardoc" },
    { slug: "juanluc" }
  ];
}

export async function generateMetadata({ params }: { params: { slug: string } }) {
  const p = PILOTOS.find((x) => x.slug === params.slug) || PILOTOS[0];
  return { title: `${p.fullName} | Muntrume` };
}

export default function DriverDetailPage({ params }: { params: { slug: string } }) {
  const driver = PILOTOS.find((x) => x.slug === params.slug) || PILOTOS[0];

  const hasLiveStats = driver.cust_id !== null;
  const irating = driver.cust_id === 993381 ? "3.9k iR" : driver.cust_id === 1134615 ? "3.4k iR" : driver.cust_id === 1076585 ? "3.7k iR" : null;
  const license = driver.cust_id ? "A 4.99" : null;

  return (
    <main className="min-h-screen bg-[#0E1211] text-[#F5F5F5] pt-16 pb-20 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
      {/* Top back breadcrumb */}
      <div className="pt-4">
        <a
          href="/pilotos"
          className="inline-flex items-center gap-2 text-xs font-mono text-[#9AA8A3] hover:text-[#00E699] transition"
        >
          &larr; Volver a la alineación del equipo
        </a>
      </div>

      {/* Hero 120px casco grande + dorsal # + name + [🇪🇸 ES] [iR] [Lic] + Garage 61 Connected */}
      <section className="p-6 sm:p-8 rounded-2xl bg-[#1A2120] border border-[#242E2C] flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex flex-col sm:flex-row items-center gap-6 text-center sm:text-left">
          <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-2xl bg-[#1E2A26] border border-[#242E2C] flex items-center justify-center overflow-hidden shrink-0 shadow-lg relative">
            {driver.helmet_url ? (
              <img
                src={driver.helmet_url}
                alt={`Casco de ${driver.fullName}`}
                width={120}
                height={120}
                className="w-full h-full object-contain p-2"
              />
            ) : (
              <div className="font-mono font-bold text-3xl text-[#00E699]">
                {driver.initials || "JC"}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
              <span className="font-mono text-sm font-bold text-[#00E699] tracking-wider">
                {driver.dorsal}
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#0E1211] text-[#9AA8A3] border border-[#242E2C] uppercase font-semibold">
                {driver.badge}
              </span>
              <span className="text-xs font-mono text-[#9AA8A3]">
                {driver.role}
              </span>
            </div>

            <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight font-display">
              {driver.fullName}
            </h1>

            {/* Pills row: [🇪🇸 ES] [iR] [Lic] */}
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-1">
              <span className="inline-flex items-center px-2 py-0.5 rounded bg-[#242E2C] text-xs font-mono text-neutral-200">
                {driver.flag} {driver.flag_code}
              </span>
              {irating && (
                <span className="inline-flex items-center px-2 py-0.5 rounded bg-[#242E2C] text-xs font-mono font-bold text-[#00E699] border border-[#00E699]/30">
                  {irating}
                </span>
              )}
              {license && (
                <span className="inline-flex items-center px-2 py-0.5 rounded bg-[#242E2C] text-xs font-mono text-neutral-300">
                  {license}
                </span>
              )}
              <span className="inline-flex items-center px-2 py-0.5 rounded bg-[#242E2C] text-xs font-mono text-[#9AA8A3]">
                {driver.fav_category}
              </span>
            </div>
          </div>
        </div>

        {/* Garage 61 badge indicator */}
        <div className="flex flex-col items-center sm:items-end gap-1 font-mono text-xs text-[#9AA8A3]">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#00E699] animate-pulse" />
            <span className="text-white font-bold">Garage 61 Connected</span>
          </div>
          <span className="text-[11px] text-[#9AA8A3]">
            {driver.cust_id ? `iRacing ID: ${driver.cust_id}` : "En el Paddock Oficial"}
          </span>
        </div>
      </section>

      {/* Tabs Layout */}
      <section className="space-y-6">
        <div className="flex border-b border-[#242E2C] text-xs sm:text-sm font-mono overflow-x-auto gap-4 sm:gap-8 pb-px">
          <button type="button" className="pb-3 border-b-2 border-[#00E699] text-[#00E699] font-bold">
            Overview
          </button>
          <button type="button" className="pb-3 text-[#9AA8A3] hover:text-white">
            Stats Live
          </button>
          <button type="button" className="pb-3 text-[#9AA8A3] hover:text-white">
            News
          </button>
          <button type="button" className="pb-3 text-[#9AA8A3] hover:text-white">
            Setups
          </button>
          <button type="button" className="pb-3 text-[#9AA8A3] hover:text-white">
            Resultados
          </button>
        </div>

        {/* Tab content: Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 p-6 rounded-2xl bg-[#1A2120] border border-[#242E2C] space-y-4">
            <h2 className="text-base font-bold text-white font-mono uppercase tracking-wider flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#00E699]" />
              Biografía & Rol en el Equipo
            </h2>
            <p className="text-sm text-[#9AA8A3] leading-relaxed">
              {driver.bio}
            </p>
            <div className="pt-4 border-t border-[#242E2C] grid grid-cols-2 gap-4 text-xs font-mono">
              <div>
                <span className="text-[#9AA8A3] block">Equipo</span>
                <span className="text-white font-bold">Muntrume Motorsport</span>
              </div>
              <div>
                <span className="text-[#9AA8A3] block">Coche Favorito</span>
                <span className="text-white font-bold">{driver.fav_car || "Todos los vehículos GT3 / GTP"}</span>
              </div>
            </div>
          </div>

          <div className="p-6 rounded-2xl bg-[#1A2120] border border-[#242E2C] space-y-4">
            <h2 className="text-base font-bold text-white font-mono uppercase tracking-wider flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#00E699]" />
              Telemetría & Setups
            </h2>
            <div className="space-y-3 text-xs font-mono">
              <div className="flex justify-between pb-2 border-b border-[#242E2C]">
                <span className="text-[#9AA8A3]">Dorsal</span>
                <span className="text-white font-bold">{driver.dorsal}</span>
              </div>
              <div className="flex justify-between pb-2 border-b border-[#242E2C]">
                <span className="text-[#9AA8A3]">Categoría</span>
                <span className="text-white font-bold">{driver.fav_category}</span>
              </div>
              <div className="flex justify-between pb-2 border-b border-[#242E2C]">
                <span className="text-[#9AA8A3]">Estado</span>
                <span className="text-[#00E699] font-bold">
                  {driver.cust_id ? "En Competición Activa" : "En el Paddock"}
                </span>
              </div>
            </div>
            <div className="pt-2">
              <a
                href="/garage"
                className="w-full inline-block text-center py-2.5 rounded-xl bg-[#00E699] hover:bg-[#00c985] text-neutral-950 font-black text-xs uppercase tracking-wider transition"
              >
                Abrir Garage Telemetry &rarr;
              </a>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
