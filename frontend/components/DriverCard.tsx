import React, { useState } from "react";

export interface MostUsedCar {
  car: string;
  pct: number;
}

export interface DriverData {
  dorsal: string;
  name: string;
  cust_id?: string | number | null;
  irating: number | null;
  license: string | null;
  country?: string;
  flag?: string;
  flag_code?: string;
  helmet_url?: string | null;
  fav_category?: string | null;
  most_used?: MostUsedCar | null;
  fav_car?: string | null;
  last_race?: string | null;
  is_founder?: boolean;
  status?: string;
}

export interface DriverCardProps {
  driver: DriverData;
  className?: string;
}

export const DriverCard: React.FC<DriverCardProps> = ({ driver, className = "" }) => {
  const [imgError, setImgError] = useState(false);
  const hasLiveStats = driver.irating !== null && driver.irating !== undefined;
  const isPaddock = !driver.irating && (driver.status === "En el Paddock" || !driver.cust_id);
  const flagIcon = driver.flag || "🇪🇸";

  return (
    <article
      className={`relative p-5 sm:p-6 rounded-2xl bg-[#121A17] border border-[#1E2A26] hover:border-[#00E699]/60 transition-all duration-300 flex flex-col justify-between group overflow-hidden ${className}`}
      style={{ minHeight: "260px" }}
    >
      <div>
        {/* Header: #01 en mono 12px verde #00E699 */}
        <div className="flex items-center justify-between pb-3 border-b border-[#1E2A26] mb-4">
          <span className="font-mono text-xs font-bold text-[#00E699] tracking-wider">
            {driver.dorsal}
          </span>
          <span className="text-[10px] font-mono uppercase text-[#8B9A8F] tracking-widest">
            {isPaddock ? "En el Paddock" : "Oficial 2026"}
          </span>
        </div>

        {/* Nombre + DATOS al lado como pills: Alberto Trujillo [🇪🇸] [3912 iR] [A 4.99] [GT3] */}
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <h3 className="text-base sm:text-lg font-bold text-white group-hover:text-[#00E699] transition-colors tracking-tight font-display">
              {driver.name}
            </h3>

            {/* Pill Bandera (solo una pill más al lado) */}
            <span
              className="inline-flex items-center px-1.5 py-0.5 rounded bg-[#1E2A26] text-[10px] font-mono text-neutral-200 border border-white/5"
              title={driver.country || "Spain"}
            >
              {flagIcon}
            </span>

            {/* Pill iRating LIVE */}
            {hasLiveStats && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-[#1E2A26] text-[10px] font-mono font-bold text-[#00E699] border border-[#00E699]/30">
                {driver.irating} iR
              </span>
            )}

            {/* Pill Licencia Oficial */}
            {driver.license && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-[#1E2A26] text-[10px] font-mono text-neutral-300 border border-white/5">
                {driver.license}
              </span>
            )}

            {/* Pill Categoría */}
            {driver.fav_category && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-[#1E2A26] text-[10px] font-mono text-[#8B9A8F] border border-white/5">
                {driver.fav_category}
              </span>
            )}
          </div>

          {/* Subtítulo: Todos "Piloto Muntrume Motorsport - Sant Andreu, BCN" 10px uppercase #8B9A8F */}
          <p className="text-[10px] font-mono uppercase tracking-wider text-[#8B9A8F]">
            Piloto Muntrume Motorsport &middot; Sant Andreu, BCN
          </p>
        </div>

        {/* Centro: Casco real iRacing 80x80px con fondo #1E2A26 rounded 12px. Hover scale 1.1 + glow verde */}
        <div className="my-5 flex items-center justify-center">
          <div className="w-20 h-20 rounded-xl bg-[#1E2A26] border border-[#2A3A34] overflow-hidden flex items-center justify-center relative group-hover:scale-110 group-hover:shadow-[0_0_20px_rgba(0,230,153,0.3)] transition-all duration-300">
            {driver.helmet_url && !imgError ? (
              <img
                src={driver.helmet_url}
                alt={`Casco oficial de ${driver.name}`}
                className="w-full h-full object-contain p-1"
                onError={() => setImgError(true)}
                loading="lazy"
              />
            ) : (
              /* Casco genérico vector verde #00E699 si helmet_url es null o falla */
              <svg
                className="w-12 h-12 text-[#00E699]"
                viewBox="0 0 100 100"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M26 56 C24 38 34 20 54 18 C74 16 82 32 82 48 C82 60 76 74 68 78 C60 82 46 82 36 80 C30 79 27 70 26 56 Z"
                  fill="#121A17"
                  stroke="#00E699"
                  strokeWidth="2.5"
                  strokeLinejoin="round"
                />
                <path
                  d="M32 44 C42 42 66 43 78 48 C77 56 73 62 64 64 C48 64 35 62 31 52 C30 48 31 45 32 44 Z"
                  fill="#050807"
                  stroke="#00E699"
                  strokeWidth="1.5"
                />
                <path
                  d="M38 48 C48 46 64 47 74 51"
                  stroke="#00E699"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
                <circle cx="34" cy="50" r="2" fill="#00E699" />
                <path d="M36 68 L48 68" stroke="#00E699" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            )}
          </div>
        </div>
      </div>

      {/* Footer: Más usado / Fav o En el Paddock */}
      <div className="pt-3 border-t border-[#1E2A26] text-[11px] font-mono text-[#8B9A8F]">
        {driver.most_used ? (
          <div className="truncate">
            <span className="text-neutral-400">Más usado:</span>{" "}
            <span className="text-white font-semibold">{driver.most_used.car}</span> &middot;{" "}
            <span className="text-[#00E699] font-bold">{driver.most_used.pct}%</span>
            {driver.fav_car && driver.fav_car !== driver.most_used.car && (
              <span className="text-neutral-400"> | Fav: {driver.fav_car}</span>
            )}
          </div>
        ) : isPaddock ? (
          <div className="flex items-center justify-between text-neutral-400">
            <span>En el Paddock</span>
            <span className="text-[10px] text-[#00E699] uppercase">Fundador</span>
          </div>
        ) : (
          <div className="text-neutral-400">Temporada 2026 &middot; iRacing</div>
        )}
      </div>
    </article>
  );
};

export default DriverCard;
