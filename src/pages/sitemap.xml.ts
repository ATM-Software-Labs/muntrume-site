import type { APIRoute } from "astro";
import { buildSetupRoutePairs, getCarSlug, getProgrammaticSetupCars } from "../lib/setups-seo";

export const GET: APIRoute = async () => {
  const base = "https://muntru.me";
  const today = new Date().toISOString().slice(0, 10);

  const coreRoutes = [
    { path: "/", priority: "1.0", changefreq: "daily" },
    { path: "/garage/", priority: "1.0", changefreq: "daily" },
    { path: "/paddock/", priority: "0.9", changefreq: "daily" },
    { path: "/calendar/", priority: "0.9", changefreq: "weekly" },
    { path: "/gallery/", priority: "0.8", changefreq: "weekly" },
    { path: "/albums/", priority: "0.8", changefreq: "weekly" },
    { path: "/drivers/", priority: "0.8", changefreq: "weekly" },
    { path: "/noticias/", priority: "0.8", changefreq: "daily" },
    { path: "/tracks/", priority: "0.8", changefreq: "weekly" },
    { path: "/app/", priority: "0.9", changefreq: "weekly" },
    { path: "/ai/", priority: "0.95", changefreq: "daily" },
    { path: "/ai-docs/", priority: "0.9", changefreq: "weekly" },
    { path: "/ai-docs/modelos/", priority: "0.85", changefreq: "weekly" },
    { path: "/ai-docs/artefactos/", priority: "0.85", changefreq: "weekly" },
    { path: "/ai-docs/seguridad/", priority: "0.85", changefreq: "weekly" },
    { path: "/ai-docs/api/", priority: "0.85", changefreq: "weekly" },
    { path: "/ai-docs/seo-llms/", priority: "0.85", changefreq: "weekly" },
  ];

  const carRoutes = getProgrammaticSetupCars().map((car) => ({
    path: `/setups/${getCarSlug(car)}/`,
    priority: "0.7",
    changefreq: "weekly",
  }));

  const pairRoutes = buildSetupRoutePairs().map(({ carSlug, track }) => ({
    path: `/setups/${carSlug}/${track.slug}/`,
    priority: "0.6",
    changefreq: "weekly",
  }));

  const all = [...coreRoutes, ...carRoutes, ...pairRoutes];
  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...all.map(
      (r) =>
        `  <url><loc>${base}${r.path}</loc><lastmod>${today}</lastmod><changefreq>${r.changefreq}</changefreq><priority>${r.priority}</priority></url>`,
    ),
    "</urlset>",
  ].join("\n");

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
    },
  });
};
