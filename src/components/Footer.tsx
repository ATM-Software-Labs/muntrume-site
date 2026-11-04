import React from "react";

export const Footer: React.FC = () => {
  return (
    <footer className="w-full min-h-[48px] bg-[#0E1211] border-t border-[#1A2120] px-4 sm:px-8 py-2.5 sm:py-0 flex flex-col md:flex-row items-center justify-between gap-2.5 md:gap-4 text-xs font-sans select-none">
      {/* Left: Brand, Copyright & City */}
      <div className="text-[12px] text-[#9AA8A3] whitespace-nowrap text-center md:text-left shrink-0">
        <span className="text-white font-semibold">Muntrume Motorsport</span> &copy; 2026 &middot; Simracing Team &middot; Barcelona, España &middot;{" "}
        <a href="https://muntru.me" className="text-[#00E699] hover:underline font-medium">
          muntru.me
        </a>
      </div>

      {/* Center: Links en 1 sola línea nowrap (prohibido 2 filas) */}
      <div className="flex items-center gap-4 sm:gap-6 text-[12px] text-[#9AA8A3] whitespace-nowrap overflow-x-auto py-0.5">
        <a href="/pilotos" className="hover:text-white transition-colors">Pilotos</a>
        <span className="text-[#242E2C]">&middot;</span>
        <a href="/paddock" className="hover:text-white transition-colors">Paddock</a>
        <span className="text-[#242E2C]">&middot;</span>
        <a href="/garage" className="hover:text-white transition-colors">Garage Access</a>
        <span className="text-[#242E2C]">&middot;</span>
        <a href="https://discord.gg/ehX6B8JUtE" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">Discord</a>
        <span className="text-[#242E2C]">&middot;</span>
        <a href="https://www.youtube.com/@jostrume16gameplays28" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">YouTube</a>
        <span className="text-[#242E2C]">&middot;</span>
        <a href="https://twitch.tv/muntrumemrt" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">Twitch</a>
      </div>

      {/* Right: Punto verde parpadeante + Garage 61 Connected · 4 Drivers Active */}
      <div className="flex items-center gap-2 font-mono text-[11px] text-[#9AA8A3] whitespace-nowrap shrink-0">
        <span className="w-2 h-2 rounded-full bg-[#00E699] animate-pulse" />
        <span className="text-[#00E699] font-medium">Garage 61 Connected</span>
        <span className="text-[#242E2C]">&bull;</span>
        <span>4 Drivers Active</span>
      </div>
    </footer>
  );
};

export default Footer;
