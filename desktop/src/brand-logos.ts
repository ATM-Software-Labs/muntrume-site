export interface CarBrandInfo {
  id: string;
  name: string;
  color: string;
  bg: string;
  svg: string;
}

const BRAND_DEFS: Array<{
  id: string;
  name: string;
  keywords: string[];
  color: string;
  bg: string;
  svg: string;
}> = [
  {
    id: "porsche",
    name: "Porsche",
    keywords: ["porsche", "911", "992", "991", "963", "718", "cayman", "gt3r", "cup"],
    color: "#f59e0b",
    bg: "rgba(245, 158, 11, 0.14)",
    svg: `<svg viewBox="0 0 24 24" fill="none" class="w-full h-full"><path d="M5 3h14l-1.2 11.5C17.2 18.2 12 21 12 21s-5.2-2.8-5.8-6.5L5 3Z" stroke="#f59e0b" stroke-width="1.6" fill="rgba(245,158,11,0.12)"/><path d="M5.6 8.5h12.8M12 3.2v17.3" stroke="#ef4444" stroke-width="1.4"/><rect x="8.8" y="6" width="6.4" height="4.5" rx="0.8" fill="#111827" stroke="#f59e0b" stroke-width="1"/></svg>`,
  },
  {
    id: "ferrari",
    name: "Ferrari",
    keywords: ["ferrari", "296", "488", "499", "sf23"],
    color: "#facc15",
    bg: "rgba(250, 204, 21, 0.14)",
    svg: `<svg viewBox="0 0 24 24" fill="none" class="w-full h-full"><path d="M6 4h12v9.5c0 4-6 7.5-6 7.5s-6-3.5-6-7.5V4Z" fill="#facc15" fill-opacity="0.18" stroke="#facc15" stroke-width="1.6"/><path d="M7 5.5h10" stroke="#ef4444" stroke-width="1.8"/><path d="M13.5 8.5c-1.5.5-2.6 1.8-2.8 3.5l-1.5 2.2 1.8.8 1-1.5 1.8 1.5.8-1.8-1.4-1.3c.6-1.2 1.5-2 2.1-2.4l-1.8-1Z" fill="#facc15"/></svg>`,
  },
  {
    id: "bmw",
    name: "BMW",
    keywords: ["bmw", "m4", "m8", "m2", "z4", "hybridv8"],
    color: "#38bdf8",
    bg: "rgba(56, 189, 248, 0.14)",
    svg: `<svg viewBox="0 0 24 24" fill="none" class="w-full h-full"><circle cx="12" cy="12" r="9" stroke="#94a3b8" stroke-width="1.8" fill="#0f172a"/><circle cx="12" cy="12" r="5.6" stroke="#cbd5e1" stroke-width="1"/><path d="M12 6.4A5.6 5.6 0 0 1 17.6 12H12V6.4Z" fill="#38bdf8"/><path d="M12 17.6A5.6 5.6 0 0 1 6.4 12H12v5.6Z" fill="#38bdf8"/><path d="M12 6.4A5.6 5.6 0 0 0 6.4 12H12V6.4Z" fill="#f8fafc"/><path d="M12 17.6A5.6 5.6 0 0 0 17.6 12H12v5.6Z" fill="#f8fafc"/></svg>`,
  },
  {
    id: "mercedes",
    name: "Mercedes-AMG",
    keywords: ["mercedes", "amg", "merc", "w12", "w13"],
    color: "#cbd5e1",
    bg: "rgba(203, 213, 225, 0.12)",
    svg: `<svg viewBox="0 0 24 24" fill="none" class="w-full h-full"><circle cx="12" cy="12" r="9" stroke="#cbd5e1" stroke-width="1.6"/><path d="M12 3.5v8.5m0 0-7.2 4.5M12 12l7.2 4.5" stroke="#e2e8f0" stroke-width="1.7" stroke-linecap="round"/></svg>`,
  },
  {
    id: "audi",
    name: "Audi",
    keywords: ["audi", "r8", "rs3", "lms"],
    color: "#f87171",
    bg: "rgba(248, 113, 113, 0.12)",
    svg: `<svg viewBox="0 0 24 24" fill="none" class="w-full h-full"><circle cx="5.8" cy="12" r="2.7" stroke="#e2e8f0" stroke-width="1.5"/><circle cx="9.9" cy="12" r="2.7" stroke="#e2e8f0" stroke-width="1.5"/><circle cx="14.1" cy="12" r="2.7" stroke="#e2e8f0" stroke-width="1.5"/><circle cx="18.2" cy="12" r="2.7" stroke="#ef4444" stroke-width="1.5"/></svg>`,
  },
  {
    id: "lamborghini",
    name: "Lamborghini",
    keywords: ["lamborghini", "lambo", "huracan", "sc63"],
    color: "#eab308",
    bg: "rgba(234, 179, 8, 0.14)",
    svg: `<svg viewBox="0 0 24 24" fill="none" class="w-full h-full"><path d="M5.5 4.5 12 3l6.5 1.5-1.2 10.2L12 21l-5.3-6.3L5.5 4.5Z" stroke="#eab308" stroke-width="1.6" fill="rgba(234,179,8,0.12)"/><path d="M8.5 11.5 12 8.5l3.5 3-1.5 4.5h-4l-1.5-4.5Z" fill="#eab308"/></svg>`,
  },
  {
    id: "mclaren",
    name: "McLaren",
    keywords: ["mclaren", "720s", "570s", "mp4"],
    color: "#fb923c",
    bg: "rgba(251, 146, 60, 0.15)",
    svg: `<svg viewBox="0 0 24 24" fill="none" class="w-full h-full"><path d="M3.5 15.5C6.5 9 13.5 6.5 20.5 7.5c-4.8 1.5-8.5 4-10.5 8-2.2 0-4.4 0-6.5 0Z" fill="#fb923c"/></svg>`,
  },
  {
    id: "aston",
    name: "Aston Martin",
    keywords: ["aston", "vantage", "amr", "valkyrie"],
    color: "#10b981",
    bg: "rgba(16, 185, 129, 0.14)",
    svg: `<svg viewBox="0 0 24 24" fill="none" class="w-full h-full"><path d="M2.5 9.5h19l-3 5.5h-13l-3-5.5Z" stroke="#10b981" stroke-width="1.5" fill="rgba(16,185,129,0.14)"/><path d="M4.5 11.5h15M7 13.5h10" stroke="#a7f3d0" stroke-width="1.2" stroke-linecap="round"/></svg>`,
  },
  {
    id: "ford",
    name: "Ford",
    keywords: ["ford", "mustang", "gt40", "fiesta", "f150"],
    color: "#3b82f6",
    bg: "rgba(59, 130, 246, 0.15)",
    svg: `<svg viewBox="0 0 24 24" fill="none" class="w-full h-full"><ellipse cx="12" cy="12" rx="9.5" ry="5.5" fill="#1d4ed8" stroke="#93c5fd" stroke-width="1.4"/><text x="12" y="14.4" text-anchor="middle" fill="#ffffff" font-size="6.8" font-weight="800" font-family="sans-serif">F</text></svg>`,
  },
  {
    id: "corvette",
    name: "Corvette",
    keywords: ["corvette", "chevrolet", "chevy", "camaro", "silverado", "c8r", "z06"],
    color: "#facc15",
    bg: "rgba(250, 204, 21, 0.14)",
    svg: `<svg viewBox="0 0 24 24" fill="none" class="w-full h-full"><path d="M4 8l7.5 3.5L9.5 17 4 14V8Z" fill="#ef4444"/><path d="M20 8l-7.5 3.5L14.5 17 20 14V8Z" fill="#facc15"/><path d="M12 6.5v11" stroke="#e2e8f0" stroke-width="1.4"/></svg>`,
  },
  {
    id: "acura",
    name: "Acura",
    keywords: ["acura", "nsx", "arx"],
    color: "#f43f5e",
    bg: "rgba(244, 63, 94, 0.14)",
    svg: `<svg viewBox="0 0 24 24" fill="none" class="w-full h-full"><path d="M12 4 5.5 19h2.8l3.7-9.2 3.7 9.2h2.8L12 4Z" fill="#e2e8f0"/><path d="M9.2 14.5h5.6" stroke="#f43f5e" stroke-width="1.8"/></svg>`,
  },
  {
    id: "cadillac",
    name: "Cadillac",
    keywords: ["cadillac", "ctsv", "vseries"],
    color: "#38bdf8",
    bg: "rgba(56, 189, 248, 0.12)",
    svg: `<svg viewBox="0 0 24 24" fill="none" class="w-full h-full"><path d="M4 7h16l-2 9-6 4-6-4-2-9Z" stroke="#cbd5e1" stroke-width="1.5" fill="rgba(56,189,248,0.12)"/><path d="M7.5 9.5h4v4h-4zm5 0h4v4h-4z" fill="#38bdf8" fill-opacity="0.7"/></svg>`,
  },
  {
    id: "dallara",
    name: "Dallara",
    keywords: ["dallara", "f3", "ir18", "ir01", "p217", "il15", "indy"],
    color: "#60a5fa",
    bg: "rgba(96, 165, 250, 0.14)",
    svg: `<svg viewBox="0 0 24 24" fill="none" class="w-full h-full"><path d="M5 5h7.5c4.2 0 7 2.8 7 7s-2.8 7-7 7H5V5Z" stroke="#60a5fa" stroke-width="1.8" fill="rgba(96,165,250,0.12)"/><path d="M8.5 9h3.5c2 0 3.2 1.2 3.2 3s-1.2 3-3.2 3H8.5V9Z" fill="#60a5fa"/></svg>`,
  },
  {
    id: "mazda",
    name: "Mazda",
    keywords: ["mazda", "mx5", "miata"],
    color: "#94a3b8",
    bg: "rgba(148, 163, 184, 0.14)",
    svg: `<svg viewBox="0 0 24 24" fill="none" class="w-full h-full"><ellipse cx="12" cy="12" rx="9" ry="7" stroke="#cbd5e1" stroke-width="1.6"/><path d="M5.5 9.5 12 14.5l6.5-5" stroke="#cbd5e1" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  },
  {
    id: "toyota",
    name: "Toyota",
    keywords: ["toyota", "gr86", "tundra", "camry"],
    color: "#ef4444",
    bg: "rgba(239, 68, 68, 0.14)",
    svg: `<svg viewBox="0 0 24 24" fill="none" class="w-full h-full"><ellipse cx="12" cy="12" rx="9" ry="6" stroke="#ef4444" stroke-width="1.6"/><ellipse cx="12" cy="12" rx="2.6" ry="5.6" stroke="#ef4444" stroke-width="1.3"/><ellipse cx="12" cy="9.5" rx="5.8" ry="2.1" stroke="#ef4444" stroke-width="1.3"/></svg>`,
  },
  {
    id: "honda",
    name: "Honda",
    keywords: ["honda", "civic", "hpd"],
    color: "#ef4444",
    bg: "rgba(239, 68, 68, 0.14)",
    svg: `<svg viewBox="0 0 24 24" fill="none" class="w-full h-full"><rect x="4" y="4" width="16" height="16" rx="4" stroke="#ef4444" stroke-width="1.6"/><path d="M8 7.5v9M16 7.5v9M8 12h8" stroke="#f8fafc" stroke-width="2" stroke-linecap="round"/></svg>`,
  },
  {
    id: "hyundai",
    name: "Hyundai",
    keywords: ["hyundai", "elantra", "veloster", "tcr"],
    color: "#38bdf8",
    bg: "rgba(56, 189, 248, 0.14)",
    svg: `<svg viewBox="0 0 24 24" fill="none" class="w-full h-full"><ellipse cx="12" cy="12" rx="9" ry="5.8" stroke="#38bdf8" stroke-width="1.6"/><path d="M8.5 15.5 10.5 8.5M13.5 15.5l2-7M9.5 12h5" stroke="#e2e8f0" stroke-width="1.8" stroke-linecap="round"/></svg>`,
  },
  {
    id: "superformula",
    name: "Super Formula",
    keywords: ["superformula", "sf23", "formula", "f4", "f1600", "vee", "skip", "renault", "lotus"],
    color: "#a855f7",
    bg: "rgba(168, 85, 247, 0.14)",
    svg: `<svg viewBox="0 0 24 24" fill="none" class="w-full h-full"><path d="M4 14h16M7 10h10M10 6h4l2 12H8l2-12Z" stroke="#c084fc" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  },
];

