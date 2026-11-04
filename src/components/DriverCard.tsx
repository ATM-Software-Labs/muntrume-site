import React from "react";

export interface MostUsedCar {
  car: string;
  pct: number;
}

export interface DriverData {
  slug?: string;
  dorsal: string;
  name: string;
  fullName?: string;
  badge?: "FOUNDER" | "DRIVER" | string;
  role: string;
  cust_id?: string | number | null;
  irating: number | null;
  license: string | null;
  country?: string;
  flag?: string;
  flag_code?: string;
  helmet_url?: string | null;
  initials?: string;
  fav_category?: string | null;
  most_used?: MostUsedCar | null;
  fav_car?: string | null;
  is_founder?: boolean;
  status?: string;
}

export interface DriverCardProps {
  driver: DriverData;
  className?: string;
}

export const DriverCard: React.FC<DriverCardProps> = ({ driver, className = "" }) => {
  const hasLiveStats = driver.irating !== null && driver.irating !== undefined;
  const isPaddock = !driver.irating && (driver.status === "En el Paddock" || !driver.cust_id);
  const formattedIr = hasLiveStats ? `${Math.round(driver.irating! / 100) / 10}k iR` : null;
  const targetUrl = driver.slug ? `/pilotos/${driver.slug}` : "#";

  return (
    <a
      href={targetUrl}
      className={`p-5 sm:p-6 rounded-2xl bg-[#1A2120] border border-[#242E2C] hover:border-[#00E699]/60 transition-all duration-300 flex flex-col justify-between group relative overflow-hidden block ${className}`}
      style={{ minHeight: "290px" }}
    >
      <span className="absolute top-4 right-4 w-1.5 h-1.5 rounded-full bg-[#00E699] opacity-80 group-hover:scale-125 transition-transform" />

      <div>
        {/* Header Card: #01 / #1 + FOUNDER / DRIVER badge */}
        <div className="flex items-center justify-between pb-3 border-b border-[#242E2C] mb-4">
          <span className="font-mono text-xs font-bold text-[#00E699] tracking-wider">
            {driver.dorsal}
          </span>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#0E1211] text-[#9AA8A3] border border-[#242E2C] uppercase tracking-wider font-semibold">
            {driver.badge || (driver.is_founder ? "FOUNDER" : "DRIVER")}
          </span>
        </div>

        {/* Casco real iRacing 64x64 o iniciales JC para Juanlu */}
        <div className="my-4 flex items-center justify-center">
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl bg-[#1E2A26] border border-[#242E2C] overflow-hidden flex items-center justify-center relative group-hover:scale-110 group-hover:shadow-[0_0_20px_rgba(0,230,153,0.3)] transition-all duration-300">
            {driver.helmet_url ? (
              <img
                src={driver.helmet_url}
                alt={`Casco de ${driver.name}`}
                width={64}
                height={64}
                className="w-full h-full object-contain p-1 rounded-lg"
                loading="lazy"
                onError={(e) => {
                  (e.currentTarget as HTMLElement).style.display = "none";
                  const fallback = (e.currentTarget.parentElement?.querySelector(".fallback-initials")) as HTMLElement;
                  if (fallback) fallback.style.display = "flex";
                }}
              />
            ) : null}
            <div
              className={`w-full h-full ${
                driver.helmet_url ? "hidden fallback-initials" : "flex"
              } items-center justify-center font-mono font-bold text-base text-[#00E699]`}
            >
              {driver.initials || (driver.fullName || driver.name).slice(0, 2).toUpperCase()}
            </div>
          </div>
        </div>

        {/* Nombre del Piloto */}
        <h2 className="text-lg font-bold text-white group-hover:text-[#00E699] transition-colors tracking-tight font-display">
          {driver.name}
        </h2>

        {/* Rol Oficial */}
        <div className="text-[11px] font-mono uppercase tracking-wider text-[#9AA8A3] mt-0.5">
          {driver.role}
        </div>

        {/* Debajo rol: fila de pills [🇪🇸 ES] [3.9k iR] [A 4.99] */}
        <div className="flex flex-wrap items-center gap-1.5 mt-3">
          <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-[#242E2C] text-[10px] font-mono text-neutral-200 border border-white/5">
            {driver.flag || "🇪🇸 ES"}
          </span>

          {formattedIr && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-[#242E2C] text-[10px] font-mono font-bold text-[#00E699] border border-[#00E699]/30">
              {formattedIr}
            </span>
          )}

          {driver.license && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-[#242E2C] text-[10px] font-mono text-neutral-300 border border-white/5">
              {driver.license}
            </span>
          )}

          {driver.fav_category && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-[#242E2C] text-[10px] font-mono text-[#9AA8A3] border border-white/5">
              {driver.fav_category}
            </span>
          )}
        </div>
      </div>

      {/* Footer: Más usado o En el Paddock */}
      <div className="pt-3.5 mt-4 border-t border-[#242E2C] text-[11px] font-mono text-[#9AA8A3]">
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
            <span className="text-[10px] text-[#00E699] uppercase font-bold">Fundador</span>
          </div>
        ) : (
          <div className="truncate">
            <span className="text-neutral-400">Más usado:</span>{" "}
            <span className="text-white font-semibold">Porsche 911 GT3 R</span> &middot;{" "}
            <span className="text-[#00E699] font-bold">42%</span>
          </div>
        )}
      </div>
    </a>
  );
};

export default DriverCard;
