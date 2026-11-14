/**
 * Prompt 30.3: Test de Latencia y Fallback de Muntrume AI
 * - Verifica que el Worker en producción responde SSE (text/event-stream) en < 1000 ms
 * - Verifica que la conmutación a motor secundario funciona sin devolver HTTP 500
 */

import assert from "node:assert/strict";
import { handlePublicAI } from "../../../muntrume-worker-private/worker/ai.js";

console.log("🤖 [Prompt 30.3] Validando latencia y fallback de Muntrume AI...");

// 1. Test live contra el endpoint en producción
const endpoint = "https://muntrume.atrumin16.workers.dev/api/ai";
const t0 = performance.now();
const res = await fetch(endpoint, {
  method: "POST",
  headers: { "Content-Type": "application/json", Origin: "https://muntru.me" },
  body: JSON.stringify({ prompt: "HOLA", lang: "es", mode: "ai_chat", stream: true }),
});
const headerMs = performance.now() - t0;

if (res.status !== 200) {
  const errTxt = await res.text();
  assert.fail(`Estado HTTP esperado 200, recibido ${res.status}: ${errTxt}`);
}
const contentType = res.headers.get("content-type") || "";
assert.ok(contentType.includes("text/event-stream"), `Content-Type debe ser text/event-stream, recibido: ${contentType}`);
assert.ok(headerMs < 1000, `Latencia hasta cabeceras (${headerMs.toFixed(0)} ms) superó 1000 ms`);

const bodyText = await res.text();
assert.ok(bodyText.includes("data: ") && bodyText.includes("[DONE]"), "Stream SSE debe incluir chunks data: y [DONE]");
console.log(`   ✅ Live Worker SSE OK en ${headerMs.toFixed(0)} ms (< 1000 ms).`);

// 2. Test unitario local de fallback: forzar fallo en motor principal (GEMINI_API_KEY inválida) y comprobar conmutación al secundario (mock fetch)
const originalFetch = globalThis.fetch;
try {
  let groqCalled = false;
  globalThis.fetch = (async (url: string | URL | Request) => {
    const u = String(url);
    if (u.includes("generativelanguage.googleapis.com")) {
      return new Response(JSON.stringify({ error: { message: "Simulated primary outage" } }), {
        status: 503,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (u.includes("api.groq.com")) {
      groqCalled = true;
      return new Response(
        JSON.stringify({
          choices: [{ message: { content: "Respuesta generada por motor secundario tras conmutación." } }],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }
    throw new Error(`Unexpected URL in mock: ${u}`);
  }) as typeof fetch;

  const fallbackRes = await handlePublicAI({
    body: { prompt: "Hola", lang: "es", stream: true },
    env: { GEMINI_API_KEY: "invalid-key", GROQ_API_KEY: "valid-fallback-key" },
    ip: "127.0.0.1",
    origin: "https://muntru.me",
    rateLimited: async () => false,
    corsHeaders: () => ({ "Access-Control-Allow-Origin": "https://muntru.me" }),
  });

  assert.ok(groqCalled, "Debe conmutar al motor secundario cuando el primario falla");
  assert.ok(fallbackRes.response, "Debe devolver Response SSE tras el fallback");
  assert.equal(fallbackRes.response.status, 200, "No debe devolver HTTP 500 tras conmutación");
  const fallbackText = await fallbackRes.response.text();
  assert.ok(fallbackText.includes("secundario"), "Debe contener la respuesta del motor secundario");
  console.log("   ✅ Fallback automático de motor primario a secundario verificado (HTTP 200 SSE).");
} finally {
  globalThis.fetch = originalFetch;
}

console.log("✅ [Prompt 30.3] Latencia y Fallback de Muntrume AI superados al 100%.");