const DEFAULT_BRAND: CarBrandInfo = {
  id: "motorsport",
  name: "Motorsport",
  color: "#10b981",
  bg: "rgba(16, 185, 129, 0.12)",
  svg: `<svg viewBox="0 0 24 24" fill="none" class="w-full h-full"><circle cx="12" cy="12" r="8.5" stroke="#10b981" stroke-width="1.5"/><path d="M8 15.5 12 7l4 8.5-4-2-4 2Z" fill="#10b981"/></svg>`,
};

export function getCarBrandInfo(carNameOrFolder: string): CarBrandInfo {
  const norm = carNameOrFolder.toLowerCase().replace(/[^a-z0-9]/g, "");
  for (const b of BRAND_DEFS) {
    if (b.keywords.some((kw) => norm.includes(kw))) {
      return { id: b.id, name: b.name, color: b.color, bg: b.bg, svg: b.svg };
    }
  }
  return DEFAULT_BRAND;
}

export function createBrandLogoBadge(carNameOrFolder: string, size: "sm" | "md" = "md"): HTMLSpanElement {
  const brand = getCarBrandInfo(carNameOrFolder);
  const el = document.createElement("span");
  const dims = size === "sm" ? "w-6 h-6 p-1 rounded-lg" : "w-8 h-8 p-1.5 rounded-xl";
  el.className = `inline-flex items-center justify-center shrink-0 border ${dims}`;
  el.style.background = brand.bg;
  el.style.borderColor = `${brand.color}44`;
  el.title = brand.name;
  el.innerHTML = brand.svg;
  return el;
}
