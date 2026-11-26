/**
 * POST /api/ai — SSE.
 * Binding opcional: AI (Workers AI), AI_RATE_LIMIT (KV).
 * Secretos opcionales: GROQ_API_KEY, OPENROUTER_API_KEY.
 * Sin binding ni secreto, responde el motor local. Nunca devuelve un error crudo.
 */
import { answerLocally, systemPrompt, type AiMode, type AiTier, type ChatTurn } from "../ai/local-engine";

export interface AiKv {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<unknown>;
}

export interface AiBinding {
  run(model: string, input: Record<string, unknown>): Promise<unknown>;
}

export interface AiEnv {
  AI?: AiBinding;
  AI_RATE_LIMIT?: AiKv;
  GROQ_API_KEY?: string;
  OPENROUTER_API_KEY?: string;
}

export interface AiDeps {
  fetchImpl?: typeof fetch;
}

interface Meta {
  provider: "workers-ai" | "groq" | "openrouter" | "local";
  model: string;
}

const LIMITS = { message: 4000, turns: 8, total: 12000, perMinute: 20 };
const buckets = new Map<string, number[]>();

const MODELS: Record<"workers" | "groq" | "openrouter", Record<Exclude<AiTier, "local">, { id: string; reasoning?: string }[]>> = {
  workers: {
    lite: [
      { id: "@cf/meta/llama-4-scout-17b-16e-instruct" },
      { id: "@cf/ibm-granite/granite-4.0-h-micro" },
    ],
    pro: [
      { id: "@cf/meta/llama-3.3-70b-instruct-fp8-fast" },
      { id: "@cf/qwen/qwen2.5-coder-32b-instruct" },
    ],
    ultra: [
      { id: "@cf/qwen/qwen3.8-27b", reasoning: "xhigh" },
      { id: "@cf/openai/gpt-oss-120b", reasoning: "high" },
    ],
  },
  groq: {
    lite: [{ id: "openai/gpt-oss-20b" }],
    pro: [{ id: "openai/gpt-oss-120b" }],
    ultra: [{ id: "qwen/qwen3.8-27b" }],
  },
  openrouter: {
    lite: [{ id: "google/gemma-4-26b-a4b-it:free" }],
    pro: [{ id: "google/gemma-4-31b-it:free" }],
    ultra: [{ id: "google/gemma-4-31b-it:free" }],
  },
};

export function resetAiLimitsForTests(): void {
  buckets.clear();
}

function tierOf(value: unknown): Exclude<AiTier, "local"> {
  if (value === "pro" || value === "ultra" || value === "lite") return value;
  return "lite";
}

function modeOf(value: unknown): AiMode {
  return value === "oss" ? "oss" : "team";
}

function clientIp(request: Request): string {
  const cf = request.headers.get("cf-connecting-ip");
  if (cf) return cf.slice(0, 64);
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim().slice(0, 64);
  return "local";
}

function allowOrigin(request: Request): string {
  const origin = request.headers.get("origin") || "";
  if (/^https:\/\/(www\.)?muntru\.me$/i.test(origin) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin)) {
    return origin;
  }
  return "";
}

function baseHeaders(request: Request): Headers {
  const headers = new Headers();
  const origin = allowOrigin(request);
  if (origin) headers.set("access-control-allow-origin", origin);
  headers.set("vary", "origin");
  headers.set("access-control-allow-methods", "POST, OPTIONS");
  headers.set("access-control-allow-headers", "content-type");
  headers.set("x-content-type-options", "nosniff");
  headers.set("cache-control", "no-store");
  return headers;
}

async function limited(request: Request, env: AiEnv): Promise<boolean> {
  const ip = clientIp(request);
  const now = Date.now();
  if (env.AI_RATE_LIMIT) {
    const key = `ai:${ip}`;
    const raw = await env.AI_RATE_LIMIT.get(key).catch(() => null);
    const hits = (raw ? raw.split(",").map(Number).filter((n) => now - n < 60_000) : []);
    if (hits.length >= LIMITS.perMinute) return true;
    hits.push(now);
    await env.AI_RATE_LIMIT.put(key, hits.join(","), { expirationTtl: 120 }).catch(() => undefined);
    return false;
  }
  const hits = (buckets.get(ip) || []).filter((stamp) => now - stamp < 60_000);
  if (hits.length >= LIMITS.perMinute) {
    buckets.set(ip, hits);
    return true;
  }
  hits.push(now);
  buckets.set(ip, hits);
  return false;
}

