import React, { useState, useEffect, useRef } from "react";

export interface LangOption {
  code: string;
  flag: string;
  label: string;
  icon?: string;
}

export const LANGS: LangOption[] = [
  { code: "EN", flag: "🇬🇧", label: "EN" },
  { code: "ES", flag: "🇪🇸", label: "ES" },
  { code: "CA", flag: "🔴🟡", label: "CA", icon: "/flags/senyera.png" }
];

export const LanguageSwitcher: React.FC = () => {
  const [current, setCurrent] = useState<LangOption>(LANGS[1]); // Default ES
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("muntrume_lang");
      if (saved) {
        const found = LANGS.find((l) => l.code === saved);
        if (found) setCurrent(found);
      }
    } catch {}

    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (lang: LangOption) => {
    setCurrent(lang);
    setOpen(false);
    try {
      localStorage.setItem("muntrume_lang", lang.code);
      document.documentElement.lang = lang.code.toLowerCase();
    } catch {}
  };

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 bg-[#1A2120] hover:bg-[#242E2C] border border-[#242E2C] hover:border-[#00E699]/40 rounded-lg px-2.5 py-1.5 text-[12px] font-mono text-white transition-all cursor-pointer focus:outline-none"
        aria-haspopup="true"
        aria-expanded={open}
      >
        <span className="text-sm leading-none">{current.flag}</span>
        <span className="font-semibold text-neutral-200">{current.label}</span>
        <svg
          className={`w-3 h-3 text-[#9AA8A3] transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 mt-1 w-28 rounded-lg bg-[#1A2120] border border-[#242E2C] shadow-2xl py-1 z-50 animate-fadeIn">
          {LANGS.map((lang) => (
            <button
              key={lang.code}
              type="button"
              onClick={() => handleSelect(lang)}
              className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs font-mono transition-colors text-left cursor-pointer ${
                current.code === lang.code
                  ? "bg-[#00E699]/15 text-[#00E699] font-bold"
                  : "text-neutral-300 hover:bg-white/5 hover:text-white"
              }`}
            >
              <span className="text-sm leading-none">{lang.flag}</span>
              <span>{lang.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default LanguageSwitcher;
