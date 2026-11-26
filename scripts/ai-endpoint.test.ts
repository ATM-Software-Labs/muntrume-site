import assert from "node:assert/strict";
import { handleAiRequest, resetAiLimitsForTests } from "../src/server/ai-handler.ts";
import { answerLocally } from "../src/ai/local-engine.ts";

const fuel = "Estrategia de combustible GT3: 2,8 L por vuelta, vuelta de 1:45, carrera de 45 minutos, margen de 1,5 vueltas.";

function post(body: unknown, headers?: HeadersInit) {
  return new Request("http://localhost/api/ai", {
    method: "POST",
    headers: { "content-type": "application/json", origin: "http://localhost:4321", ...headers },
    body: JSON.stringify(body),
  });
}

async function read(response: Response) {
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") || "", /text\/event-stream/);
  const text = await response.text();
  assert.match(text, /data: /);
  assert.match(text, /\[DONE\]/);
  return text;
}

resetAiLimitsForTests();

const localFuel = answerLocally([{ role: "user", content: fuel }], "team", "ultra");
assert.match(localFuel, /<think>/);
assert.match(localFuel, /77,0 L/);
assert.match(localFuel, /26/);
assert.doesNotMatch(answerLocally([{ role: "user", content: "¿Quiénes son los pilotos y el contacto?" }], "team", "lite"), /eduardo@/i);
assert.match(answerLocally([{ role: "user", content: "contacto del equipo" }], "team", "lite"), /alberto@muntru\.me/);
assert.match(answerLocally([{ role: "user", content: "contacto del equipo" }], "team", "lite"), /mateo@muntru\.me/);
assert.match(answerLocally([{ role: "user", content: "contacto del equipo" }], "team", "lite"), /admin@muntru\.me/);
assert.match(answerLocally([{ role: "user", content: "contacto del equipo" }], "team", "lite"), /legal@muntru\.me/);
assert.match(answerLocally([{ role: "user", content: "contacto del equipo" }], "team", "lite"), /no hay correo publicado/);
assert.doesNotMatch(answerLocally([{ role: "user", content: "overlay" }], "team", "lite"), /42\.654|discord\.gg/i);

const streamed = await read(await handleAiRequest(post({ mode: "team", tier: "ultra", messages: [{ role: "user", content: fuel }] })));
assert.match(streamed, /77,0/);
assert.match(streamed, /"provider":"local"/);

const secret = "super-secret-groq-key-xyz";
const failed = await read(await handleAiRequest(
  post({ mode: "team", tier: "lite", messages: [{ role: "user", content: fuel }] }),
  { GROQ_API_KEY: secret },
  { fetchImpl: async () => { throw new Error(`boom ${secret}`); } }
));
assert.match(failed, /77,0/);
assert.equal(failed.includes(secret), false);

let calls = 0;
const ok = await read(await handleAiRequest(
  post({ mode: "oss", tier: "lite", messages: [{ role: "user", content: "di ping" }] }),
  {
    AI: {
      async run() {
        calls += 1;
        const encoder = new TextEncoder();
        return new Response(new ReadableStream({
          start(controller) {
            controller.enqueue(encoder.encode('data: {"response":"RESPUESTA-MODELO"}\n\n'));
            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
            controller.close();
          },
        }));
      },
    },
  }
));
assert.equal(calls, 1);
assert.match(ok, /RESPUESTA-MODELO/);
assert.equal(ok.includes("alberto@muntru.me"), false);
assert.match(ok, /workers-ai/);

resetAiLimitsForTests();
const huge = "a".repeat(4001);
const limitedText = await read(await handleAiRequest(post({ messages: [{ role: "user", content: huge }] })));
assert.match(limitedText, /demasiado largo/i);
assert.equal(limitedText.toLowerCase().includes("syntaxerror"), false);

resetAiLimitsForTests();
for (let i = 0; i < 20; i += 1) {
  await read(await handleAiRequest(post({ messages: [{ role: "user", content: "hola" }] })));
}
const rate = await read(await handleAiRequest(post({ messages: [{ role: "user", content: "hola" }] })));
assert.match(rate, /Demasiadas consultas/);

console.log("ai endpoint ok");
