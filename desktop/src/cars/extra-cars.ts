import type { RawCarEntry } from "./catalog";

/**
 * Cars that exist on iRacing and were missing from the catalog.
 * Names and legacy flags follow the iRacing support article
 * "Filepath for active iRacing cars" (modified 1 May 2026) and the
 * 2026 Season 3 / Season 4 release notes on support.iracing.com.
 * A car with no single verified constructor stays under "Sin fabricante único"
 * and off the public brand pages.
 */
const U = "Sin fabricante único";
const N = "logo-neutral";

export const EXTRA_IRACING_CARS: readonly RawCarEntry[] = [
  // Prototypes and GT that the filepath lists and this catalog did not.
  { carFolder: "audir18", brand: "Audi", model: "R18", carClass: "Prototype", svgLogoId: "logo-audi", accentColor: "#C0C0C0", specs: "LMP1 hybrid · Audi Sport" },
  { carFolder: "porsche919", brand: "Porsche", model: "919 Hybrid", carClass: "Prototype", svgLogoId: "logo-porsche", accentColor: "#C0C0C0", specs: "LMP1 hybrid" },
  { carFolder: "porschemissionr", brand: "Porsche", model: "Mission R", carClass: "Prototype", svgLogoId: "logo-porsche", accentColor: "#C0C0C0", specs: "Electric concept racer" },
  { carFolder: "c7vettedp", brand: "Chevrolet", model: "Corvette C7 Daytona Prototype", carClass: "Prototype", svgLogoId: "logo-chevy", accentColor: "#C5A017", specs: "IMSA Daytona Prototype" },
  { carFolder: "fordgtgt3", brand: "Ford", model: "GT GT3", carClass: "GT3", svgLogoId: "logo-ford", accentColor: "#003478", specs: "Ford GT · GT3" },
  { carFolder: "radicalsr10", brand: "Radical", model: "SR10", carClass: "Prototype", svgLogoId: "logo-radical", accentColor: "#C0C0C0", specs: "Ford EcoBoost prototype" },
  { carFolder: "rileydp", brand: "Riley", model: "Mk XX Daytona Prototype 2008", carClass: "Prototype", svgLogoId: "logo-riley", accentColor: "#FFFFFF", specs: "Daytona Prototype", legacy: true },

  { carFolder: "ferrarievogt3", brand: "Ferrari", model: "488 GT3 Evo 2020", carClass: "GT3", svgLogoId: "logo-ferrari", accentColor: "#FF2800", specs: "3.9L Twin-Turbo V8 · GT3 Evo" },
  { carFolder: "bmwz4gt3", brand: "BMW", model: "Z4 GT3", carClass: "GT3", svgLogoId: "logo-bmw", accentColor: "#0066B1", specs: "GT3", legacy: true },
  { carFolder: "mclarenmp4", brand: "McLaren", model: "MP4-12C GT3", carClass: "GT3", svgLogoId: "logo-mclaren", accentColor: "#FF8000", specs: "GT3" },
  { carFolder: "cadillacctsvr", brand: "Cadillac", model: "CTS-V", carClass: "Touring", svgLogoId: "logo-cadillac", accentColor: "#C0C0C0", specs: "V8 production racer" },
  { carFolder: "kiaoptima", brand: "Kia", model: "Optima", carClass: "Touring", svgLogoId: "logo-kia", accentColor: "#FFFFFF", specs: "KX touring car" },
  { carFolder: "fr500s", brand: "Ford", model: "Mustang FR500S", carClass: "Touring", svgLogoId: "logo-ford", accentColor: "#003478", specs: "FR500S track pack" },
  { carFolder: "subaruwrxsti", brand: "Subaru", model: "WRX STI", carClass: "Touring", svgLogoId: "logo-subaru", accentColor: "#013C74", specs: "Rallycross" },
  { carFolder: "fordfiestarswrc", brand: "Ford", model: "Fiesta RS WRC", carClass: "Touring", svgLogoId: "logo-ford", accentColor: "#003478", specs: "Rallycross" },
  { carFolder: "vwbeetlegrc", brand: "Volkswagen", model: "Beetle GRC", carClass: "Touring", svgLogoId: "logo-vw", accentColor: "#001E50", specs: "Global Rallycross" },
  { carFolder: "vwbeetlelite", brand: "Volkswagen", model: "Beetle Lite", carClass: "Touring", svgLogoId: "logo-vw", accentColor: "#001E50", specs: "Global Rallycross Lite" },
  { carFolder: "jettatdi", brand: "Volkswagen", model: "Jetta TDI Cup", carClass: "Touring", svgLogoId: "logo-vw", accentColor: "#001E50", specs: "Jetta TDI Cup" },
  { carFolder: "solstice", brand: "Pontiac", model: "Solstice", carClass: "Touring", svgLogoId: "logo-pontiac", accentColor: "#E31C23", specs: "Solstice Club Sport" },
  { carFolder: "solsticerookie", brand: "Pontiac", model: "Solstice Rookie", carClass: "Touring", svgLogoId: "logo-pontiac", accentColor: "#E31C23", specs: "Solstice Rookie" },

  { carFolder: "mx5cup2010", brand: "Mazda", model: "MX-5 Cup 2010", carClass: "Touring", svgLogoId: "logo-mazda", accentColor: "#910A2A", specs: "NC Cup", legacy: true },
  { carFolder: "mx5roadster2010", brand: "Mazda", model: "MX-5 Roadster 2010", carClass: "Touring", svgLogoId: "logo-mazda", accentColor: "#910A2A", specs: "NC Roadster", legacy: true },

  { carFolder: "rufrt12rawd", brand: "Ruf", model: "RT 12 R AWD", carClass: "Touring", svgLogoId: "logo-ruf", accentColor: "#185533", specs: "RT 12 R · AWD" },
  { carFolder: "rufrt12rrwd", brand: "Ruf", model: "RT 12 R RWD", carClass: "Touring", svgLogoId: "logo-ruf", accentColor: "#185533", specs: "RT 12 R · RWD" },
  { carFolder: "rufrt12rtrack", brand: "Ruf", model: "RT 12 R Track", carClass: "Touring", svgLogoId: "logo-ruf", accentColor: "#185533", specs: "RT 12 R Track" },
  { carFolder: "rufrt12rcspec", brand: "Ruf", model: "RT 12 R C-Spec", carClass: "Touring", svgLogoId: "logo-ruf", accentColor: "#185533", specs: "RT 12 R C-Spec" },

  // Formula. USF-17 and the PM-18 are Tatuus. FR2.0 / FR3.5 pages do not name a chassis.
  { carFolder: "dallarail15", brand: "Dallara", model: "IL-15", carClass: "Formula", svgLogoId: "logo-dallara", accentColor: "#FDC300", specs: "Indy NXT" },
  { carFolder: "usf2000", brand: "Tatuus", model: "USF-17", carClass: "Formula", svgLogoId: "logo-tatuus", accentColor: "#C0C0C0", specs: "USF 2000" },
  { carFolder: "mercedesw12", brand: "Mercedes-AMG", model: "F1 W12 E Performance", carClass: "Formula", svgLogoId: "logo-mercedes", accentColor: "#C0C6CC", specs: "2021 Formula 1" },
  { carFolder: "mclarenmp430", brand: "McLaren", model: "MP4-30", carClass: "Formula", svgLogoId: "logo-mclaren", accentColor: "#FF8000", specs: "2015 Formula 1 · Honda" },
  { carFolder: "williamsfw31", brand: "Williams", model: "FW31", carClass: "Formula", svgLogoId: "logo-williams", accentColor: "#FFFFFF", specs: "2009 Formula 1 · Toyota" },
  { carFolder: "lotus49", brand: "Lotus", model: "Type 49", carClass: "Formula", svgLogoId: "logo-lotus", accentColor: "#FFF200", specs: "1967 Formula 1" },
  { carFolder: "dallaradw12", brand: "Dallara", model: "DW12", carClass: "Formula", svgLogoId: "logo-dallara", accentColor: "#FDC300", specs: "IndyCar 2012–2017", legacy: true },
  { carFolder: "dallarair05", brand: "Dallara", model: "IR-05", carClass: "Formula", svgLogoId: "logo-dallara", accentColor: "#FDC300", specs: "IndyCar circa 2009", legacy: true },
  { carFolder: "formulamazda", brand: "Mazda", model: "Pro Mazda", carClass: "Formula", svgLogoId: "logo-mazda", accentColor: "#910A2A", specs: "Star Mazda / Pro Mazda · Renesis", legacy: true },
  { carFolder: "formularenault20", brand: "Renault", model: "Formula Renault 2.0", carClass: "Formula", svgLogoId: "logo-renault", accentColor: "#FFCC00", specs: "Formula Renault 2.0" },
  { carFolder: "formularenault35", brand: "Renault", model: "Formula Renault 3.5", carClass: "Formula", svgLogoId: "logo-renault", accentColor: "#FFCC00", specs: "Formula Renault 3.5" },
  { carFolder: "trucksram1500", brand: "Ram", model: "NASCAR Truck Ram 1500", carClass: "Oval", svgLogoId: "logo-ram", accentColor: "#FFFFFF", specs: "NASCAR Craftsman Truck Series" },

  // Oval stock cars named on the filepath list.
  { carFolder: "stockcars2arcachevy", brand: "Chevrolet", model: "ARCA SS", carClass: "Oval", svgLogoId: "logo-chevy", accentColor: "#C5A017", specs: "ARCA Menards" },
  { carFolder: "stockcars2arcaford", brand: "Ford", model: "ARCA Mustang", carClass: "Oval", svgLogoId: "logo-ford", accentColor: "#003478", specs: "ARCA Menards" },
  { carFolder: "stockcars2arcatoyota", brand: "Toyota", model: "ARCA Camry", carClass: "Oval", svgLogoId: "logo-toyota", accentColor: "#EB0A1E", specs: "ARCA Menards" },
  { carFolder: "stockcarscamarozl12018", brand: "Chevrolet", model: "NASCAR Cup Camaro ZL1", carClass: "Oval", svgLogoId: "logo-chevy", accentColor: "#C5A017", specs: "Cup Series Camaro" },
  { carFolder: "stockcarsfordmustang2019", brand: "Ford", model: "NASCAR Cup Mustang", carClass: "Oval", svgLogoId: "logo-ford", accentColor: "#003478", specs: "Cup Series Mustang" },
  { carFolder: "stockcarstoyotacamry", brand: "Toyota", model: "NASCAR Cup Camry", carClass: "Oval", svgLogoId: "logo-toyota", accentColor: "#EB0A1E", specs: "Cup Series Camry" },
  { carFolder: "stockcarschevymontecarlo03", brand: "Chevrolet", model: "Gen 4 Monte Carlo 2003", carClass: "Oval", svgLogoId: "logo-chevy", accentColor: "#C5A017", specs: "NASCAR Gen 4" },
  { carFolder: "stockcarsfordtaurus03", brand: "Ford", model: "Gen 4 Taurus 2003", carClass: "Oval", svgLogoId: "logo-ford", accentColor: "#003478", specs: "NASCAR Gen 4" },
  { carFolder: "stockcars2chevyimpala", brand: "Chevrolet", model: "ARCA Impala", carClass: "Oval", svgLogoId: "logo-chevy", accentColor: "#C5A017", specs: "ARCA Menards Impala", legacy: true },
  { carFolder: "gen4cup", brand: "Chevrolet", model: "Gen 4 Cup", carClass: "Oval", svgLogoId: "logo-chevy", accentColor: "#C5A017", specs: "NASCAR Gen 4 Cup", legacy: true },
  { carFolder: "stockcarsimpala", brand: "Chevrolet", model: "Impala COT 2009", carClass: "Oval", svgLogoId: "logo-chevy", accentColor: "#C5A017", specs: "Car of Tomorrow", legacy: true },
  { carFolder: "stockcarschevyss", brand: "Chevrolet", model: "NASCAR Cup SS 2013", carClass: "Oval", svgLogoId: "logo-chevy", accentColor: "#C5A017", specs: "Gen 6 Cup", legacy: true },
  { carFolder: "stockcars2nwimpala", brand: "Chevrolet", model: "Nationwide Impala 2012", carClass: "Oval", svgLogoId: "logo-chevy", accentColor: "#C5A017", specs: "Nationwide", legacy: true },
  { carFolder: "stockcars2nwcamaro", brand: "Chevrolet", model: "Xfinity Camaro 2014", carClass: "Oval", svgLogoId: "logo-chevy", accentColor: "#C5A017", specs: "Xfinity", legacy: true },
  { carFolder: "stockcars2nwmustang", brand: "Ford", model: "Xfinity Mustang 2016", carClass: "Oval", svgLogoId: "logo-ford", accentColor: "#003478", specs: "Xfinity", legacy: true },
  { carFolder: "stockcars2camry2015", brand: "Toyota", model: "Xfinity Camry 2015", carClass: "Oval", svgLogoId: "logo-toyota", accentColor: "#EB0A1E", specs: "Xfinity", legacy: true },
  { carFolder: "stockcarbrasilcruze", brand: "Chevrolet", model: "Cruze Stock Car Pro", carClass: "Oval", svgLogoId: "logo-chevy", accentColor: "#C5A017", specs: "Stock Car Pro Series" },
  { carFolder: "stockcarbrasilcorolla", brand: "Toyota", model: "Corolla Stock Car Pro", carClass: "Oval", svgLogoId: "logo-toyota", accentColor: "#EB0A1E", specs: "Stock Car Pro Series" },
  { carFolder: "legendsford34crookie", brand: "Ford", model: "Legends Ford '34 Coupe Rookie", carClass: "Oval", svgLogoId: "logo-ford", accentColor: "#003478", specs: "Legends Cars · 600 Racing · body Ford 1934" },

  { carFolder: "v8supercarsfordmustanggt", brand: "Ford", model: "Mustang Supercar", carClass: "Touring", svgLogoId: "logo-ford", accentColor: "#003478", specs: "Supercars Mustang GT" },
  { carFolder: "fordv8sc", brand: "Ford", model: "Falcon V8 Supercar 2009", carClass: "Touring", svgLogoId: "logo-ford", accentColor: "#003478", specs: "V8 Supercars", legacy: true },
  { carFolder: "v8supercarsford2014", brand: "Ford", model: "FG Falcon 2014", carClass: "Touring", svgLogoId: "logo-ford", accentColor: "#003478", specs: "V8 Supercars", legacy: true },
  { carFolder: "v8supercarsholden2014", brand: "Holden", model: "VF Commodore 2014", carClass: "Touring", svgLogoId: "logo-holden", accentColor: "#C0C0C0", specs: "V8 Supercars", legacy: true },

  // Additional licensed iRacing models (FIA & Legacy Porsche).
  { carFolder: "fiacrosscar", brand: "FIA", model: "FIA Cross Car", carClass: "Dirt", svgLogoId: "logo-fia", accentColor: "#1D4ED8", specs: "FIA Cross Car · Dirt Road" },
  { carFolder: "porsche991cup", brand: "Porsche", model: "911 GT3 Cup (991)", carClass: "GT3", svgLogoId: "logo-porsche", accentColor: "#D4AF37", specs: "4.0L Flat-6 · Single-Make Cup", legacy: true },
  { carFolder: "porsche911gt3r", brand: "Porsche", model: "911 GT3 R (991)", carClass: "GT3", svgLogoId: "logo-porsche", accentColor: "#D4AF37", specs: "4.0L Flat-6 · GT3", legacy: true },

  // Licensed series cars (NASCAR, USAC, DIRTcar, World of Outlaws, Lucas Oil) & spec cars.
  { carFolder: "streetstock", brand: U, model: "Street Stock", carClass: "Oval", svgLogoId: N, accentColor: "#C0C0C0" },
  { carFolder: "streetstockcasino", brand: U, model: "Street Stock Casino", carClass: "Oval", svgLogoId: N, accentColor: "#C0C0C0" },
  { carFolder: "streetstockeagle", brand: U, model: "Street Stock Eagle", carClass: "Oval", svgLogoId: N, accentColor: "#C0C0C0", specs: "iRacing page: Street Stock – Eagle" },
  { carFolder: "silvercrown", brand: "USAC", model: "Silver Crown", carClass: "Oval", svgLogoId: "logo-usac", accentColor: "#EF4444", specs: "USAC Silver Crown · C&R Racing" },
  { carFolder: "sprint", brand: "World of Outlaws", model: "Sprint Car", carClass: "Oval", svgLogoId: "logo-woo", accentColor: "#EF4444", specs: "Asphalt Winged Sprint Car" },
  { carFolder: "srx", brand: U, model: "SRX", carClass: "Oval", svgLogoId: N, accentColor: "#C0C0C0", specs: "Superstar Racing Experience" },
  { carFolder: "gen4grandnational", brand: "NASCAR", model: "Gen 4 Grand National", carClass: "Oval", svgLogoId: "logo-nascar", accentColor: "#FACC15", specs: "NASCAR Gen 4 Grand National" },

  { carFolder: "dirtmodified358", brand: "DIRTcar", model: "Dirt 358 Modified", carClass: "Dirt", svgLogoId: "logo-dirtcar", accentColor: "#F59E0B" },
  { carFolder: "dirtlatemodel350", brand: "DIRTcar", model: "Limited Dirt Late Model", carClass: "Dirt", svgLogoId: "logo-dirtcar", accentColor: "#F59E0B" },
  { carFolder: "dirtmidget", brand: "USAC", model: "Dirt Midget", carClass: "Dirt", svgLogoId: "logo-usac", accentColor: "#EF4444" },
  { carFolder: "dirtministock", brand: U, model: "Dirt Mini Stock", carClass: "Dirt", svgLogoId: N, accentColor: "#C0C0C0" },
  { carFolder: "dirtsprint305", brand: "World of Outlaws", model: "Dirt Sprint 305", carClass: "Dirt", svgLogoId: "logo-woo", accentColor: "#EF4444" },
  { carFolder: "dirtsprintnonwinged360", brand: "USAC", model: "Dirt Sprint Non-Winged 360", carClass: "Dirt", svgLogoId: "logo-usac", accentColor: "#EF4444" },
  { carFolder: "dirtsprintnonwinged410", brand: "USAC", model: "Dirt Sprint Non-Winged 410", carClass: "Dirt", svgLogoId: "logo-usac", accentColor: "#EF4444" },
  { carFolder: "dirtstreetstock", brand: "DIRTcar", model: "Dirt Street Stock", carClass: "Dirt", svgLogoId: "logo-dirtcar", accentColor: "#F59E0B" },
  { carFolder: "protruckpro2lite", brand: "Lucas Oil", model: "Pro 2 Lite", carClass: "Dirt", svgLogoId: "logo-lucasoil", accentColor: "#1D4ED8", specs: "Lucas Oil Off Road" },
  { carFolder: "protruckpro2", brand: "Lucas Oil", model: "Pro 2 Truck", carClass: "Dirt", svgLogoId: "logo-lucasoil", accentColor: "#1D4ED8", specs: "Lucas Oil Off Road" },
  { carFolder: "protruckpro4", brand: "Lucas Oil", model: "Pro 4 Truck", carClass: "Dirt", svgLogoId: "logo-lucasoil", accentColor: "#1D4ED8", specs: "Lucas Oil Off Road" },
];
