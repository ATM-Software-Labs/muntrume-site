import React from "react";

export interface MostUsedCar {
  car: string;
  pct: number;
}

export interface DriverData {
  dorsal: string;
  name: string;
  irating: number | null;
  license: string | null;
  fav_car: string | null;
  fav_category: string | null;
  most_used: MostUsedCar | null;
  last_race: string | null;
  is_founder?: boolean;
  status?: string;
}

export interface DriverCardProps {
  driver: DriverData;
  className?: string;
}

export const DriverCard: React.FC<DriverCardProps> = ({ driver, className = "" }) => {
  const hasLiveStats = driver.irating !== null && driver.irating !== undefined;
  const isPaddockOnly = !driver.irating && driver.status === "En el Paddock";

  return (
    <article
      className={`relative p-5 sm:p-6 rounded-2xl bg-[#121A17] border border-[#1E2A26] hover:border-[#00E699]/60 transition-all duration-300 flex flex-col justify-between group overflow-hidden ${className}`}
      style={{ minHeight: "220px" }}
    >
      {/* Indicador de estado sutil arriba a la derecha */}
      <span
        className={`absolute top-4 right-4 w-1.5 h-1.5 rounded-full ${
          hasLiveStats ? "bg-[#00E699] opacity-80 group-hover:scale-125" : "bg-[#8B9A8F]/60"
        } transition-transform`}
      />

      <div>
        {/* Cabecera de la card: Dorsal + Badge igualitario */}
        <div className="flex items-center justify-between pb-3 border-b border-[#1E2A26] mb-4">
          <span className="text-xs font-mono font-bold text-[#00E699] tracking-wider">
            {driver.dorsal}
          </span>
          <span className="text-[10px] font-mono text-[#8B9A8F] uppercase tracking-wider">
            {isPaddockOnly ? "En el Paddock" : "Piloto Muntrume Motorsport"}
          </span>
        </div>

        {/* Nombre del Piloto - Diseño idéntico para los 4 */}
        <h3 className="text-xl font-bold text-white group-hover:text-[#00E699] transition-colors tracking-tight font-display">
          {driver.name}
        </h3>
        <p className="text-[11px] font-mono uppercase tracking-wider text-[#8B9A8F] mt-0.5">
          Piloto Muntrume Motorsport
        </p>

        {/* Fila de Pills: [3912 iR] [A 4.99] [GT3] */}
        <div className="flex flex-wrap items-center gap-1.5 mt-3.5">
          {hasLiveStats ? (
            <>
              {/* Pill iRating LIVE */}
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-[#00E699]/15 text-[#00E699] border border-[#00E699]/30">
                {driver.irating} iR
              </span>

              {/* Pill Licencia Oficial */}
              {driver.license && (
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-mono font-medium bg-[#080C0A] text-neutral-200 border border-[#1E2A26]">
                  Licencia {driver.license}
                </span>
              )}

              {/* Pill Categoría Favorita */}
              {(driver.fav_category || driver.most_used?.car) && (
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-mono text-[#8B9A8F] bg-[#080C0A] border border-[#1E2A26]">
                  {driver.fav_category || "Sports Car / GT3"}
                </span>
              )}
            </>
          ) : (
            /* Si no hay datos de iRacing o está en el Paddock, nunca inventar */
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-mono text-[#8B9A8F] bg-[#080C0A] border border-[#1E2A26]">
              {isPaddockOnly ? "En el Paddock &middot; iRacing Inactivo" : "Telemetría Offline &middot; -"}
            </span>
          )}
        </div>
      </div>

      {/* Pie de la card: Coche más usado o última actividad */}
      <div className="pt-3.5 mt-4 border-t border-[#1E2A26] flex items-center justify-between text-[11px] font-mono text-[#8B9A8F]">
        {driver.most_used ? (
          <span className="truncate" title={`Coche más usado: ${driver.most_used.car} (${driver.most_used.pct}%)`}>
            Uso: <span className="text-neutral-300 font-semibold">{driver.most_used.car}</span> ({driver.most_used.pct}%)
          </span>
        ) : (
          <span>Temporada 2026 &middot; iRacing</span>
        )}
        <span className="text-xs text-[#00E699] font-bold group-hover:translate-x-0.5 transition-transform shrink-0 ml-2">
          &rarr;
        </span>
      </div>
    </article>
  );
};

export default DriverCard;
