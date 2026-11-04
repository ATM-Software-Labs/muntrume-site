/**
 * Helmet Image Proxy for Cloudflare Pages
 * Proxies to Cloudflare Worker /api/helmet with caching
 */

function generateHelmetSvg(custId) {
  const driverMap = {
    "993381": { num: "#1", initials: "AT", color: "#00E699" },
    "1134615": { num: "#2", initials: "MB", color: "#00E699" },
    "1076585": { num: "#3", initials: "EC", color: "#00E699" },
    "default": { num: "#4", initials: "JC", color: "#00E699" }
  };
  const d = driverMap[String(custId || "")] || driverMap["default"];

  return `<svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" width="100" height="100">
    <rect width="100" height="100" rx="16" fill="#1E2A26"/>
    <path d="M26 56 C24 38 34 20 54 18 C74 16 82 32 82 48 C82 60 76 74 68 78 C60 82 46 82 36 80 C30 79 27 70 26 56 Z" fill="#121A17" stroke="#2A3A34" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="M40 22 C48 20 60 21 70 26" stroke="#3A4D45" stroke-width="1.8" stroke-linecap="round"/>
    <path d="M44 26 C52 24 62 25 72 30" stroke="#1E2A26" stroke-width="1.2" stroke-linecap="round"/>
    <path d="M32 44 C42 42 66 43 78 48 C77 56 73 62 64 64 C48 64 35 62 31 52 C30 48 31 45 32 44 Z" fill="#050807" stroke="${d.color}" stroke-width="1.5"/>
    <path d="M38 48 C48 46 64 47 74 51" stroke="${d.color}" stroke-width="2" stroke-linecap="round" opacity="0.9"/>
    <circle cx="34" cy="50" r="2.5" fill="#1E2A26" stroke="${d.color}" stroke-width="1"/>
    <path d="M36 68 L48 68 M38 72 L46 72" stroke="${d.color}" stroke-width="1.5" stroke-linecap="round" opacity="0.6"/>
    <path d="M74 42 C79 46 81 54 80 62 C83 58 84 50 81 44 Z" fill="#1A2521" stroke="#2A3A34" stroke-width="1"/>
    <text x="65" y="78" font-family="monospace" font-size="8" font-weight="bold" fill="${d.color}">${d.num}</text>
  </svg>`;
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const custId = url.searchParams.get("custId");

  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Cache-Control": "public, max-age=86400, s-maxage=86400",
    "Cross-Origin-Resource-Policy": "cross-origin"
  };

  if (!custId || !/^\d+$/.test(custId)) {
    return new Response(generateHelmetSvg("default"), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "image/svg+xml; charset=utf-8" }
    });
  }

  try {
    const workerUrl = `https://muntrume.atrumin16.workers.dev/api/helmet?custId=${custId}`;
    const res = await fetch(workerUrl);

    if (res.ok) {
      const contentType = res.headers.get("content-type") || "image/png";
      const body = await res.arrayBuffer();
      return new Response(body, {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": contentType
        }
      });
    }

    return new Response(generateHelmetSvg(custId), {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "image/svg+xml; charset=utf-8"
      }
    });
  } catch (err) {
    return new Response(generateHelmetSvg(custId), {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "image/svg+xml; charset=utf-8"
      }
    });
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    }
  });
}
