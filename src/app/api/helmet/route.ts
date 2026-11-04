export const runtime = "edge";

export async function GET(request: Request) {
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
    return new Response(null, { status: 404, headers: corsHeaders });
  }

  try {
    const workerUrl = `https://muntrume.atrumin16.workers.dev/api/helmet?custId=${custId}`;
    const res = await fetch(workerUrl);

    if (!res.ok) {
      return new Response(null, { status: res.status, headers: corsHeaders });
    }

    const contentType = res.headers.get("content-type") || "image/png";
    const body = await res.arrayBuffer();

    return new Response(body, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": contentType
      }
    });
  } catch {
    return new Response(null, { status: 404, headers: corsHeaders });
  }
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    }
  });
}