function cleanTurns(value: unknown): ChatTurn[] | null {
  if (!Array.isArray(value)) return null;
  const turns: ChatTurn[] = [];
  let total = 0;
  for (const item of value.slice(-LIMITS.turns)) {
    if (!item || typeof item !== "object") continue;
    const role = (item as { role?: unknown }).role;
    const content = (item as { content?: unknown }).content;
    if ((role !== "user" && role !== "assistant") || typeof content !== "string") continue;
    if (content.length > LIMITS.message) return null;
    const text = content;
    total += text.length;
    if (total > LIMITS.total) return null;
    turns.push({ role, content: text });
  }
  return turns;
}

function chunkText(text: string): string[] {
  const parts = text.split(/(\s+)/);
  const out: string[] = [];
  let buf = "";
  for (const part of parts) {
    buf += part;
    if (buf.length >= 24) {
      out.push(buf);
      buf = "";
    }
  }
  if (buf) out.push(buf);
  return out.length ? out : [text];
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout")), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

function joiner(): (next: string) => string {
  let acc = "";
  return (next: string) => {
    if (!next) return "";
    if (acc && next.startsWith(acc)) {
      const delta = next.slice(acc.length);
      acc = next;
      return delta;
    }
    acc += next;
    return next;
  };
}

async function emitPayload(
  payload: unknown,
  send: (kind: "token" | "reasoning", text: string) => void
): Promise<boolean> {
  if (payload instanceof Response) return emitStream(payload, send);
  if (payload && typeof (payload as ReadableStream).getReader === "function") {
    return emitStream(new Response(payload as ReadableStream), send);
  }
  if (!payload || typeof payload !== "object") return false;
  const record = payload as {
    response?: unknown;
    reasoning?: unknown;
    choices?: { message?: { content?: unknown; reasoning?: unknown }; delta?: { content?: unknown; reasoning?: unknown } }[];
  };
  const choice = record.choices?.[0];
  const content = String(choice?.message?.content ?? choice?.delta?.content ?? record.response ?? "");
  const reasoning = String(choice?.message?.reasoning ?? choice?.delta?.reasoning ?? record.reasoning ?? "");
  if (reasoning) send("reasoning", reasoning);
  if (content) send("token", content);
  return Boolean(reasoning || content);
}

async function emitStream(response: Response, send: (kind: "token" | "reasoning", text: string) => void): Promise<boolean> {
  if (!response.ok || !response.body) return false;
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const contentJoin = joiner();
  const reasonJoin = joiner();
  let buffer = "";
  let any = false;
  const push = (kind: "token" | "reasoning", raw: unknown) => {
    const text = kind === "token" ? contentJoin(String(raw || "")) : reasonJoin(String(raw || ""));
    if (!text) return;
    any = true;
    send(kind, text);
  };
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const data = trimmed.slice(5).trim();
      if (!data || data === "[DONE]") continue;
      try {
        const json = JSON.parse(data) as {
          response?: unknown;
          reasoning?: unknown;
          choices?: { delta?: { content?: unknown; reasoning?: unknown; reasoning_content?: unknown } }[];
        };
        const delta = json.choices?.[0]?.delta;
        push("reasoning", delta?.reasoning || delta?.reasoning_content || json.reasoning || "");
        push("token", delta?.content || json.response || "");
      } catch {
        /* ignora un fragmento incompleto */
      }
    }
  }
  return any;
}

function timeoutFor(tier: Exclude<AiTier, "local">): number {
  if (tier === "ultra") return 35_000;
  if (tier === "pro") return 22_000;
  return 12_000;
}

function maxTokens(tier: Exclude<AiTier, "local">): number {
  if (tier === "ultra") return 1400;
  if (tier === "pro") return 900;
  return 500;
}

async function tryWorkers(
  env: AiEnv,
  tier: Exclude<AiTier, "local">,
  messages: { role: string; content: string }[],
  send: (kind: "token" | "reasoning", text: string) => void
): Promise<Meta | null> {
  if (!env.AI?.run) return null;
  for (const model of MODELS.workers[tier]) {
    let emitted = false;
    const wrapped = (kind: "token" | "reasoning", text: string) => {
      emitted = true;
      send(kind, text);
    };
    try {
      const input: Record<string, unknown> = { messages, stream: true, max_tokens: maxTokens(tier) };
      if (model.reasoning) input.reasoning_effort = model.reasoning;
      const result = await withTimeout(env.AI.run(model.id, input), timeoutFor(tier));
      const ok = await emitPayload(result, wrapped);
      if (ok || emitted) return { provider: "workers-ai", model: model.id };
    } catch {
      if (emitted) return { provider: "workers-ai", model: model.id };
    }
  }
  return null;
}

