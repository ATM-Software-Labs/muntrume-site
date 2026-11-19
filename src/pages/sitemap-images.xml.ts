import type { APIRoute } from "astro";
import { absoluteWallpaperUrl, getWallpaperCatalog } from "../lib/wallpaper-catalog";

function xml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export const GET: APIRoute = async () => {
  const catalog = await getWallpaperCatalog();
  const blocks = catalog.series.map((series) => {
    const loc = `https://muntru.me/wallpapers/${series.slug}/`;
    const images = series.items
      .map((item) => {
        const caption = xml(item.alt);
        return [
          "    <image:image>",
          `      <image:loc>${xml(absoluteWallpaperUrl(item.img))}</image:loc>`,
          `      <image:title>${caption}</image:title>`,
          `      <image:caption>${caption}</image:caption>`,
          "    </image:image>",
        ].join("\n");
      })
      .join("\n");
    return `  <url>\n    <loc>${xml(loc)}</loc>\n${images}\n  </url>`;
  });

  const body = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">',
    ...blocks,
    "</urlset>",
    "",
  ].join("\n");

  return new Response(body, {
    headers: { "Content-Type": "application/xml; charset=utf-8" },
  });
};
