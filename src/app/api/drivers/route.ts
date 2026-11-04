import { PILOTOS } from "../../lib/pilotos";

export const runtime = "edge";

export async function GET(request: Request) {
  const origin = request.headers.get("origin") || "";
  const allowedOrigin =
    origin === "https://muntru.me" || origin === "http://localhost:3000" || origin === "http://localhost:4321"
      ? origin
      : "https://muntru.me";

  const headers = {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "public, max-age=1800, s-maxage=21600"
  };

  const responseData = PILOTOS.map((p) => {
    let irating: number | null = null;
    let license: string | null = null;

    if (p.cust_id === 993381) {
      irating = 3912;
      license = "A 4.99";
    } else if (p.cust_id === 1134615) {
      irating = 3410;
      license = "A 4.85";
    } else if (p.cust_id === 1076585) {
      irating = 3720;
      license = "A 4.90";
    }

    return {
      slug: p.slug,
      dorsal: p.dorsal,
      name: p.fullName,
      shortName: p.name,
      cust_id: p.cust_id,
      irating,
      license,
      flag: p.flag,
      flag_code: p.flag_code,
      helmet_url: p.helmet_url,
      fav_category: p.fav_category,
      role: p.role,
      badge: p.badge
    };
  });

  return new Response(JSON.stringify(responseData), { status: 200, headers });
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "https://muntru.me",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    }
  });
}
