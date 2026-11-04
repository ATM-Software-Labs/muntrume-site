import React from "react";
import LanguageSwitcher from "./LanguageSwitcher";

export interface HeaderProps {
  currentPath?: string;
}

export const Header: React.FC<HeaderProps> = ({ currentPath = "/" }) => {
  const isInicio = currentPath === "/" || currentPath === "";
  const isPilotos = currentPath.startsWith("/pilotos");
  const isPaddock = currentPath.startsWith("/paddock");

  return (
    <header className="w-full h-14 bg-[#0E1211] border-b border-[#1A2120] sticky top-0 z-50 px-4 sm:px-8 flex items-center justify-between select-none">
      {/* Izq: Logo tortuga 24px + MUNTRUME text bold */}
      <a href="/" className="flex items-center gap-2.5 group focus:outline-none shrink-0">
        <img
          src="/assets/img/logo-sm.webp"
          alt="Muntrume"
          className="h-6 w-6 object-contain transition-transform group-hover:scale-105"
          width="24"
          height="24"
        />
        <span className="font-extrabold tracking-tight text-white text-base font-display">
          MUNTRUME
        </span>
      </a>

      {/* Centro: Nav flex gap-8 (1 línea, centrado) */}
      <nav className="hidden md:flex items-center gap-8 text-xs font-mono uppercase tracking-wider">
        <a
          href="/"
          className={`py-1 transition-colors ${
            isInicio
              ? "text-[#00E699] font-bold border-b-2 border-[#00E699]"
              : "text-[#9AA8A3] hover:text-white"
          }`}
        >
          INICIO
        </a>
        <a
          href="/pilotos"
          className={`py-1 transition-colors ${
            isPilotos
              ? "text-[#00E699] font-bold border-b-2 border-[#00E699]"
              : "text-[#9AA8A3] hover:text-white"
          }`}
        >
          PILOTOS
        </a>
        <a
          href="/paddock"
          className={`py-1 transition-colors ${
            isPaddock
              ? "text-[#00E699] font-bold border-b-2 border-[#00E699]"
              : "text-[#9AA8A3] hover:text-white"
          }`}
        >
          PADDOCK
        </a>
      </nav>

      {/* Der: Radio Discord punto verde pulse + LanguageSwitcher + GARAGE ACCESS bg #00E699 rounded-full */}
      <div className="flex items-center gap-3 sm:gap-4 shrink-0">
        {/* Radio Discord */}
        <a
          href="https://discord.gg/ehX6B8JUtE"
          target="_blank"
          rel="noopener noreferrer"
          className="hidden lg:inline-flex items-center gap-2 text-xs font-mono text-[#9AA8A3] hover:text-white transition px-2.5 py-1 rounded-lg border border-transparent hover:border-[#242E2C]"
          title="Canal de Radio Discord Oficial"
        >
          <span className="w-2 h-2 rounded-full bg-[#00E699] animate-pulse" />
          <span>Radio Discord</span>
        </a>

        {/* Language Switcher */}
        <LanguageSwitcher />

        {/* GARAGE ACCESS rounded-full */}
        <a
          href="/garage"
          className="inline-flex items-center gap-1.5 bg-[#00E699] hover:bg-[#00c985] text-neutral-950 font-black text-xs font-mono uppercase tracking-wider px-4 py-1.5 rounded-full transition-all shadow-md hover:shadow-[#00E699]/20"
        >
          <span>GARAGE ACCESS</span>
        </a>
      </div>
    </header>
  );
};

export default Header;
