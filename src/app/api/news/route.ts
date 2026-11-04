export const runtime = "edge";

interface NewsItem {
  id: string;
  title: string;
  slug: string;
  driver_slug?: string;
  category: string;
  pubDate: string;
  summary: string;
  link: string;
}

const SAMPLE_NEWS: NewsItem[] = [
  {
    id: "news-1",
    title: "Alberto Trujillo lidera la sesión de telemetría previa a las 24H de Spa",
    slug: "alberto-trujillo-telemetria-spa",
    driver_slug: "albertot",
    category: "Resistencia",
    pubDate: "2026-11-03T18:00:00Z",
    summary: "Análisis MoTeC a 60 Hz y optimización del mapa aerodinámico para el Porsche 911 GT3 R.",
    link: "/news"
  },
  {
    id: "news-2",
    title: "Mateo Berbis marca la pole en el campeonato Sprint GT3",
    slug: "mateo-berbis-pole-gt3",
    driver_slug: "mateob",
    category: "GT3 Sprint",
    pubDate: "2026-11-02T20:30:00Z",
    summary: "Vuelta perfecta al límite sin bloqueo en el sector técnico para asegurar la primera posición.",
    link: "/news"
  },
  {
    id: "news-3",
    title: "Eduardo Chongkan completa el shakedown del prototipo GTP",
    slug: "eduardo-chongkan-shakedown-gtp",
    driver_slug: "eduardoc",
    category: "Prototipos",
    pubDate: "2026-11-01T15:00:00Z",
    summary: "Calibración de la unidad híbrida y frenada con regeneración en el trazado de Watkins Glen.",
    link: "/news"
  },
  {
    id: "news-4",
    title: "Juanlu Carrillo prepara el asalto a la temporada de Monoplazas",
    slug: "juanlu-carrillo-monoplazas-sfl",
    driver_slug: "juanluc",
    category: "Monoplazas",
    pubDate: "2026-10-30T12:00:00Z",
    summary: "Ajuste milimétrico de las alas y balance en frenada para el campeonato Super Formula Lights.",
    link: "/news"
  }
];

export async function GET(request: Request) {
  const url = new URL(request.url);
  const driverSlug = url.searchParams.get("driver");

  const headers = {
    "Access-Control-Allow-Origin": "https://muntru.me",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "public, max-age=600"
  };

  let items = SAMPLE_NEWS;
  if (driverSlug) {
    items = items.filter(
      (n) => n.driver_slug === driverSlug || n.slug.includes(driverSlug)
    );
  }

  return new Response(
    JSON.stringify({
      success: true,
      driver: driverSlug,
      count: items.length,
      items
    }),
    { status: 200, headers }
  );
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
