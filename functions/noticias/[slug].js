/**
 * Edge SSR handler for /noticias/[slug]
 * Renders legal preview cards conforming strictly to LPI Art. 32 & DMCA
 */

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function onRequest(context) {
  const { params, env, request } = context;
  const slug = params.slug;

  if (!slug) {
    return new Response("Not Found", { status: 404 });
  }

  // 1. Fetch dispatch data from D1 or Worker API
  let dispatch = null;
  if (env.muntrume_vault) {
    try {
      dispatch = await env.muntrume_vault
        .prepare("SELECT * FROM external_dispatches WHERE slug = ?")
        .bind(slug)
        .first();
    } catch (e) {
      console.warn("[edge-dispatch] D1 read error:", e?.message);
    }
  }

  if (!dispatch) {
    try {
      const res = await fetch(`https://muntrume.atrumin16.workers.dev/api/dispatches/${slug}`);
      if (res.status === 410) {
        return render410();
      }
      if (res.ok) {
        const json = await res.json();
        dispatch = json.dispatch;
      }
    } catch (e) {
      console.warn("[edge-dispatch] Worker fallback fetch error:", e?.message);
    }
  }

  if (!dispatch) {
    return new Response("Despacho no encontrado.", {
      status: 404,
      headers: { "Content-Type": "text/html; charset=utf-8" }
    });
  }

  // 2. Check if takedown was requested -> HTTP 410 Gone
  if (dispatch.status === "removed") {
    return render410();
  }

  const title = escapeHtml(dispatch.title_original || "Noticia");
  const sourceName = escapeHtml(dispatch.source_name || "Fuente Oficial");
  const urlOriginal = escapeHtml(dispatch.url_original || "https://muntru.me");
  const excerpt = escapeHtml(dispatch.excerpt_short || "");
  const contextNote = escapeHtml(dispatch.context_note || "Despacho técnico analizado por el departamento de ingeniería y competición de Muntrume Motorsport.");
  const pubDate = dispatch.published_at ? new Date(dispatch.published_at).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" }) : "";
  const imageUrl = dispatch.image_url_original;

  const html = `<!DOCTYPE html>
<html lang="es" class="dark">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title} · Sala de Prensa Muntrume</title>
  
  <!-- SEO Legal para evitar contenido duplicado -->
  <link rel="canonical" href="${urlOriginal}" />
  <meta name="robots" content="noindex, follow" />
  
  <link rel="icon" type="image/svg+xml" href="/assets/img/favicon.svg" />
  <link rel="stylesheet" href="/assets/css/mobile.css" />
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    body { background-color: #0E1211; color: #F5F5F5; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    .font-mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
  </style>
</head>
<body class="min-h-screen flex flex-col justify-between selection:bg-[#00E699] selection:text-black">

  <!-- Header minimalista -->
  <header class="border-b border-[#242E2C] bg-[#0E1211]/90 backdrop-blur sticky top-0 z-50">
    <div class="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
      <a href="/" class="flex items-center gap-2 text-white font-bold tracking-wider text-sm font-mono hover:text-[#00E699] transition">
        <span class="w-2.5 h-2.5 rounded-full bg-[#00E699] animate-pulse"></span>
        MUNTRUME MOTORSPORT
      </a>
      <a href="/news" class="text-xs font-mono text-[#9AA8A3] hover:text-[#00E699] transition flex items-center gap-1">
        <span>&larr;</span>
        <span>Sala de Prensa</span>
      </a>
    </div>
  </header>

  <!-- Contenido principal -->
  <main class="max-w-3xl mx-auto px-4 sm:px-6 py-12 flex-1 w-full space-y-8">
    
    <!-- Badge superior: Vía [Fuente] • [Fecha] -->
    <div class="flex flex-wrap items-center gap-2 text-xs font-mono">
      <span class="px-2.5 py-1 rounded bg-[#1A2120] text-[#00E699] border border-[#242E2C] font-semibold">
        Vía <a href="${urlOriginal}" target="_blank" rel="noopener noreferrer" class="underline hover:text-white">${sourceName}</a>
      </span>
      ${pubDate ? `<span class="text-[#9AA8A3]">• ${pubDate}</span>` : ""}
      <span class="px-2 py-0.5 rounded bg-[#121A17] text-[#7A8A87] border border-[#1E2A26] text-[10px] uppercase">
        Despacho Agregado
      </span>
    </div>

    <!-- H1: Título Original -->
    <h1 class="text-2xl sm:text-4xl font-extrabold text-white tracking-tight leading-tight">
      ${title}
    </h1>

    <!-- Imagen de portada con caption (sin alojar en servidor propio) -->
    ${imageUrl ? `
    <figure class="rounded-2xl overflow-hidden border border-[#242E2C] bg-[#1A2120] relative">
      <img
        src="${escapeHtml(imageUrl)}"
        alt="${title}"
        referrerpolicy="no-referrer"
        loading="lazy"
        class="w-full max-h-[420px] object-cover opacity-90 hover:opacity-100 transition"
      />
      <figcaption class="p-3 text-[11px] font-mono text-[#7A8A87] bg-[#0E1211]/80 border-t border-[#242E2C]">
        Fotografía e imagen vía ${sourceName}
      </figcaption>
    </figure>
    ` : ""}

    <!-- Cuerpo: Excerpt corto (max 160 chars) + párrafo de contexto propio -->
    <div class="space-y-6 text-[#BAC5C1] text-base leading-relaxed bg-[#1A2120] p-6 sm:p-8 rounded-2xl border border-[#242E2C]">
      
      <div>
        <h2 class="text-xs font-mono uppercase tracking-wider text-[#7A8A87] mb-2 font-semibold">Resumen de la noticia</h2>
        <p class="text-white text-base sm:text-lg font-medium italic border-l-2 border-[#00E699] pl-4 py-1">
          "${excerpt}"
        </p>
      </div>

      <div class="pt-4 border-t border-[#242E2C]">
        <h2 class="text-xs font-mono uppercase tracking-wider text-[#00E699] mb-2 font-semibold">Contexto Muntrume Motorsport</h2>
        <p class="text-sm sm:text-base text-[#9AA8A3]">
          ${contextNote}
        </p>
      </div>

    </div>

    <!-- CTA grande y obligatorio: Botón verde hacia url_original -->
    <div class="pt-2 text-center sm:text-left">
      <a
        href="${urlOriginal}"
        target="_blank"
        rel="noopener noreferrer"
        class="inline-flex items-center justify-center gap-3 w-full sm:w-auto px-8 py-4 rounded-xl bg-[#00E699] text-black font-bold font-mono text-sm sm:text-base hover:bg-[#00c985] shadow-lg shadow-[#00E699]/15 hover:shadow-[#00E699]/30 transition transform hover:-translate-y-0.5"
      >
        <span>Leer noticia completa en ${sourceName}</span>
        <span class="text-lg">&rarr;</span>
      </a>
      <p class="text-[11px] font-mono text-[#7A8A87] mt-2">
        Enlace directo al artículo original en ${sourceName} (se abre en nueva ventana).
      </p>
    </div>

    <!-- Bloque legal de atribución obligatorio -->
    <div class="p-5 rounded-xl bg-[#121A17] border border-[#242E2C] text-xs font-mono text-[#7A8A87] space-y-2 mt-12">
      <div class="flex items-center gap-2 text-[#9AA8A3] font-semibold">
        <svg class="w-4 h-4 text-[#00E699]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span>Aviso Legal y Atribución Editorial</span>
      </div>
      <p>
        Este contenido es un resumen técnico agregado vía RSS público con fines informativos y de cita (Art. 32 LPI / Directiva UE 2019/790). La noticia original fue publicada por <strong>${sourceName}</strong> y todos los derechos pertenecen a sus respectivos autores.
      </p>
      <p>
        Fuente original: <a href="${urlOriginal}" target="_blank" rel="noopener noreferrer" class="text-[#00E699] underline break-all">${urlOriginal}</a>
      </p>
      <div class="pt-2 flex flex-wrap items-center gap-4 text-[11px] text-[#9AA8A3]">
        <a href="/legal/fuentes" class="hover:text-white underline">Directorio de Fuentes y Contacto 24h</a>
        <span>•</span>
        <a href="/legal/retirada" class="hover:text-white underline">Solicitar Retirada Inmediata (Takedown)</a>
      </div>
    </div>

  </main>

  <!-- Footer institucional -->
  <footer class="border-t border-[#242E2C] py-8 text-center text-xs font-mono text-[#7A8A87]">
    <div class="max-w-4xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
      <p>© ${new Date().getFullYear()} Muntrume Motorsport · Todos los derechos reservados.</p>
      <div class="flex items-center gap-4">
        <a href="/legal/fuentes" class="hover:text-[#00E699] transition">Fuentes RSS</a>
        <a href="/legal/retirada" class="hover:text-[#00E699] transition">Retirada DMCA</a>
        <a href="/news" class="hover:text-[#00E699] transition">Media Wire</a>
      </div>
    </div>
  </footer>

</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=600, s-maxage=3600",
      "X-Robots-Tag": "noindex, follow"
    }
  });
}

function render410() {
  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>410 Gone · Contenido Retirado</title>
  <meta name="robots" content="noindex, nofollow" />
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-[#0E1211] text-white min-h-screen flex items-center justify-center p-6 font-mono">
  <div class="max-w-md w-full p-8 rounded-2xl bg-[#1A2120] border border-[#242E2C] text-center space-y-4">
    <div class="w-12 h-12 rounded-full bg-red-500/10 text-red-400 mx-auto flex items-center justify-center font-bold text-xl border border-red-500/20">
      410
    </div>
    <h1 class="text-xl font-bold text-white">Contenido Retirado</h1>
    <p class="text-xs text-[#9AA8A3] leading-relaxed">
      Este despacho ha sido despublicado permanentemente a petición del titular de derechos conforme a la normativa legal (Art. 32 LPI / DMCA).
    </p>
    <div class="pt-4">
      <a href="/news" class="inline-block px-4 py-2 rounded-xl bg-[#242E2C] hover:bg-[#2F3C3A] text-xs text-white transition">
        &larr; Volver a la Sala de Prensa
      </a>
    </div>
  </div>
</body>
</html>`;

  return new Response(html, {
    status: 410,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=86400",
      "X-Robots-Tag": "noindex, nofollow"
    }
  });
}