async function tryChat(
  fetchImpl: typeof fetch,
  url: string,
  key: string,
  extra: HeadersInit,
  models: { id: string }[],
  tier: Exclude<AiTier, "local">,
  messages: { role: string; content: string }[],
  provider: Meta["provider"],
  send: (kind: "token" | "reasoning", text: string) => void
): Promise<Meta | null> {
  for (const model of models) {
    let emitted = false;
    const wrapped = (kind: "token" | "reasoning", text: string) => {
      emitted = true;
      send(kind, text);
    };
    try {
      const response = await withTimeout(
        fetchImpl(url, {
          method: "POST",
          headers: {
            authorization: `Bearer ${key}`,
            "content-type": "application/json",
            ...extra,
          },
          body: JSON.stringify({
            model: model.id,
            messages,
            stream: true,
            max_tokens: maxTokens(tier),
          }),
        }),
        timeoutFor(tier)
      );
      const ok = await emitPayload(response, wrapped);
      if (ok || emitted) return { provider, model: model.id };
    } catch {
      if (emitted) return { provider, model: model.id };
    }
  }
  return null;
}

function sse(request: Request, produce: (send: (event: unknown) => void) => Promise<void>): Response {
  const headers = baseHeaders(request);
  headers.set("content-type", "text/event-stream; charset=utf-8");
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: unknown) => {
        const line = event === "[DONE]" ? "data: [DONE]\n\n" : `data: ${JSON.stringify(event)}\n\n`;
        controller.enqueue(encoder.encode(line));
      };
      try {
        await produce(send);
      } catch {
        send({ token: "Respondo con el motor local." });
      }
      send("[DONE]");
      controller.close();
    },
  });
  return new Response(stream, { status: 200, headers });
}

export async function handleAiRequest(request: Request, env: AiEnv = {}, deps: AiDeps = {}): Promise<Response> {
  if (request.method === "OPTIONS") {
    const headers = baseHeaders(request);
    headers.set("access-control-max-age", "600");
    return new Response(null, { status: 204, headers });
  }
  if (request.method !== "POST") {
    return sse(request, async (send) => {
      send({ token: "Usa el formulario de Muntrume AI para preguntar." });
      send({ meta: { provider: "local", model: "muntrume-kb" } });
    });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = null;
  }
  const record = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const tier = tierOf(record.tier);
  const mode = modeOf(record.mode);
  const turns = cleanTurns(Array.isArray(record.messages) ? record.messages : []);
  if (!turns) {
    return sse(request, async (send) => {
      send({ token: "El mensaje es demasiado largo. Acórtalo e inténtalo de nuevo." });
      send({ meta: { provider: "local", model: "muntrume-kb" } });
    });
  }
  if (await limited(request, env).catch(() => false)) {
    return sse(request, async (send) => {
      send({ token: "Demasiadas consultas seguidas. Espera un momento y vuelve a preguntar." });
      send({ meta: { provider: "local", model: "muntrume-kb" } });
    });
  }
  const localText = answerLocally(turns, mode, tier);
  const chat = [{ role: "system", content: systemPrompt(mode, tier) }, ...turns];
  const fetchImpl = deps.fetchImpl || fetch;
  return sse(request, async (send) => {
    let thinkOpen = false;
    let sent = false;
    const forward = (kind: "token" | "reasoning", text: string) => {
      if (!text) return;
      if (kind === "reasoning") {
        if (!thinkOpen) {
          send({ token: "<think>\n" });
          thinkOpen = true;
        }
        send({ token: text });
        sent = true;
        return;
      }
      if (thinkOpen) {
        send({ token: "\n</think>\n\n" });
        thinkOpen = false;
      }
      send({ token: text });
      sent = true;
    };
    const groqKey = typeof env.GROQ_API_KEY === "string" ? env.GROQ_API_KEY : "";
    const openrouterKey = typeof env.OPENROUTER_API_KEY === "string" ? env.OPENROUTER_API_KEY : "";
    let meta: Meta | null = await tryWorkers(env, tier, chat, forward);
    if (!meta && groqKey) {
      meta = await tryChat(
        fetchImpl,
        "https://api.groq.com/openai/v1/chat/completions",
        groqKey,
        {},
        MODELS.groq[tier],
        tier,
        chat,
        "groq",
        forward
      );
    }
    if (!meta && openrouterKey) {
      meta = await tryChat(
        fetchImpl,
        "https://openrouter.ai/api/v1/chat/completions",
        openrouterKey,
        { "http-referer": "https://muntru.me", "x-title": "Muntrume AI" },
        MODELS.openrouter[tier],
        tier,
        chat,
        "openrouter",
        forward
      );
    }
    if (thinkOpen) {
      send({ token: "\n</think>\n\n" });
      thinkOpen = false;
    }
    if (!sent) {
      for (const piece of chunkText(localText)) send({ token: piece });
      meta = { provider: "local", model: "muntrume-kb" };
    }
    send({ meta });
  });
}
