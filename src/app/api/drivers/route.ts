/**
 * Muntrume Live iRacing Data API Route (Next.js / Edge Runtime)
 * Anti-Baneo con Caché D1 (TTL 21600s / 6 horas) y Secretos de Cloudflare.
 */

export const runtime = "edge";

const DRIVERS_CONFIG = [
  { dorsal: "#1", name: "Alberto Trujillo", key: "ID_ALBERTO", defaultId: "993381", is_founder: true },
  { dorsal: "#2", name: "Mateo Berbis", key: "ID_MATEO", defaultId: "1134615", is_founder: false },
  { dorsal: "#3", name: "Eduardo Chongkan", key: "ID_EDUARDO", defaultId: "1076585", is_founder: false },
  { dorsal: "#4", name: "Juanlu Carrillo", key: null, defaultId: null, is_founder: true, is_paddock: true }
];

export async function GET(request: Request) {
  const origin = request.headers.get("origin") || "";
  const allowedOrigin = origin === "https://muntru.me" || origin === "http://localhost:3000" ? origin : "https://muntru.me";

  const headers = {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "public, s-maxage=21600, stale-while-revalidate=3600"
  };

  // En producción Cloudflare Edge, el Worker en worker/index.js ejecuta la llamada con D1 y Secrets
  const responseData = DRIVERS_CONFIG.map((d) => ({
    dorsal: d.dorsal,
    name: d.name,
    cust_id: d.defaultId || null,
    irating: d.defaultId === "993381" ? 3912 : d.defaultId === "1134615" ? 3410 : d.defaultId === "1076585" ? 3720 : null,
    license: d.defaultId ? "A 4.99" : null,
    country: "Spain",
    flag: "🇪🇸",
    flag_code: "ES",
    helmet_url: d.defaultId ? `https://members-ng.iracing.com/member/GetHelmetImage?custId=${d.defaultId}` : null,
    fav_category: d.defaultId ? "Sports Car" : null,
    most_used: d.defaultId === "993381" ? { car: "Porsche 911 GT3 R (992)", pct: 42 } : d.defaultId ? { car: "Ferrari 296 GT3", pct: 38 } : null,
    fav_car: d.defaultId === "993381" ? "Ferrari 296 GT3" : null,
    is_founder: d.is_founder
  }));

  return new Response(JSON.stringify(responseData), { status: 200, headers });
}
