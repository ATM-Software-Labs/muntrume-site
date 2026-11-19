interface R2BucketLike {
  put(
    key: string,
    value: ArrayBuffer | ReadableStream | string,
    options?: {
      httpMetadata?: { contentType?: string };
      customMetadata?: Record<string, string>;
    }
  ): Promise<unknown>;
}

interface KVNamespaceLike {
  put(key: string, value: string): Promise<void>;
}

interface D1DatabaseLike {
  prepare(query: string): {
    bind(...values: unknown[]): { run(): Promise<unknown> };
  };
}

export interface WallpapersEnv {
  WALLPAPERS_BUCKET?: R2BucketLike;
  WALLPAPERS_KV?: KVNamespaceLike;
  DB?: D1DatabaseLike;
  MMT_TEAM_TOKEN?: string;
  DISCORD_WEBHOOK_URL?: string;
}

const MAX_BYTES = 15 * 1024 * 1024; // 15 MB
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...CORS_HEADERS },
  });
}

export const onRequestOptions = async (): Promise<Response> => {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
};

export const onRequestPost = async (context: {
  request: Request;
  env: WallpapersEnv;
}): Promise<Response> => {
  const { request, env } = context;

  try {
    const form = await request.formData();
    const mode = String(form.get("mode") || "community") === "team" ? "team" : "community";
    const category = String(form.get("category") || "GT3 2026").slice(0, 64);
    const car = String(form.get("car") || "").trim().slice(0, 120);
    const track = String(form.get("track") || "").trim().slice(0, 120);
    const author = String(form.get("author") || "").trim().slice(0, 80);
    const teamToken = String(form.get("teamToken") || "").trim();
    const file = form.get("file");

    if (!car || !track || !author) {
      return jsonResponse({ ok: false, error: "Faltan datos obligatorios (coche, circuito o autor)." }, 400);
    }

    if (!(file instanceof File)) {
      return jsonResponse({ ok: false, error: "Adjunta una captura válida (JPG, PNG o WebP)." }, 400);
    }

    if (!ALLOWED_TYPES.has(file.type)) {
      return jsonResponse({ ok: false, error: "Formato no soportado. Usa JPG, PNG o WebP." }, 400);
    }

    if (file.size <= 0 || file.size > MAX_BYTES) {
      return jsonResponse({ ok: false, error: "El archivo supera el límite de 15 MB." }, 400);
    }

    const cfAccessUser = request.headers.get("Cf-Access-Authenticated-User-Email");
    if (mode === "team") {
      const hasValidToken = Boolean(env.MMT_TEAM_TOKEN && teamToken && teamToken === env.MMT_TEAM_TOKEN);
      if (!cfAccessUser && !hasValidToken) {
        return jsonResponse(
          { ok: false, error: "Se requiere sesión Cloudflare Zero Trust o token de equipo válido." },
          401
        );
      }
    }

    const id = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
    const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
    const status = mode === "team" ? "published" : "pending";
    const categorySlug = category.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const objectKey = `${status}/${categorySlug}/${id}.${ext}`;
    const createdAt = new Date().toISOString();

    if (env.WALLPAPERS_BUCKET) {
      await env.WALLPAPERS_BUCKET.put(objectKey, await file.arrayBuffer(), {
        httpMetadata: { contentType: file.type },
        customMetadata: {
          id,
          mode,
          status,
          category,
          car,
          track,
          author: cfAccessUser || author,
          createdAt,
        },
      });
    }

    const metaRecord = {
      id,
      mode,
      status,
      category,
      car,
      track,
      author: cfAccessUser || author,
      objectKey,
      sizeBytes: file.size,
      createdAt,
    };

    if (env.WALLPAPERS_KV) {
      await env.WALLPAPERS_KV.put(`wallpaper:${status}:${id}`, JSON.stringify(metaRecord));
    }

    if (env.DB) {
      try {
        await env.DB.prepare(
          "INSERT INTO wallpapers_queue (id, mode, status, category, car, track, author, object_key, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)"
        )
          .bind(id, mode, status, category, car, track, cfAccessUser || author, objectKey, createdAt)
          .run();
      } catch {
        // Ignore if table not yet initialized in D1
      }
    }

    if (env.DISCORD_WEBHOOK_URL) {
      await fetch(env.DISCORD_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content:
            status === "published"
              ? `📸 **Nuevo Wallpaper Oficial MMT** (${category}) — ${car} en ${track} por ${cfAccessUser || author}`
              : `🟡 **Sugerencia de Wallpaper Comunidad** — ${car} en ${track} por ${author} (Pendiente de revisión: \`${id}\`)`,
        }),
      }).catch(() => {});
    }

    return jsonResponse(
      {
        ok: true,
        id,
        status,
        objectKey,
        message:
          status === "published"
            ? "Wallpaper publicado correctamente en el almacenamiento del equipo."
            : "Captura enviada a la cola de revisión. ¡Gracias por aportar!",
      },
      201
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error interno procesando la subida.";
    return jsonResponse({ ok: false, error: message }, 500);
  }
};
