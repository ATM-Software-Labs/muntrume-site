import PostalMime from "postal-mime";
/**
 * 🏁 Muntrume Motorsport · Cloudflare Worker (API de muntru.me)
 *
 * - Setup Vault: login con contraseña (PBKDF2-SHA256), sesiones firmadas HMAC (JWT_SECRET),
 *   enlaces de un solo uso para crear/restablecer contraseña, panel Race Control
 *   (aprobar / rechazar / reenviar invitación) y correos transaccionales vía Resend.
 * - Garage 61: proxy de solo lectura a la API oficial; devuelve únicamente datos reales.
 * - Formulario de contacto y asistente IA (Groq).
 *
 * Secretos (wrangler secret put): JWT_SECRET (obligatorio), RESEND_API_KEY, GROQ_API_KEY,
 * GARAGE61_API_TOKEN (opcional), ADMIN_ALERT_EMAIL/TO_EMAIL y RESEND_FROM_EMAIL (opcionales).
 * Variable (no secreta): CONTACT_TO_EMAIL = buzón que recibe el formulario de contacto (por defecto info@muntru.me).
 * Nunca se guardan ni se registran contraseñas en claro.
 */

import {
  requestReceivedEmail,
  adminNewRequestEmail,
  approvedLinkEmail,
  approvedTempPasswordEmail,
  rejectedEmail,
  resetPasswordEmail,
  contactFormEmail,
  loginCodeEmail,
  setupDigestEmail,
  teamEventEmail,
} from "./emails.js";

const SITE = "https://muntru.me";
const ALLOWED_ORIGINS = [
  "https://muntru.me",
  "https://www.muntru.me",
  "https://atrumin16.github.io",
  "http://localhost:3000",
  "http://localhost:5173",
  "http://127.0.0.1:5500",
];

const SESSION_TTL_MS = 7 * 24 * 3600 * 1000;
const INVITE_TTL_MS = 72 * 3600 * 1000;
const RESET_TTL_MS = 60 * 60 * 1000;
const MIN_PASSWORD = 10;
const PBKDF2_ITERATIONS = 100000; // máximo soportado por Workers
const CODE_TTL_MS = 10 * 60 * 1000;      // código por email: 10 min
const CODE_MAX_ATTEMPTS = 5;             // después se invalida
const CODE_COOLDOWN_MS = 60 * 1000;      // reenvío como mínimo cada 60 s
const ADMIN_REAUTH_MS = 60 * 60 * 1000;  // panel admin: verificación por código en la última hora
const DOWNLOADS_PER_HOUR = 1500;         // archivos por piloto y hora
const PHOTO_MAX_CHARS = 90000;           // foto de perfil (data URL WebP) ~65 KB
const EMAIL_RE = /^[^\s@<>"']{1,64}@[^\s@<>"']{1,190}\.[a-z]{2,24}$/i;

// ───────────────────────────── utilidades ─────────────────────────────

function isAllowedOrigin(origin) {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return true;
  return false;
}

function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": isAllowedOrigin(origin) ? origin : SITE,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Requested-With, Authorization, X-G61-Token",
    "Access-Control-Max-Age": "86400",
    "Content-Type": "application/json; charset=utf-8",
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": "no-store, private",
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
    "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
    "Cross-Origin-Resource-Policy": "same-site",
    "Permissions-Policy": "interest-cohort=()",
    Vary: "Origin",
  };
}

const enc = new TextEncoder();
const dec = new TextDecoder();

function b64urlFromBytes(bytes) {
  let s = "";
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  for (let i = 0; i < arr.length; i++) s += String.fromCharCode(arr[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function bytesFromB64url(str) {
  const s = String(str).replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(s + "===".slice((s.length + 3) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}
async function sha256Hex(text) {
  const d = new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(String(text))));
  return [...d].map((x) => x.toString(16).padStart(2, "0")).join("");
}
async function hmacHex(secret, text) {
  const k = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const d = new Uint8Array(await crypto.subtle.sign("HMAC", k, enc.encode(String(text))));
  return [...d].map((x) => x.toString(16).padStart(2, "0")).join("");
}
function randomCode6() {
  // muestreo por rechazo: distribución uniforme 000000-999999
  const buf = new Uint32Array(1);
  for (;;) {
    crypto.getRandomValues(buf);
    if (buf[0] < 4294000000) return String(buf[0] % 1000000).padStart(6, "0");
  }
}
function normEmail(e) {
  return String(e || "").trim().toLowerCase();
}
function clean(v, max) {
  return String(v ?? "").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").trim().slice(0, max);
}

/** Contraseña aleatoria criptográficamente segura (sin caracteres ambiguos). */
function generateTempPassword(length = 14) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const limit = 256 - (256 % alphabet.length);
  let out = "";
  while (out.length < length) {
    const buf = crypto.getRandomValues(new Uint8Array(length * 2));
    for (const b of buf) {
      if (b < limit && out.length < length) out += alphabet[b % alphabet.length];
    }
  }
  return `MTM-${out.slice(0, 4)}-${out.slice(4, 9)}-${out.slice(9)}`;
}

// ───────────────────────────── contraseñas ─────────────────────────────

async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations: PBKDF2_ITERATIONS },
    key,
    256
  );
  return `pbkdf2_sha256$${PBKDF2_ITERATIONS}$${b64urlFromBytes(salt)}$${b64urlFromBytes(bits)}`;
}

/** Devuelve { ok, legacy }. legacy=true si la contraseña estaba guardada en claro (formato antiguo). */
async function verifyPassword(password, stored) {
  if (!stored || !password) return { ok: false, legacy: false };
  if (stored.startsWith("pbkdf2_sha256$")) {
    const [, iterStr, saltB64, hashB64] = stored.split("$");
    const iterations = Math.min(parseInt(iterStr, 10) || PBKDF2_ITERATIONS, PBKDF2_ITERATIONS);
    const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
    const bits = new Uint8Array(
      await crypto.subtle.deriveBits(
        { name: "PBKDF2", hash: "SHA-256", salt: bytesFromB64url(saltB64), iterations },
        key,
        256
      )
    );
    return { ok: timingSafeEqual(bits, bytesFromB64url(hashB64)), legacy: false };
  }
  // Formato heredado (texto plano): comparación en tiempo constante sobre los hashes.
  const a = enc.encode(await sha256Hex(password));
  const b = enc.encode(await sha256Hex(stored));
  return { ok: timingSafeEqual(a, b), legacy: true };
}

/** Huella corta del hash actual: invalida enlaces y sesiones antiguas al cambiar la contraseña. */
async function passwordFingerprint(storedHash) {
  return (await sha256Hex(`fp:${storedHash || "none"}`)).slice(0, 16);
}

// ───────────────────────────── tokens firmados ─────────────────────────────

async function hmacKey(secret) {
  return crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
    "verify",
  ]);
}
async function signToken(payload, secret) {
  const data = b64urlFromBytes(enc.encode(JSON.stringify(payload)));
  const sig = await crypto.subtle.sign("HMAC", await hmacKey(secret), enc.encode(data));
  return `${data}.${b64urlFromBytes(sig)}`;
}
async function verifyToken(token, secret, typ) {
  try {
    if (!token || typeof token !== "string" || token.length > 2048) return null;
    const [data, sig] = token.split(".");
    if (!data || !sig) return null;
    const ok = await crypto.subtle.verify("HMAC", await hmacKey(secret), bytesFromB64url(sig), enc.encode(data));
    if (!ok) return null;
    const payload = JSON.parse(dec.decode(bytesFromB64url(data)));
    if (!payload.exp || Date.now() > payload.exp) return null;
    if (typ && payload.typ !== typ) return null;
    return payload;
  } catch {
    return null;
  }
}

// ───────────────────────────── correo (Resend) ─────────────────────────────

async function sendEmail(env, { to, subject, html, text, replyTo, from, headers, attachments }) {
  if (!env.RESEND_API_KEY) return { ok: false, error: "RESEND_API_KEY no configurada" };
  const payload = {
    from: from || env.RESEND_FROM_EMAIL || "Muntrume Motorsport <muntrume@trujillomingorance.com>",
    to: Array.isArray(to) ? to : [to],
    subject,
    html,
    text,
  };
  if (replyTo) payload.reply_to = replyTo;
  if (headers) payload.headers = headers;
  if (attachments?.length) payload.attachments = attachments;
  const post = (p) =>
    fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify(p),
    });
  try {
    let res = await post(payload);
    let data = await res.json().catch(() => ({}));
    if (!res.ok && !env.RESEND_FROM_EMAIL) {
      // Dominio aún sin verificar en Resend: remitente de pruebas (solo entrega al titular de la cuenta Resend).
      console.warn("[email] remitente principal rechazado:", res.status, data?.name || "");
      res = await post({ ...payload, from: "Muntrume Motorsport <onboarding@resend.dev>" });
      data = await res.json().catch(() => ({}));
    }
    if (!res.ok) {
      console.error("[email] envío fallido:", res.status, data?.name || "", data?.message || "");
      return { ok: false, error: data?.message || `Resend HTTP ${res.status}` };
    }
    return { ok: true, id: data.id };
  } catch (e) {
    console.error("[email] excepción:", e?.message);
    return { ok: false, error: "No se pudo contactar con el proveedor de correo" };
  }
}

function adminAlertAddress(env) {
  return env.ADMIN_ALERT_EMAIL || env.TO_EMAIL || "alberto@trujillomingorance.com";
}

// ───────────────────────────── rate limit ligero ─────────────────────────────

/**
 * Limita intentos por clave.
 * 1) Binding nativo de Workers Rate Limiting (RATE_LIMITER: 10 peticiones / 60 s por clave), que sí funciona en workers.dev.
 * 2) Además, contador best-effort en la Cache API para ventanas más largas (solo efectivo en dominios propios).
 */
let RATE_LIMITER = null;
async function rateLimited(key, max, windowSec) {
  if (RATE_LIMITER) {
    try {
      const { success } = await RATE_LIMITER.limit({ key });
      if (!success) return true;
    } catch (e) {
      console.warn("[ratelimit] binding no disponible:", e?.message);
    }
  }
  try {
    const cache = caches.default;
    const req = new Request(`https://ratelimit.muntrume.internal/${encodeURIComponent(key)}`);
    const hit = await cache.match(req);
    const count = hit ? parseInt(await hit.text(), 10) || 0 : 0;
    if (count >= max) return true;
    await cache.put(
      req,
      new Response(String(count + 1), { headers: { "Cache-Control": `max-age=${windowSec}` } })
    );
    return false;
  } catch {
    return false;
  }
}

// ───────────────────────────── helpers de sesión ─────────────────────────────

async function issueSession(env, user, opts = {}) {
  const now = Date.now();
  const token = await signToken(
    {
      typ: "session",
      sub: user.email,
      name: user.name,
      role: user.role || "driver",
      mcp: user.must_change_password ? 1 : 0,
      fp: await passwordFingerprint(user.password_hash),
      sv: user.session_version || 0,
      amr: opts.amr || "pwd",
      cv: opts.codeVerified ? now : opts.cv || 0,
      iat: now,
      exp: now + SESSION_TTL_MS,
    },
    env.JWT_SECRET
  );
  try {
    await env.muntrume_vault.prepare("UPDATE allowed_users SET last_login_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?").bind(user.id).run();
  } catch (e) { console.warn("[session] last_login:", e?.message); }
  return {
    token,
    admin_verified_until: opts.codeVerified ? now + ADMIN_REAUTH_MS : null,
    user: { email: user.email, name: user.name, role: user.role || "driver" },
    must_change_password: !!user.must_change_password,
  };
}

async function getUser(env, email) {
  return env.muntrume_vault
    .prepare(
      "SELECT id, email, name, role, status, password_hash, must_change_password, created_at, session_version, last_login_at, team, car_class FROM allowed_users WHERE lower(email) = ?"
    )
    .bind(normEmail(email))
    .first();
}

/**
 * Valida la sesión contra la base de datos (usuario activo y contraseña no cambiada desde que se emitió).
 * opts.allowPendingChange: permite sesiones que aún deben cambiar la contraseña.
 * opts.admin: exige rol admin.
 */
async function requireSession(request, body, env, opts = {}) {
  const auth = request.headers.get("Authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : String(body?.token || "");
  const payload = await verifyToken(token, env.JWT_SECRET, "session");
  if (!payload) return { error: "Sesión no válida o caducada. Vuelve a iniciar sesión.", status: 401 };
  const user = await getUser(env, payload.sub);
  if (!user || user.status !== "active")
    return { error: "Tu acceso al Vault no está activo.", status: 401 };
  if ((await passwordFingerprint(user.password_hash)) !== payload.fp)
    return { error: "Tu contraseña ha cambiado. Vuelve a iniciar sesión.", status: 401 };
  if ((user.session_version || 0) !== (payload.sv || 0))
    return { error: "Tu sesión se ha cerrado. Vuelve a iniciar sesión.", status: 401 };
  if (user.must_change_password && !opts.allowPendingChange)
    return { error: "Debes cambiar tu contraseña antes de continuar.", status: 403, code: "must_change_password" };
  if (opts.admin && user.role !== "admin") return { error: "Solo Race Control (admins).", status: 403 };
  if (opts.admin && !(payload.cv && Date.now() - payload.cv < ADMIN_REAUTH_MS))
    return { error: "Por seguridad, confirma tu identidad con un código enviado a tu correo.", status: 403, code: "reauth_required" };
  return { user, payload };
}

async function makeSetPasswordLink(env, user, ttlMs, purpose) {
  const token = await signToken(
    {
      typ: "setpw",
      purpose,
      sub: user.email,
      fp: await passwordFingerprint(user.password_hash),
      exp: Date.now() + ttlMs,
    },
    env.JWT_SECRET
  );
  return `${SITE}/setups?setpw=${token}`;
}

// ───────────────────────────── handlers ─────────────────────────────

async function handleLogin(body, env, ip) {
  const email = normEmail(body.email);
  const password = String(body.password ?? "");
  if (!EMAIL_RE.test(email) || !password) return [400, { success: false, error: "Introduce tu correo y tu contraseña." }];
  if ((await rateLimited(`login:${ip}`, 20, 600)) || (await rateLimited(`login:${email}`, 8, 600)))
    return [429, { success: false, error: "Demasiados intentos. Espera unos minutos e inténtalo de nuevo." }];

  const generic = [401, { success: false, error: "Correo o contraseña incorrectos." }];
  const user = await getUser(env, email);
  if (!user) {
    await hashPassword(password); // coste similar para no revelar si el correo existe
    return generic;
  }
  if (user.status !== "active") return [403, { success: false, error: "Tu acceso al Vault está desactivado. Contacta con Race Control." }];
  if (!user.password_hash) {
    return [401, { success: false, error: "Tu cuenta aún no tiene contraseña. Usa «¿Primer acceso u olvidaste tu contraseña?» para recibir un enlace.", code: "no_password" }];
  }
  const { ok, legacy } = await verifyPassword(password, user.password_hash);
  if (!ok) return generic;

  if (legacy) {
    // Migración transparente del formato antiguo (texto plano) a PBKDF2.
    user.password_hash = await hashPassword(password);
    await env.muntrume_vault
      .prepare("UPDATE allowed_users SET password_hash = ? WHERE id = ?")
      .bind(user.password_hash, user.id)
      .run();
  }
  return [200, { success: true, ...(await issueSession(env, user)) }];
}

// ─────────────── acceso sin contraseña: código de 6 dígitos (+ enlace mágico) ───────────────

const CODE_GENERIC = { success: true, message: "Si el correo pertenece a un piloto autorizado, recibirás un código en unos segundos. Revisa también la carpeta de spam.", cooldown_s: CODE_COOLDOWN_MS / 1000 };

async function handleCodeRequest(body, env, ip, ctx) {
  const email = normEmail(body.email);
  if (!EMAIL_RE.test(email)) return [400, { success: false, error: "Introduce un correo válido." }];
  const generic = [200, CODE_GENERIC];
  // Mismo mensaje para correos desconocidos, limitados o en enfriamiento: no se revela si la cuenta existe.
  if ((await rateLimited(`code:ip:${ip}`, 10, 3600)) || (await rateLimited(`code:em:${email}`, 6, 3600))) return generic;
  const db = env.muntrume_vault;
  const user = await getUser(env, email);
  if (!user || user.status !== "active") return generic;
  const now = Date.now();
  const prev = await db.prepare("SELECT sent_at FROM login_codes WHERE email = ?").bind(email).first();
  if (prev && now - prev.sent_at < CODE_COOLDOWN_MS) return generic;
  const code = randomCode6();
  const nonce = b64urlFromBytes(crypto.getRandomValues(new Uint8Array(16)));
  const codeHash = await hmacHex(env.JWT_SECRET, `login-code:${email}:${nonce}:${code}`);
  await db.prepare(
    "INSERT INTO login_codes (email, code_hash, nonce, expires_at, attempts, sent_at) VALUES (?, ?, ?, ?, 0, ?) " +
    "ON CONFLICT(email) DO UPDATE SET code_hash = excluded.code_hash, nonce = excluded.nonce, expires_at = excluded.expires_at, attempts = 0, sent_at = excluded.sent_at"
  ).bind(email, codeHash, nonce, now + CODE_TTL_MS, now).run();
  const magic = await signToken({ typ: "magic", sub: email, n: nonce, exp: now + CODE_TTL_MS }, env.JWT_SECRET);
  const mail = loginCodeEmail({ name: user.name, code, link: `${SITE}/setups#magic=${magic}`, expiresMinutes: CODE_TTL_MS / 60000, ...(await personalCtx(env, user.email)) });
  // El envío va en segundo plano para que el tiempo de respuesta no delate si el correo existe.
  const job = sendEmail(env, { to: user.email, ...mail }).then((r) => console.log("[code] enviado:", !!r.ok, r.ok ? r.id : r.error));
  if (ctx && ctx.waitUntil) ctx.waitUntil(job); else await job;
  return generic;
}

async function handleCodeVerify(body, env, ip) {
  const db = env.muntrume_vault;
  const bad = [401, { success: false, error: "Código incorrecto o caducado. Solicita uno nuevo si lo necesitas." }];
  if (await rateLimited(`verify:ip:${ip}`, 30, 600)) return [429, { success: false, error: "Demasiados intentos. Espera unos minutos." }];
  const now = Date.now();
  let email, row;
  if (body.magic) {
    const t = await verifyToken(String(body.magic), env.JWT_SECRET, "magic");
    if (!t) return [401, { success: false, error: "El enlace no es válido o ha caducado. Pide un código nuevo." }];
    email = normEmail(t.sub);
    row = await db.prepare("SELECT code_hash, nonce, expires_at, attempts FROM login_codes WHERE email = ?").bind(email).first();
    if (!row || row.expires_at < now || !timingSafeEqual(enc.encode(row.nonce), enc.encode(String(t.n))))
      return [401, { success: false, error: "Este enlace ya se ha usado o ha caducado. Pide un código nuevo." }];
  } else {
    email = normEmail(body.email);
    const code = String(body.code || "").replace(/\D/g, "");
    if (!EMAIL_RE.test(email) || code.length !== 6) return [400, { success: false, error: "Introduce el código de 6 dígitos." }];
    row = await db.prepare("SELECT code_hash, nonce, expires_at, attempts FROM login_codes WHERE email = ?").bind(email).first();
    if (!row) return bad;
    if (row.expires_at < now || row.attempts >= CODE_MAX_ATTEMPTS) {
      await db.prepare("DELETE FROM login_codes WHERE email = ?").bind(email).run();
      return bad;
    }
    await db.prepare("UPDATE login_codes SET attempts = attempts + 1 WHERE email = ?").bind(email).run();
    const h = await hmacHex(env.JWT_SECRET, `login-code:${email}:${row.nonce}:${code}`);
    if (!timingSafeEqual(enc.encode(h), enc.encode(row.code_hash))) {
      if (row.attempts + 1 >= CODE_MAX_ATTEMPTS) {
        await db.prepare("DELETE FROM login_codes WHERE email = ?").bind(email).run();
        return [401, { success: false, error: "Demasiados intentos fallidos. Solicita un código nuevo.", code: "code_locked" }];
      }
      return bad;
    }
  }
  // un solo uso
  const del = await db.prepare("DELETE FROM login_codes WHERE email = ? AND nonce = ?").bind(email, row.nonce).run();
  if (!del.meta?.changes) return bad;
  const user = await getUser(env, email);
  if (!user || user.status !== "active") return bad;
  return [200, { success: true, ...(await issueSession(env, user, { amr: body.magic ? "magic" : "code", codeVerified: true })) }];
}

async function handleChangePassword(request, body, env) {
  const s = await requireSession(request, body, env, { allowPendingChange: true });
  if (s.error) return [s.status, { success: false, error: s.error, code: s.code }];
  const pw = String(body.new_password || "");
  const err = passwordProblem(pw, s.user.email);
  if (err) return [400, { success: false, error: err }];
  const hash = await hashPassword(pw);
  await env.muntrume_vault
    .prepare("UPDATE allowed_users SET password_hash = ?, must_change_password = 0 WHERE id = ?")
    .bind(hash, s.user.id)
    .run();
  const user = { ...s.user, password_hash: hash, must_change_password: 0 };
  return [200, { success: true, message: "Contraseña actualizada.", ...(await issueSession(env, user, { amr: s.payload.amr, cv: s.payload.cv })) }];
}

function passwordProblem(pw, email) {
  if (pw.length < MIN_PASSWORD) return `La contraseña debe tener al menos ${MIN_PASSWORD} caracteres.`;
  if (pw.length > 128) return "La contraseña es demasiado larga (máx. 128).";
  if (pw.toLowerCase() === normEmail(email)) return "La contraseña no puede ser tu correo.";
  if (/^(.)\1+$/.test(pw)) return "Elige una contraseña menos predecible.";
  return null;
}

async function handleForgotPassword(body, env, ip) {
  const email = normEmail(body.email);
  const generic = [200, { success: true, message: "Si el correo pertenece a un piloto autorizado, recibirás un enlace en unos minutos." }];
  if (!EMAIL_RE.test(email)) return [400, { success: false, error: "Introduce un correo válido." }];
  if ((await rateLimited(`forgot:${ip}`, 10, 3600)) || (await rateLimited(`forgot:${email}`, 3, 900))) return generic;
  const user = await getUser(env, email);
  if (!user || user.status !== "active") return generic;
  // Cuenta sin contraseña (alta nueva o contraseña anulada): enlace de primer acceso de 72 h.
  // Cuenta con contraseña: enlace de restablecimiento de 1 h.
  const firstAccess = !user.password_hash;
  const link = await makeSetPasswordLink(env, user, firstAccess ? INVITE_TTL_MS : RESET_TTL_MS, firstAccess ? "invite" : "reset");
  const pc = await personalCtx(env, user.email);
  const mail = firstAccess
    ? approvedLinkEmail({ name: user.name, email: user.email, link, expiresHours: INVITE_TTL_MS / 3600000, ...pc })
    : resetPasswordEmail({ name: user.name, link, expiresMinutes: RESET_TTL_MS / 60000, ...pc });
  const sent = await sendEmail(env, { to: user.email, ...mail });
  console.log("[forgot] enlace", firstAccess ? "invite" : "reset", "enviado:", !!sent.ok, sent.ok ? sent.id : sent.error);
  return generic;
}

async function handleSetPassword(body, env) {
  const t = await verifyToken(String(body.token || ""), env.JWT_SECRET, "setpw");
  if (!t) return [400, { success: false, error: "El enlace no es válido o ha caducado. Solicita uno nuevo.", code: "invalid_link" }];
  const user = await getUser(env, t.sub);
  if (!user || user.status !== "active") return [400, { success: false, error: "El enlace ya no es válido.", code: "invalid_link" }];
  if ((await passwordFingerprint(user.password_hash)) !== t.fp)
    return [400, { success: false, error: "Este enlace ya se ha utilizado. Solicita uno nuevo si lo necesitas.", code: "invalid_link" }];
  if (body.check_only) return [200, { success: true, email: user.email, name: user.name, purpose: t.purpose }];
  const pw = String(body.new_password || "");
  const err = passwordProblem(pw, user.email);
  if (err) return [400, { success: false, error: err }];
  const hash = await hashPassword(pw);
  await env.muntrume_vault
    .prepare("UPDATE allowed_users SET password_hash = ?, must_change_password = 0 WHERE id = ?")
    .bind(hash, user.id)
    .run();
  return [200, { success: true, message: "Contraseña guardada.", ...(await issueSession(env, { ...user, password_hash: hash, must_change_password: 0 })) }];
}

async function handleRequestJoin(body, env, ip) {
  if (body.website) return [200, { success: true, message: "Solicitud registrada." }]; // honeypot
  const name = clean(body.name, 80);
  const email = normEmail(clean(body.email, 254));
  const iracing_id = clean(body.iracing_id, 20);
  const car_category = clean(body.car_category, 80);
  const message = clean(body.message, 1500);
  if (name.length < 2) return [400, { success: false, error: "Indica tu nombre de piloto." }];
  if (!EMAIL_RE.test(email)) return [400, { success: false, error: "Introduce un correo válido." }];
  if (iracing_id && !/^\d{1,10}$/.test(iracing_id)) return [400, { success: false, error: "El iRacing ID debe ser numérico (Customer ID)." }];
  if (await rateLimited(`join:${ip}`, 5, 3600)) return [429, { success: false, error: "Has enviado varias solicitudes seguidas. Inténtalo más tarde." }];

  const db = env.muntrume_vault;
  const member = await getUser(env, email);
  if (member && member.status === "active")
    return [409, { success: false, code: "already_member", error: "Este correo ya tiene acceso al Vault. Inicia sesión o usa «¿Olvidaste tu contraseña?»." }];
  const pending = await db.prepare("SELECT id FROM join_requests WHERE lower(email) = ? AND status = 'pending'").bind(email).first();
  if (pending)
    return [200, { success: true, duplicate: true, message: "Ya tenemos una solicitud pendiente con este correo. Te avisaremos en cuanto se revise." }];

  await db
    .prepare("INSERT INTO join_requests (name, email, iracing_id, car_category, message, status) VALUES (?, ?, ?, ?, ?, 'pending')")
    .bind(name, email, iracing_id || null, car_category || null, message || null)
    .run();

  const data = { name, email, iracing_id, car_category, message };
  const [, receipt] = await Promise.all([
    sendEmail(env, { to: adminAlertAddress(env), replyTo: email, ...adminNewRequestEmail(data) }),
    sendEmail(env, { to: email, ...requestReceivedEmail(data) }),
  ]);
  return [200, {
    success: true,
    email_sent: !!receipt?.ok,
    message: receipt?.ok
      ? "Solicitud registrada. Te hemos enviado un correo de confirmación; Control de Carrera la revisará."
      : "Solicitud registrada. Control de Carrera la revisará y te escribirá a este correo.",
  }];
}

async function handleAdminPanel(request, body, env) {
  const s = await requireSession(request, body, env, { admin: true });
  if (s.error) return [s.status, { success: false, error: s.error, code: s.code }];
  const db = env.muntrume_vault;
  const [reqs, members] = await Promise.all([
    db.prepare("SELECT id, name, email, iracing_id, car_category, message, status, created_at, approved_at FROM join_requests ORDER BY CASE status WHEN 'pending' THEN 0 ELSE 1 END, created_at DESC LIMIT 300").all(),
    db.prepare("SELECT id, email, name, role, status, created_at, must_change_password, last_login_at, team, car_class, photo, public_visible, public_name, public_slug, public_bio, public_links, CASE WHEN password_hash IS NULL OR password_hash = '' THEN 0 ELSE 1 END AS has_password FROM allowed_users ORDER BY created_at DESC").all(),
  ]);
  return [200, { success: true, requests: reqs.results || [], members: members.results || [] }];
}

/** Crea o reactiva al piloto y genera credenciales según el método elegido. */
async function provisionPilot(env, { email, name, method }) {
  const db = env.muntrume_vault;
  let user = await getUser(env, email);
  let tempPassword = null;
  let hash = user?.password_hash || null;
  let mustChange = user?.must_change_password || 0;

  if (method === "temp_password") {
    tempPassword = generateTempPassword();
    hash = await hashPassword(tempPassword);
    mustChange = 1;
  }

  if (user) {
    await db
      .prepare("UPDATE allowed_users SET status = 'active', name = COALESCE(NULLIF(?, ''), name), password_hash = ?, must_change_password = ? WHERE id = ?")
      .bind(name, hash, mustChange, user.id)
      .run();
  } else {
    await db
      .prepare("INSERT INTO allowed_users (email, name, role, status, password_hash, must_change_password) VALUES (?, ?, 'driver', 'active', ?, ?)")
      .bind(email, name || email.split("@")[0], hash, mustChange)
      .run();
  }
  user = await getUser(env, email);

  let mail;
  let link = null;
  if (method === "temp_password") {
    mail = approvedTempPasswordEmail({ name: user.name, email: user.email, tempPassword, ...(await personalCtx(env, user.email)) });
  } else {
    link = await makeSetPasswordLink(env, user, INVITE_TTL_MS, "invite");
    mail = approvedLinkEmail({ name: user.name, email: user.email, link, expiresHours: INVITE_TTL_MS / 3600000, ...(await personalCtx(env, user.email)) });
  }
  return { user, mail, link, tempPassword };
}

async function handleAdminApprove(request, body, env) {
  const s = await requireSession(request, body, env, { admin: true });
  if (s.error) return [s.status, { success: false, error: s.error, code: s.code }];
  const db = env.muntrume_vault;
  const method = body.method === "temp_password" ? "temp_password" : "link";
  const notify = body.send_email !== false;

  let email;
  let name;
  let requestId = null;
  if (body.request_id || body.id) {
    requestId = parseInt(body.request_id || body.id, 10);
    const jr = await db.prepare("SELECT id, name, email, status FROM join_requests WHERE id = ?").bind(requestId).first();
    if (!jr) return [404, { success: false, error: "Solicitud no encontrada." }];
    if (jr.status !== "pending") return [409, { success: false, error: `Esta solicitud ya está ${jr.status === "approved" ? "aprobada" : "rechazada"}.` }];
    email = normEmail(jr.email);
    name = clean(jr.name, 80);
  } else {
    email = normEmail(body.email);
    name = clean(body.name, 80);
    if (!EMAIL_RE.test(email)) return [400, { success: false, error: "Correo no válido." }];
    if (name.length < 2) return [400, { success: false, error: "Indica el nombre del piloto." }];
  }

  const existing = await getUser(env, email);
  if (existing && existing.status === "active" && existing.password_hash && method === "link" && !body.force) {
    if (requestId) {
      await db.prepare("UPDATE join_requests SET status = 'approved', approved_at = CURRENT_TIMESTAMP, assigned_password = NULL WHERE id = ?").bind(requestId).run();
    }
    return [200, { success: true, already_member: true, email_sent: false, message: "Este piloto ya tenía acceso con contraseña propia. Solicitud marcada como aprobada; no se ha cambiado nada." }];
  }

  const { user, mail, link, tempPassword } = await provisionPilot(env, { email, name, method });
  if (requestId) {
    await db.prepare("UPDATE join_requests SET status = 'approved', approved_at = CURRENT_TIMESTAMP, assigned_password = NULL WHERE id = ?").bind(requestId).run();
  }

  const sent = notify ? await sendEmail(env, { to: user.email, ...mail }) : { ok: false, error: "Envío desactivado por el admin" };
  await audit(env, s.user.email, requestId ? "request.approve" : "user.add", user.email, `method=${method} email_sent=${!!sent.ok}`);
  return [200, {
    success: true,
    method,
    pilot: { email: user.email, name: user.name },
    email_sent: !!sent.ok,
    email_error: sent.ok ? null : sent.error,
    // Se muestran UNA sola vez al admin; no se guardan en claro en ningún sitio.
    set_password_link: link,
    temp_password: tempPassword,
    expires_hours: method === "link" ? INVITE_TTL_MS / 3600000 : null,
  }];
}

async function handleAdminReject(request, body, env) {
  const s = await requireSession(request, body, env, { admin: true });
  if (s.error) return [s.status, { success: false, error: s.error, code: s.code }];
  const db = env.muntrume_vault;
  const id = parseInt(body.request_id || body.id, 10);
  const jr = id ? await db.prepare("SELECT id, name, email, status FROM join_requests WHERE id = ?").bind(id).first() : null;
  if (!jr) return [404, { success: false, error: "Solicitud no encontrada." }];
  if (jr.status !== "pending") return [409, { success: false, error: "Solo se pueden rechazar solicitudes pendientes." }];
  await db.prepare("UPDATE join_requests SET status = 'rejected', assigned_password = NULL WHERE id = ?").bind(id).run();
  await audit(env, s.user.email, "request.reject", jr.email, body.notify ? "notified" : null);
  let sent = { ok: false, error: null };
  if (body.notify) {
    sent = await sendEmail(env, { to: jr.email, ...rejectedEmail({ name: jr.name, reason: clean(body.reason, 500) }) });
  }
  return [200, { success: true, email_sent: !!sent.ok, email_error: body.notify && !sent.ok ? sent.error : null }];
}

async function handleAdminResendInvite(request, body, env) {
  const s = await requireSession(request, body, env, { admin: true });
  if (s.error) return [s.status, { success: false, error: s.error, code: s.code }];
  const user = await getUser(env, body.email);
  if (!user || user.status !== "active") return [404, { success: false, error: "Piloto no encontrado o inactivo." }];
  const link = await makeSetPasswordLink(env, user, INVITE_TTL_MS, user.password_hash ? "reset" : "invite");
  const mail = approvedLinkEmail({ name: user.name, email: user.email, link, expiresHours: INVITE_TTL_MS / 3600000, ...(await personalCtx(env, user.email)) });
  const sent = await sendEmail(env, { to: user.email, ...mail });
  await audit(env, s.user.email, "user.send_link", user.email, `email_sent=${!!sent.ok}`);
  return [200, { success: true, email_sent: !!sent.ok, email_error: sent.ok ? null : sent.error, set_password_link: link, expires_hours: INVITE_TTL_MS / 3600000 }];
}

async function handleAdminSetStatus(request, body, env) {
  const s = await requireSession(request, body, env, { admin: true });
  if (s.error) return [s.status, { success: false, error: s.error, code: s.code }];
  const email = normEmail(body.email);
  const status = body.status === "active" ? "active" : "inactive"; // inactive = suspendido
  if (email === normEmail(s.user.email)) return [400, { success: false, error: "No puedes desactivar tu propia cuenta." }];
  const r = await env.muntrume_vault.prepare(`UPDATE allowed_users SET status = ?${status === "inactive" ? ", session_version = session_version + 1" : ""} WHERE lower(email) = ?`).bind(status, email).run();
  if (!r.meta?.changes) return [404, { success: false, error: "Piloto no encontrado." }];
  await audit(env, s.user.email, status === "active" ? "user.reactivate" : "user.suspend", email, null);
  return [200, { success: true, status }];
}

/** Envía las plantillas SOLO al correo del admin que lo pide (para revisar el formato). body.only = ["digest", "code", ...] opcional. */
async function handleAdminEmailPreview(request, body, env) {
  const s = await requireSession(request, body, env, { admin: true });
  if (s.error) return [s.status, { success: false, error: s.error, code: s.code }];
  const to = s.user.email;
  const demoLink = `${SITE}/setups?setpw=EJEMPLO-ENLACE-NO-VALIDO`;
  const pc = await personalCtx(env, to);
  const sample = { name: s.user.name || "Piloto", email: to };
  const all = {
    received: () => requestReceivedEmail(sample),
    admin_request: () => adminNewRequestEmail({ ...sample, iracing_id: "", car_category: "", message: "(correo de prueba de formato)" }),
    approved: () => approvedLinkEmail({ ...sample, link: demoLink, expiresHours: 72, ...pc }),
    temp_password: () => approvedTempPasswordEmail({ ...sample, tempPassword: "MTM-EJEM-PLO00-NOVAL", ...pc }),
    rejected: () => rejectedEmail({ name: sample.name, reason: "" }),
    reset: () => resetPasswordEmail({ name: sample.name, link: demoLink, expiresMinutes: 60, ...pc }),
    code: () => loginCodeEmail({ name: sample.name, code: "000000", link: `${SITE}/setups#magic=EJEMPLO-NO-VALIDO`, expiresMinutes: 10, ...pc }),
    digest: null,
    event: null,
  };
  const only = Array.isArray(body.only) ? body.only.filter((k) => k in all).slice(0, 8) : Object.keys(all);
  const results = [];
  for (const k of only) {
    let t, headers;
    let attachments;
    if (k === "digest") { const d = await buildDigest(env, s.user); t = d.mail; headers = d.headers; attachments = d.attachments; }
    else if (k === "event") {
      const d = await buildEventMail(env, s.user);
      if (!d) { results.push({ key: k, subject: "", ok: false, error: "No hay eventos próximos con fecha en el calendario del equipo." }); continue; }
      t = d.mail; headers = d.headers; attachments = d.attachments;
    }
    else t = all[k]();
    const r = await sendEmail(env, { to, ...t, headers, attachments, subject: `[PRUEBA] ${t.subject}` });
    results.push({ key: k, subject: t.subject, ok: !!r.ok, error: r.ok ? null : r.error });
  }
  return [200, { success: true, to, results }];
}

// ───────────────────────────── preferencias de correo (sin login, enlace firmado) ─────────────────────────────

const API_ORIGIN = "https://muntrume.atrumin16.workers.dev";
const PREF_LISTS = ["new_setups", "team_news"];
const prefsSecret = (env) => env.PREFS_SECRET || `${env.JWT_SECRET}|email-prefs`;
async function prefsToken(env, email) {
  return (await hmacHex(prefsSecret(env), `email-prefs:v1:${normEmail(email)}`)).slice(0, 40);
}
async function prefsVerify(env, u, t) {
  let email = "";
  try { email = normEmail(dec.decode(bytesFromB64url(String(u || "").slice(0, 400)))); } catch { return null; }
  if (!EMAIL_RE.test(email) || !/^[0-9a-f]{40}$/.test(String(t || ""))) return null;
  const good = await prefsToken(env, email);
  return timingSafeEqual(enc.encode(good), enc.encode(String(t))) ? email : null;
}
async function prefsLinks(env, email, list = "new_setups") {
  const u = b64urlFromBytes(enc.encode(normEmail(email)));
  const t = await prefsToken(env, email);
  return {
    manageUrl: `${SITE}/email-preferences#u=${u}&t=${t}`,
    unsubUrl: `${SITE}/email-preferences#u=${u}&t=${t}&unsub=${list}`,
    oneClickUrl: `${API_ORIGIN}/api/email/unsubscribe?u=${u}&t=${t}&l=${list}`,
  };
}
async function getPrefs(env, email) {
  let row = null;
  try { row = await env.muntrume_vault.prepare("SELECT new_setups, team_news, tz, updated_at FROM email_prefs WHERE email = ?").bind(normEmail(email)).first(); } catch {}
  return { new_setups: row ? !!row.new_setups : true, team_news: row ? !!row.team_news : true, tz: row?.tz || null, updated_at: row?.updated_at || null };
}
async function savePrefs(env, email, p) {
  await env.muntrume_vault.prepare(
    "INSERT INTO email_prefs (email, new_setups, team_news, tz, updated_at) VALUES (?1, ?2, ?3, ?4, strftime('%Y-%m-%dT%H:%M:%fZ','now')) " +
    "ON CONFLICT(email) DO UPDATE SET new_setups = ?2, team_news = ?3, tz = ?4, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')"
  ).bind(normEmail(email), p.new_setups ? 1 : 0, p.team_news ? 1 : 0, p.tz || null).run();
}
function validTz(tz) {
  const v = clean(tz, 64);
  if (!v) return null;
  try { new Intl.DateTimeFormat("en", { timeZone: v }); return v; } catch { return null; }
}
/** Contexto personal para cualquier correo a un piloto: zona horaria y enlace «Gestionar notificaciones». */
async function personalCtx(env, email) {
  try {
    const [p, l] = await Promise.all([getPrefs(env, email), prefsLinks(env, email)]);
    return { tz: p.tz || "Europe/Madrid", manageUrl: l.manageUrl };
  } catch { return { tz: "Europe/Madrid" }; }
}
/** Novedades personalizadas (solo datos reales de D1). No se envía automáticamente a nadie. */
async function buildDigest(env, user) {
  const db = env.muntrume_vault;
  const email = normEmail(user.email);
  const season = (await db.prepare("SELECT season FROM setups GROUP BY season ORDER BY season DESC LIMIT 1").first())?.season || "";
  const [tot, top, dl, prefs, links] = await Promise.all([
    db.prepare("SELECT count(*) n FROM setups WHERE season = ?").bind(season).first(),
    db.prepare("SELECT car, count(*) n FROM setups WHERE season = ? GROUP BY car ORDER BY n DESC LIMIT 5").bind(season).all(),
    db.prepare("SELECT at, kind, ref FROM download_log WHERE email = ? ORDER BY at DESC LIMIT 50").bind(email).all(),
    getPrefs(env, email),
    prefsLinks(env, email, "new_setups"),
  ]);
  const recent = dl.results || [];
  const cars = [...new Set(recent.map((r) => String(r.ref || "").split(/\/| · /)[0].trim()).filter(Boolean))].slice(0, 5);
  const forYou = [];
  for (const car of cars) {
    const r = await db.prepare("SELECT count(*) n FROM setups WHERE season = ? AND car = ?").bind(season, car).first();
    if (r?.n) forYou.push({ car, n: r.n });
  }
  const events = await upcomingEvents(env, 3);
  const mail = setupDigestEmail({
    events,
    name: user.name, tz: prefs.tz || "Europe/Madrid", team: user.team, carClass: user.car_class, season,
    seasonTotal: (tot?.n || 0).toLocaleString("es-ES"), forYou, topCars: top.results || [],
    recent: recent.map((r) => ({ at: r.at, ref: r.ref })), manageUrl: links.manageUrl, unsubUrl: links.unsubUrl,
  });
  const headers = {
    "List-Unsubscribe": `<${links.oneClickUrl}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    "List-Id": "Novedades del Setup Vault <new-setups.muntru.me>",
  };
  return { mail, headers, enabled: prefs.new_setups, attachments: events.length ? [icsAttachment(events)] : undefined };
}

/** Correo de evento (lista team_news). Solo con eventos reales de team_events; null si no hay. */
async function buildEventMail(env, user) {
  const events = await upcomingEvents(env, 3);
  if (!events.length) return null;
  const email = normEmail(user.email);
  const [prefs, links] = await Promise.all([getPrefs(env, email), prefsLinks(env, email, "team_news")]);
  const mail = teamEventEmail({ name: user.name, tz: prefs.tz || "Europe/Madrid", events, manageUrl: links.manageUrl, unsubUrl: links.unsubUrl });
  const headers = {
    "List-Unsubscribe": `<${links.oneClickUrl}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    "List-Id": "Noticias del equipo <team-news.muntru.me>",
  };
  return { mail, headers, enabled: prefs.team_news, attachments: [icsAttachment(events)] };
}

// ───────────────────────────── calendario del equipo (team_events) ─────────────────────────────

const EVENT_COLS = "id, title, starts_at, ends_at, track, car_class, url, notes";
const isoUtc = (d) => new Date(d).toISOString().replace(/\.\d{3}Z$/, "Z");
const icsStamp = (d) => isoUtc(d).replace(/[-:]/g, "");
const eventEnd = (ev) => ev.ends_at || isoUtc(new Date(ev.starts_at).getTime() + 2 * 3600e3);
function eventView(ev) {
  const end = eventEnd(ev);
  const loc = [ev.track, "iRacing"].filter(Boolean).join(" · ");
  const details = [ev.car_class, ev.notes, ev.url].filter(Boolean).join("\n");
  const q = new URLSearchParams({ action: "TEMPLATE", text: ev.title, dates: `${icsStamp(ev.starts_at)}/${icsStamp(end)}`, details, location: loc });
  return { id: ev.id, title: ev.title, starts_at: ev.starts_at, ends_at: end, track: ev.track || null, car_class: ev.car_class || null, url: ev.url || null, notes: ev.notes || null,
    gcal: `https://calendar.google.com/calendar/render?${q.toString()}`, ics: `${API_ORIGIN}/api/events/${ev.id}.ics` };
}
async function upcomingEvents(env, limit = 20) {
  try {
    const r = await env.muntrume_vault.prepare(`SELECT ${EVENT_COLS} FROM team_events WHERE starts_at >= ? ORDER BY starts_at ASC LIMIT ?`)
      .bind(isoUtc(Date.now() - 3 * 3600e3), limit).all();
    return (r.results || []).map(eventView);
  } catch (e) { console.warn("[events]", e?.message); return []; }
}
const icsEsc = (v) => String(v || "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
function icsFold(line) {
  const out = []; let cur = ""; let bytes = 0;
  for (const ch of line) {
    const b = enc.encode(ch).length;
    if (bytes + b > 74) { out.push(cur); cur = " "; bytes = 1; }
    cur += ch; bytes += b;
  }
  out.push(cur); return out.join("\r\n");
}
function buildIcs(events, name = "Muntrume Motorsport") {
  const now = icsStamp(Date.now());
  const L = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Muntrume Motorsport//Calendario del equipo//ES", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", `X-WR-CALNAME:${icsEsc(name)}`];
  for (const ev of events) {
    L.push("BEGIN:VEVENT", `UID:event-${ev.id}@muntru.me`, `DTSTAMP:${now}`, `DTSTART:${icsStamp(ev.starts_at)}`, `DTEND:${icsStamp(ev.ends_at || eventEnd(ev))}`,
      `SUMMARY:${icsEsc(ev.title)}`, `LOCATION:${icsEsc([ev.track, "iRacing"].filter(Boolean).join(" · "))}`,
      ...(ev.car_class || ev.notes ? [`DESCRIPTION:${icsEsc([ev.car_class, ev.notes].filter(Boolean).join("\n"))}`] : []),
      `URL:${ev.url || SITE + "/"}`, "STATUS:CONFIRMED", "TRANSP:OPAQUE", "END:VEVENT");
  }
  L.push("END:VCALENDAR");
  return L.map(icsFold).join("\r\n") + "\r\n";
}
function icsAttachment(events) {
  const bytes = enc.encode(buildIcs(events));
  let bin = ""; for (const b of bytes) bin += String.fromCharCode(b);
  return { filename: events.length === 1 ? "evento-muntrume.ics" : "eventos-muntrume.ics", content: btoa(bin), content_type: "text/calendar; charset=utf-8; method=PUBLISH" };
}
/** GET públicos: /api/events (JSON próximos), /api/events.ics (feed), /api/events/<id>.ics */
async function handlePublicEvents(url, env) {
  const path = url.pathname.replace(/\/+$/, "");
  const cors = { "Access-Control-Allow-Origin": "*", "Cache-Control": "public, max-age=300", "X-Content-Type-Options": "nosniff" };
  if (path === "/api/events") return new Response(JSON.stringify({ success: true, events: await upcomingEvents(env, 20) }), { headers: { ...cors, "Content-Type": "application/json; charset=utf-8" } });
  if (path === "/api/events.ics") {
    return new Response(buildIcs(await upcomingEvents(env, 50)), { headers: { ...cors, "Content-Type": "text/calendar; charset=utf-8", "Content-Disposition": 'inline; filename="muntrume.ics"' } });
  }
  const m = path.match(/^\/api\/events\/(\d{1,9})\.ics$/);
  if (m) {
    const row = await env.muntrume_vault.prepare(`SELECT ${EVENT_COLS} FROM team_events WHERE id = ?`).bind(Number(m[1])).first();
    if (!row) return new Response("Evento no encontrado", { status: 404, headers: { ...cors, "Content-Type": "text/plain; charset=utf-8" } });
    return new Response(buildIcs([eventView(row)]), { headers: { ...cors, "Content-Type": "text/calendar; charset=utf-8", "Content-Disposition": `attachment; filename="evento-muntrume-${row.id}.ics"` } });
  }
  return new Response("Not found", { status: 404, headers: cors });
}
/** Admin: listar / guardar / borrar eventos (con auditoría). Las fechas las introduce un admin; no se generan. */
async function handleAdminEvents(request, body, env) {
  const s = await adminSession(request, body, env); if (s.err) return s.err;
  const db = env.muntrume_vault;
  const admin = s.user?.email || s.email;
  if (body.op === "delete") {
    const id = Number(body.id);
    const row = await db.prepare("SELECT id, title, starts_at FROM team_events WHERE id = ?").bind(id).first();
    if (!row) return [404, { success: false, error: "Evento no encontrado." }];
    await db.prepare("DELETE FROM team_events WHERE id = ?").bind(id).run();
    await audit(env, admin, "event.delete", null, `#${id} ${row.title} @ ${row.starts_at}`);
  } else if (body.op === "save") {
    const title = clean(body.title, 120);
    if (!title) return [400, { success: false, error: "Falta el título." }];
    const st = new Date(String(body.starts_at || ""));
    if (isNaN(st) || !/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(String(body.starts_at))) return [400, { success: false, error: "Fecha de inicio no válida." }];
    if (st.getTime() < Date.now() - 365 * 864e5 || st.getTime() > Date.now() + 3 * 365 * 864e5) return [400, { success: false, error: "La fecha está fuera de rango." }];
    let en = null;
    if (body.ends_at) { const e = new Date(String(body.ends_at)); if (isNaN(e) || e <= st || e - st > 72 * 3600e3) return [400, { success: false, error: "La fecha de fin no es válida." }]; en = isoUtc(e); }
    const link = clean(body.url, 300);
    if (link && !/^https:\/\/[^\s<>"]+$/i.test(link)) return [400, { success: false, error: "El enlace debe empezar por https://" }];
    const vals = [title, isoUtc(st), en, clean(body.track, 80) || null, clean(body.car_class, 60) || null, link || null, clean(body.notes, 400) || null];
    let id = Number(body.id) || 0;
    if (id) {
      const r = await db.prepare("UPDATE team_events SET title=?1, starts_at=?2, ends_at=?3, track=?4, car_class=?5, url=?6, notes=?7, updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?8").bind(...vals, id).run();
      if (!r.meta?.changes) return [404, { success: false, error: "Evento no encontrado." }];
    } else {
      const r = await db.prepare("INSERT INTO team_events (title, starts_at, ends_at, track, car_class, url, notes, created_by) VALUES (?1,?2,?3,?4,?5,?6,?7,?8)").bind(...vals, normEmail(admin)).run();
      id = r.meta?.last_row_id;
    }
    await audit(env, admin, "event.save", null, `#${id} ${title} @ ${vals[1]}`);
  }
  const r = await db.prepare(`SELECT ${EVENT_COLS} FROM team_events WHERE starts_at >= ? ORDER BY starts_at ASC LIMIT 100`).bind(isoUtc(Date.now() - 90 * 864e5)).all();
  return [200, { success: true, events: (r.results || []).map(eventView) }];
}

/** RFC 8058: POST de un clic desde el cliente de correo (sin cookies ni Origin). */
async function handleOneClickUnsubscribe(url, env) {
  const email = await prefsVerify(env, url.searchParams.get("u"), url.searchParams.get("t"));
  if (!email) return [400, { success: false, error: "Enlace no válido." }];
  const l = url.searchParams.get("l");
  const p = await getPrefs(env, email);
  if (l === "all") { p.new_setups = false; p.team_news = false; }
  else if (PREF_LISTS.includes(l)) p[l] = false;
  else return [400, { success: false, error: "Lista no válida." }];
  await savePrefs(env, email, p);
  console.log("[prefs] baja one-click", l);
  return [200, { success: true }];
}

/** Página de preferencias: leer / guardar con el enlace firmado. */
async function handleEmailPrefs(body, env, ip) {
  if (await rateLimited(`prefs:${ip}`, 30, 600)) return [429, { success: false, error: "Demasiadas peticiones. Inténtalo en unos minutos." }];
  const email = await prefsVerify(env, body.u, body.t);
  if (!email) return [403, { success: false, error: "El enlace no es válido o ha caducado. Usa el último correo que te enviamos." }];
  const user = await getUser(env, email);
  const p = await getPrefs(env, email);
  if (body.set && typeof body.set === "object") {
    for (const k of PREF_LISTS) if (k in body.set) p[k] = !!body.set[k];
    if ("tz" in body.set) { const v = validTz(body.set.tz); if (v || body.set.tz === null) p.tz = v; }
    await savePrefs(env, email, p);
  }
  const [local, domain] = email.split("@");
  return [200, { success: true, email_masked: `${local.slice(0, 2)}${"•".repeat(Math.max(1, Math.min(6, local.length - 2)))}@${domain}`,
    name: user ? String(user.name || "").split(/\s+/)[0] : null, prefs: { new_setups: p.new_setups, team_news: p.team_news, tz: p.tz }, saved: !!body.set }];
}

// ───────────────────────────── Race Control: gestión de usuarios ─────────────────────────────

async function audit(env, admin, action, target, detail) {
  try {
    await env.muntrume_vault.prepare("INSERT INTO admin_audit (admin_email, action, target, detail) VALUES (?, ?, ?, ?)")
      .bind(normEmail(admin), action, target ? normEmail(target).slice(0, 254) : null, detail ? String(detail).slice(0, 500) : null).run();
  } catch (e) { console.warn("[audit]", e?.message); }
}

async function adminTarget(env, s, email, { notSelf } = {}) {
  const user = await getUser(env, email);
  if (!user) return { error: [404, { success: false, error: "Usuario no encontrado." }] };
  if (notSelf && normEmail(user.email) === normEmail(s.user.email)) return { error: [400, { success: false, error: "No puedes hacer esto sobre tu propia cuenta." }] };
  return { user };
}

async function adminSession(request, body, env) {
  const s = await requireSession(request, body, env, { admin: true });
  return s.error ? { err: [s.status, { success: false, error: s.error, code: s.code }] } : s;
}

async function handleAdminUserUpdate(request, body, env) {
  const s = await adminSession(request, body, env); if (s.err) return s.err;
  const t = await adminTarget(env, s, body.email);
  if (t.error) return t.error;
  const name = clean(body.name, 80) || t.user.name;
  const team = clean(body.team, 80) || null;
  const carClass = clean(body.car_class, 80) || null;
  const role = body.role === "admin" ? "admin" : body.role === "driver" ? "driver" : t.user.role;
  if (normEmail(t.user.email) === normEmail(s.user.email) && role !== "admin") return [400, { success: false, error: "No puedes quitarte el rol de admin." }];
  const roleChanged = role !== t.user.role;
  await env.muntrume_vault.prepare(
    `UPDATE allowed_users SET name = ?, team = ?, car_class = ?, role = ?${roleChanged ? ", session_version = session_version + 1" : ""} WHERE id = ?`
  ).bind(name, team, carClass, role, t.user.id).run();
  await audit(env, s.user.email, roleChanged ? "user.role_change" : "user.update", t.user.email, JSON.stringify({ name, team, car_class: carClass, role }));
  return [200, { success: true }];
}

async function handleAdminUserDelete(request, body, env) {
  const s = await adminSession(request, body, env); if (s.err) return s.err;
  const t = await adminTarget(env, s, body.email, { notSelf: true });
  if (t.error) return t.error;
  if (normEmail(body.confirm) !== normEmail(t.user.email)) return [400, { success: false, error: "Escribe el correo del usuario para confirmar el borrado." }];
  const db = env.muntrume_vault;
  await db.batch([
    db.prepare("DELETE FROM allowed_users WHERE id = ?").bind(t.user.id),
    db.prepare("DELETE FROM login_codes WHERE email = ?").bind(normEmail(t.user.email)),
  ]);
  await audit(env, s.user.email, "user.delete", t.user.email, null);
  return [200, { success: true }];
}

async function handleAdminRevokeSessions(request, body, env) {
  const s = await adminSession(request, body, env); if (s.err) return s.err;
  const t = await adminTarget(env, s, body.email);
  if (t.error) return t.error;
  await env.muntrume_vault.prepare("UPDATE allowed_users SET session_version = session_version + 1 WHERE id = ?").bind(t.user.id).run();
  await audit(env, s.user.email, "user.revoke_sessions", t.user.email, null);
  return [200, { success: true, self: normEmail(t.user.email) === normEmail(s.user.email) }];
}

async function handleAdminUserPhoto(request, body, env) {
  const s = await adminSession(request, body, env); if (s.err) return s.err;
  const t = await adminTarget(env, s, body.email);
  if (t.error) return t.error;
  let photo = null;
  if (body.photo) {
    photo = String(body.photo);
    if (!/^data:image\/(webp|jpeg|png);base64,[A-Za-z0-9+/=]+$/.test(photo)) return [400, { success: false, error: "Formato de imagen no válido." }];
    if (photo.length > PHOTO_MAX_CHARS) return [413, { success: false, error: "La foto es demasiado grande (máx. ~65 KB tras comprimir)." }];
  }
  await env.muntrume_vault.prepare("UPDATE allowed_users SET photo = ? WHERE id = ?").bind(photo, t.user.id).run();
  await audit(env, s.user.email, photo ? "user.photo_set" : "user.photo_remove", t.user.email, photo ? `${photo.length} chars` : null);
  return [200, { success: true }];
}

async function handleAdminUserDetail(request, body, env) {
  const s = await adminSession(request, body, env); if (s.err) return s.err;
  const email = normEmail(body.email);
  const db = env.muntrume_vault;
  const [dl, au] = await Promise.all([
    db.prepare("SELECT at, kind, ref, files FROM download_log WHERE email = ? ORDER BY at DESC LIMIT 50").bind(email).all(),
    db.prepare("SELECT at, admin_email, action, detail FROM admin_audit WHERE target = ? ORDER BY at DESC LIMIT 30").bind(email).all(),
  ]);
  return [200, { success: true, downloads: dl.results || [], audit: au.results || [] }];
}

async function handleAdminAudit(request, body, env) {
  const s = await adminSession(request, body, env); if (s.err) return s.err;
  const { results } = await env.muntrume_vault.prepare("SELECT at, admin_email, action, target, detail FROM admin_audit ORDER BY at DESC LIMIT 200").all();
  return [200, { success: true, audit: results || [] }];
}

async function handleAdminStats(request, body, env) {
  const s = await adminSession(request, body, env); if (s.err) return s.err;
  const db = env.muntrume_vault;
  const [tot, bySeason, files, dl7, topCars, users] = await Promise.all([
    db.prepare("SELECT count(*) n, count(DISTINCT car) cars, count(DISTINCT circuit) circuits, coalesce(sum(size_bytes),0) bytes FROM setups").first(),
    db.prepare("SELECT season, count(*) n FROM setups GROUP BY season ORDER BY season DESC").all(),
    db.prepare("SELECT count(*) n, count(DISTINCT car) cars FROM setup_files").first(),
    db.prepare("SELECT count(*) events, coalesce(sum(files),0) files, count(DISTINCT email) users FROM download_log WHERE at >= strftime('%Y-%m-%dT%H:%M:%fZ','now','-7 days')").first(),
    db.prepare("SELECT car, count(*) n FROM setups GROUP BY car ORDER BY n DESC LIMIT 8").all(),
    db.prepare("SELECT count(*) total, sum(status='active') active, sum(role='admin') admins, sum(last_login_at >= strftime('%Y-%m-%dT%H:%M:%fZ','now','-30 days')) active30 FROM allowed_users").first(),
  ]);
  return [200, { success: true, setups: tot, by_season: bySeason.results || [], car_files: files, downloads_7d: dl7, top_cars: topCars.results || [], users }];
}

// Registro de descargas (quién, cuándo, qué) + límite por piloto y hora.
async function downloadGuard(env, user) {
  const r = await env.muntrume_vault.prepare(
    "SELECT coalesce(sum(files),0) n FROM download_log WHERE email = ? AND at >= strftime('%Y-%m-%dT%H:%M:%fZ','now','-1 hour')"
  ).bind(normEmail(user.email)).first();
  return (r?.n || 0) >= DOWNLOADS_PER_HOUR;
}
function logDownload(env, ctx, user, kind, ref, files, ip) {
  const job = (async () => {
    const ipHash = (await hmacHex(env.JWT_SECRET, `dl-ip:${ip}`)).slice(0, 24);
    await env.muntrume_vault.prepare("INSERT INTO download_log (email, kind, ref, files, ip_hash) VALUES (?, ?, ?, ?, ?)")
      .bind(normEmail(user.email), kind, String(ref || "").slice(0, 300), files, ipHash).run();
  })().catch((e) => console.warn("[dl-log]", e?.message));
  if (ctx && ctx.waitUntil) ctx.waitUntil(job);
}
const DL_LIMIT = [429, { success: false, error: "Has alcanzado el límite de descargas por hora. Inténtalo más tarde." }];

// ───────────────────────────── Garage 61 ─────────────────────────────


const normAlnum = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");

async function g61Get(path, token, params) {
  const u = new URL(`https://garage61.net/api/v1${path}`);
  for (const [k, v] of Object.entries(params || {})) {
    if (Array.isArray(v)) v.forEach((x) => u.searchParams.append(k, String(x)));
    else if (v !== undefined && v !== null) u.searchParams.set(k, String(v));
  }
  const res = await fetch(u.toString(), {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json", "User-Agent": "muntru.me" },
  });
  if (!res.ok) {
    const err = new Error(`G61 ${res.status}`);
    err.status = res.status;
    throw err;
  }
  const data = await res.json();
  return Array.isArray(data) ? data : data.items || data.data || [];
}

async function handleG61Laps(request, body, env) {
  const s = await requireSession(request, body, env);
  if (s.error) return [s.status, { success: false, error: s.error, code: s.code }];

  const userToken = clean(request.headers.get("X-G61-Token") || body.g61_token, 300);
  const token = userToken || env.GARAGE61_API_TOKEN || "";
  if (!token) return [200, { success: true, status: "no_token", laps: [], message: "Garage 61 todavía no está conectado." }];

  const carLabel = clean(body.car_label, 120);
  const circuit = clean(body.circuit, 120);
  if (!carLabel || !circuit) return [400, { success: false, error: "Faltan coche o circuito." }];

  try {
    const [cars, tracks] = await Promise.all([g61Get("/cars", token), g61Get("/tracks", token)]);
    const carKey = normAlnum(carLabel);
    const car =
      cars.find((c) => normAlnum(c.name) === carKey) ||
      cars.find((c) => carKey.length >= 6 && (normAlnum(c.name).includes(carKey) || carKey.includes(normAlnum(c.name))));
    const trackKey = normAlnum(circuit);
    const trackMatches = trackKey.length >= 3 ? tracks.filter((t) => normAlnum(t.name).includes(trackKey)) : [];
    if (!car || trackMatches.length === 0) {
      return [200, { success: true, status: "no_match", laps: [], message: "No se ha encontrado este coche o circuito en Garage 61." }];
    }
    const trackIds = trackMatches.slice(0, 10).map((t) => t.id);
    const laps = await g61Get("/laps", token, { cars: [car.id], tracks: trackIds, group: "driver", lapTypes: 1, limit: 15 });
    const rows = laps
      .filter((l) => typeof l.lapTime === "number" && l.lapTime > 0)
      .sort((a, b) => a.lapTime - b.lapTime)
      .map((l) => ({
        driver: [l.driver?.firstName, l.driver?.lastName].filter(Boolean).join(" ") || l.driver?.slug || null,
        lap_time_sec: l.lapTime,
        start_time: l.startTime || null,
        clean: typeof l.clean === "boolean" ? l.clean : null,
        track: l.track?.name || null,
        track_temp: typeof l.trackTemp === "number" ? l.trackTemp : null,
        air_temp: typeof l.airTemp === "number" ? l.airTemp : null,
        session_type: l.sessionType ?? null,
        link: l.track?.id && l.car?.id ? `https://garage61.net/app/laps/${l.track.id}/${l.car.id}` : null,
      }));
    return [200, {
      success: true,
      status: rows.length ? "ok" : "empty",
      source: userToken ? "user_token" : "team_token",
      car: { id: car.id, name: car.name },
      tracks: trackMatches.slice(0, 10).map((t) => ({ id: t.id, name: t.name })),
      laps: rows,
      fetched_at: new Date().toISOString(),
    }];
  } catch (e) {
    const status = e.status === 401 || e.status === 403 ? "invalid_token" : "error";
    console.warn("[g61]", e.message);
    return [200, { success: false, status, laps: [], error: status === "invalid_token" ? "El token de Garage 61 no es válido o no tiene permisos." : "Garage 61 no responde ahora mismo." }];
  }
}

// ───────────────────────────── catálogo / descargas ─────────────────────────────

const STATIC_CARS = ["acuraarx06gtp","acuransxevo22gt3","amvalkyriegtp","amvantageevogt3","amvantagegt4","astonmartin dbr9","audi90gto","audir8lmsevo2gt3","audirs3lmsgen2","bmwlmdh","bmwm2csr","bmwm2g87","bmwm4evogt4","bmwm4gt3","bmwm4gt4","bmwm8gte","c6r","c8rvettegte","cadillacvseriesrgtp","caterham caterham420r","caterham caterhamacademy","chevyvettez06rgt3","dallaraf3","dallarair18","dallarap217","ferrari296gt3","ferrari488gte","ferrari499p","fordgt","fordgt2017","fordmustanggt3","fordmustanggt4","formulair04","formulavee","formulavee formulavee2","formulavee formulavee3","hondacivictyper","hpdarx01c","hyundaielantracn7","hyundaivelostern","lamborghinievogt3","ligierjsp320","mclaren570sgt4","mclaren720sgt3","mercedesamgevogt3","mercedesamggt4","mercedesw13","ministock","mx5 cup","mx5 mx52016","nissangtpzxt","porsche718gt4","porsche963gtp","porsche991rsr","porsche9922cup","porsche992rgt3","raygr22","renaultcliocup","specracer","stockcars2 mustang2019","supercars fordmustanggen3","superformulalights324","superformulasf23 honda","superformulasf23 toyota","toyotagr86","trucks silverado","trucks toyotatundra2022"];
const STATIC_SEASONS = ["26S4","26S3","26S2","26S1"];
const STATIC_WEEKS = ["Otros Circuitos","Special Event - Algarve 1000","Special Event - Britcar 24","Special Event - Le Mans 24","Special Event - Majors 24","Special Event - NEC","Special Event - Petit Le Mans","Special Event - Road America 6H","Special Event - Sebring 12","Special Event - Spa 24","Special Event - Watkins 6H","W01","W02","W03","W04","W05","W06","W07","W08","W09","W10","W11","W12","W13"];
const STATIC_CIRCUITS = ["Algarve","Barcelona","Bathurst","Canadian Tire","Charlotte","Daytona","Donington","Fuji","General","Hockenheim","Hungaroring","Imola","Indianapolis","Interlagos","Jerez","Knockhill","Laguna Seca","Le Mans","Lime Rock","Long Beach","Magny-Cours","Miami","Mid-Ohio","Misano","Montreal","Monza","Motegi","Mugello","Navarra","Nurburgring","Okayama","Oschersleben","Oulton Park","Phillip Island","Red Bull Ring","Road America","Road Atlanta","Rudskogen","Sebring","Silverstone","Snetterton","Sonoma","Spa","St. Petersburg","Suzuka","The Bend","Tsukuba","Virginia","Watkins Glen","Winton","Zandvoort"];

function setupFilters(body, cols) {
  const conds = [];
  const params = [];
  for (const [field, col] of cols) {
    const v = body[field];
    if (v && v !== "All") {
      conds.push(`${col} = ?`);
      params.push(String(v).slice(0, 120));
    }
  }
  return { where: conds.length ? ` WHERE ${conds.join(" AND ")}` : "", params };
}

async function handleCatalog(request, body, env) {
  const s = await requireSession(request, body, env);
  if (s.error) return [s.status, { success: false, error: s.error, code: s.code }];
  const { where, params } = setupFilters(body, [["car", "car"], ["season", "season"], ["week", "week"], ["circuit", "circuit"], ["type", "setup_type"]]);
  const stmt = env.muntrume_vault.prepare(
    `SELECT id, car, season, week, circuit, filename, setup_type, size_bytes FROM setups${where} ORDER BY car, season DESC, week, circuit, filename LIMIT 1000`
  );
  const { results } = await (params.length ? stmt.bind(...params) : stmt).all();
  return [200, {
    success: true,
    user: { email: s.user.email, name: s.user.name, role: s.user.role },
    cars: STATIC_CARS, seasons: STATIC_SEASONS, weeks: STATIC_WEEKS, circuits: STATIC_CIRCUITS,
    setups: results || [],
  }];
}

async function handleDownload(request, body, env, ctx, ip) {
  const s = await requireSession(request, body, env);
  if (s.error) return [s.status, { success: false, error: s.error, code: s.code }];
  if (await downloadGuard(env, s.user)) return DL_LIMIT;
  if (!body.id) return [400, { success: false, error: "ID de setup no especificado." }];
  const setup = await env.muntrume_vault
    .prepare("SELECT filename, car, season, week, circuit, content_base64 FROM setups WHERE id = ?")
    .bind(body.id)
    .first();
  if (!setup?.content_base64) return [404, { success: false, error: "Setup no encontrado en el vault." }];
  logDownload(env, ctx, s.user, "setup", `${setup.car}/${setup.season}/${setup.filename}`, 1, ip);
  return [200, { success: true, ...setup }];
}

async function handleDownloadBatch(request, body, env, ctx, ip) {
  const s = await requireSession(request, body, env);
  if (s.error) return [s.status, { success: false, error: s.error, code: s.code }];
  if (await downloadGuard(env, s.user)) return DL_LIMIT;
  const cols = "id, filename, car, season, week, circuit, setup_type, size_bytes, content_base64";
  let setups = [];
  if (Array.isArray(body.ids) && body.ids.length) {
    const ids = body.ids.slice(0, 100);
    const { results } = await env.muntrume_vault
      .prepare(`SELECT ${cols} FROM setups WHERE id IN (${ids.map(() => "?").join(",")})`)
      .bind(...ids)
      .all();
    setups = results || [];
  } else if (body.circuit || body.car) {
    const { where, params } = setupFilters(body, [["car", "car"], ["season", "season"], ["week", "week"], ["circuit", "circuit"]]);
    const { results } = await env.muntrume_vault
      .prepare(`SELECT ${cols} FROM setups${where} ORDER BY car, season DESC, week, circuit, filename LIMIT 100`)
      .bind(...params)
      .all();
    setups = results || [];
  }
  if (setups.length) logDownload(env, ctx, s.user, "batch", setups.length === 1 ? setups[0].filename : `${setups[0].car} · ${setups[0].circuit || ""} (${setups.length})`, setups.length, ip);
  return [200, { success: true, count: setups.length, setups }];
}

// Archivos .sto privados (tabla setup_files): solo pilotos con sesión. Sustituye a los
// antiguos assets/data/cars/<coche>.json públicos de GitHub Pages.
const CAR_SLUG_RE = /^[a-z0-9_-]{1,64}$/;
async function handleCarFiles(request, body, env, ctx, ip) {
  const s = await requireSession(request, body, env);
  if (s.error) return [s.status, { success: false, error: s.error, code: s.code }];
  if (await downloadGuard(env, s.user)) return DL_LIMIT;
  const car = String(body.car || "").trim().toLowerCase().replace(/[^a-z0-9_-]/g, "_");
  if (!CAR_SLUG_RE.test(car)) return [400, { success: false, error: "Coche no válido." }];
  const { results } = await env.muntrume_vault
    .prepare("SELECT filename, content_base64 FROM setup_files WHERE car = ?")
    .bind(car)
    .all();
  const files = {};
  for (const r of results || []) files[r.filename] = r.content_base64;
  if (results?.length) logDownload(env, ctx, s.user, "car_files", car, results.length, ip);
  return [200, { success: true, car, count: Object.keys(files).length, files }];
}

// ───────────────────────────── IA y contacto ─────────────────────────────

async function handleAI(body, env, ip) {
  if (!env.GROQ_API_KEY) return [503, { error: "Asistente IA no disponible." }];
  if (await rateLimited(`ai:${ip}`, 30, 600)) return [429, { error: "Demasiadas preguntas seguidas. Espera un momento." }];
  const systemPrompt =
    body.mode === "ai_setup"
      ? "You are an expert iRacing telemetry race engineer for Muntrume Motorsport. Provide concise, expert setup advice."
      : "You are the official AI assistant of Muntrume Motorsport simracing team founded in Sant Andreu, Barcelona. Never state or invent team statistics (iRating, wins, podiums, races, rankings or results): the team does not publish verified figures, so say they are not published.";
  const userPrompt = String(body.prompt || body.message || body.question || "Hello").slice(0, 4000);
  let lastStatus = 502;
  for (const model of ["openai/gpt-oss-20b", "openai/gpt-oss-120b"]) {
    const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.GROQ_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
        temperature: 0.7,
        max_tokens: 600 + 512,
        reasoning_format: "hidden",
        reasoning_effort: "low",
      }),
    });
    if (!r.ok) {
      lastStatus = r.status;
      console.warn(`[ai] ${model} ${r.status}`);
      continue;
    }
    const data = await r.json();
    const reply = data.choices?.[0]?.message?.content || "";
    if (reply) return [200, { answer: reply, result: reply }];
  }
  return [lastStatus >= 500 ? 502 : lastStatus, { error: "AI service unavailable" }];
}

// Formulario de contacto (/api/contact). Antispam: honeypot, token firmado con tiempo mínimo
// de envío, RATE_LIMITER por IP + límites por IP/hora y globales en D1, sin HTML ni saltos de
// línea en cabeceras. Solo devuelve success cuando Resend acepta el correo.
const CONTACT_TYPES = {
  driver_application: "Driver tryout",
  sponsorship: "Sponsorship",
  media: "Media / press",
  telemetry_engineering: "Setup & engineering",
  general: "General",
};
const CONTACT_MIN_MS = 4000;
const CONTACT_TOKEN_TTL_MS = 6 * 3600 * 1000;
const CONTACT_PER_IP_HOUR = 5;
const CONTACT_GLOBAL_HOUR = 30;

function contactTo(env) {
  return normEmail(env.CONTACT_TO_EMAIL || "info@muntru.me");
}
function oneLine(v, max) {
  return clean(String(v ?? "").replace(/<[^>]*>/g, " ").replace(/[\r\n\t\u2028\u2029]+/g, " ").replace(/\s{2,}/g, " "), max);
}
function multiLine(v, max) {
  return clean(String(v ?? "").replace(/\r\n?/g, "\n").replace(/<[^>]*>/g, "").replace(/\n{4,}/g, "\n\n\n"), max);
}

async function handleContactToken(env) {
  if (!env.JWT_SECRET) return [503, { success: false, error: "Contact form temporarily unavailable." }];
  const now = Date.now();
  const token = await signToken({ typ: "contact", iat: now, exp: now + CONTACT_TOKEN_TTL_MS, n: b64urlFromBytes(crypto.getRandomValues(new Uint8Array(8))) }, env.JWT_SECRET);
  return [200, { success: true, token, minMs: CONTACT_MIN_MS }];
}


function escMail(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

async function handleMailSend(body, env, ip) {
  const fail = (status, error) => [status, { success: false, error }];
  if (await rateLimited(`mailsend:${ip}`, 30, 3600)) {
    return fail(429, "Límite de envíos alcanzado (30 correos/hora). Inténtalo más tarde.");
  }

  const to = String(body.to || "").trim();
  const subject = String(body.subject || "").trim();
  const content = String(body.body || body.content || body.text || "").trim();
  const fromRaw = String(body.from || "alberto.muntrume@trujillomingorance.com").trim().toLowerCase();

  if (!to || !EMAIL_RE.test(to)) {
    return fail(400, "Destinatario no válido.");
  }
  if (!subject) {
    return fail(400, "El asunto del correo no puede estar vacío.");
  }
  if (!content) {
    return fail(400, "El contenido del mensaje no puede estar vacío.");
  }

  // Friendly sender identity (Esports Simracing Team)
  let senderEmail = "alberto.muntrume@trujillomingorance.com";
  let friendlyName = "Alberto de Muntrume";
  let pilotInitials = "AT";

  if (fromRaw.includes("mateo")) {
    senderEmail = "mateo.muntrume@trujillomingorance.com";
    friendlyName = "Mateo de Muntrume";
    pilotInitials = "MB";
  } else if (fromRaw.includes("eduardo")) {
    senderEmail = "eduardo.muntrume@trujillomingorance.com";
    friendlyName = "Eduardo de Muntrume";
    pilotInitials = "EC";
  } else if (fromRaw.includes("juanlu")) {
    senderEmail = "juanlu.muntrume@trujillomingorance.com";
    friendlyName = "Juanlu de Muntrume";
    pilotInitials = "JC";
  } else if (fromRaw.includes("admin")) {
    senderEmail = "admin.muntrume@trujillomingorance.com";
    friendlyName = "Race Control";
    pilotInitials = "RC";
  } else if (body.fromName && !body.fromName.includes("· Muntrume Motorsport") && !body.fromName.includes("ALBERTO")) {
    friendlyName = String(body.fromName).trim();
    pilotInitials = friendlyName.substring(0, 2).toUpperCase();
  }

  const formattedSender = `${friendlyName} <${senderEmail}>`;
  const replyTo = senderEmail;

  // Modern Esports Simracing Email Template (Friendly & Clean)
  const html = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${escMail(subject)}</title>
    </head>
    <body style="margin:0;padding:0;background-color:#0b0e14;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#f1f5f9;-webkit-font-smoothing:antialiased;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#0b0e14;padding:32px 12px;">
        <tr>
          <td align="center">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;background-color:#131722;border:1px solid rgba(255,255,255,0.08);border-radius:20px;overflow:hidden;box-shadow:0 20px 40px rgba(0,0,0,0.6);">
              
              <!-- Racing Green Accent Line -->
              <tr>
                <td style="height:3px;background:linear-gradient(90deg,#10b981 0%,#34d399 50%,#059669 100%);"></td>
              </tr>

              <!-- Header Bar -->
              <tr>
                <td style="padding:20px 28px;background-color:#0e121a;border-bottom:1px solid rgba(255,255,255,0.06);">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td align="left" style="vertical-align:middle;">
                        <span style="font-size:16px;font-weight:900;letter-spacing:-0.3px;color:#ffffff;display:inline-block;vertical-align:middle;">🏎️ MUNTRUME</span>
                        <span style="color:#10b981;font-weight:800;font-size:11px;margin-left:8px;padding:3px 8px;background:rgba(16,185,129,0.12);border-radius:6px;letter-spacing:0.5px;text-transform:uppercase;vertical-align:middle;display:inline-block;">Simracing Team</span>
                      </td>
                      <td align="right" style="vertical-align:middle;">
                        <span style="font-size:11px;color:#94a3b8;font-family:monospace;">iRacing &bull; GT3</span>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Sender Info & Subject -->
              <tr>
                <td style="padding:28px 28px 12px 28px;">
                  <table role="presentation" cellpadding="0" cellspacing="0" style="margin-bottom:16px;">
                    <tr>
                      <td width="36" style="vertical-align:middle;">
                        <div style="width:34px;height:34px;background-color:rgba(16,185,129,0.15);border:1px solid rgba(16,185,129,0.3);border-radius:10px;color:#34d399;font-weight:800;font-size:12px;text-align:center;line-height:34px;font-family:monospace;">
                          ${pilotInitials}
                        </div>
                      </td>
                      <td style="vertical-align:middle;padding-left:10px;">
                        <div style="font-size:14px;font-weight:700;color:#ffffff;">${escMail(friendlyName)}</div>
                        <div style="font-size:11px;color:#10b981;font-family:monospace;">${escMail(senderEmail)}</div>
                      </td>
                    </tr>
                  </table>

                  <h1 style="margin:0 0 16px 0;font-size:20px;font-weight:800;color:#ffffff;line-height:1.35;letter-spacing:-0.2px;">${escMail(subject)}</h1>
                </td>
              </tr>

              <!-- Message Body -->
              <tr>
                <td style="padding:0 28px 24px 28px;">
                  <div style="background-color:#181e2b;border:1px solid rgba(255,255,255,0.06);border-radius:14px;padding:22px;font-size:14px;line-height:1.75;color:#e2e8f0;white-space:pre-line;">${escMail(content)}</div>
                </td>
              </tr>

              <!-- Quick Team Links -->
              <tr>
                <td style="padding:0 28px 24px 28px;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td align="left">
                        <a href="https://muntru.me/setups" target="_blank" style="display:inline-block;padding:10px 20px;background-color:#10b981;color:#0b0e14;font-weight:800;font-size:12px;text-decoration:none;border-radius:10px;margin-right:8px;">
                          Setup Vault &rarr;
                        </a>
                        <a href="https://discord.gg/ehX6B8JUtE" target="_blank" style="display:inline-block;padding:10px 18px;background-color:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);color:#e2e8f0;font-weight:600;font-size:12px;text-decoration:none;border-radius:10px;">
                          Discord
                        </a>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Clean Esports Footer -->
              <tr>
                <td style="padding:20px 28px;background-color:#0e121a;border-top:1px solid rgba(255,255,255,0.06);font-size:11px;color:#64748b;line-height:1.5;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td>
                        <span style="color:#94a3b8;font-weight:600;">Muntrume Motorsport</span> &middot; Simracing Team
                      </td>
                      <td align="right">
                        <a href="https://muntru.me" style="color:#10b981;text-decoration:none;font-weight:700;">muntru.me</a>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  // Despacho primario: Resend (@trujillomingorance.com verificado)
  if (env.RESEND_API_KEY) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: formattedSender,
          to: [to],
          reply_to: replyTo,
          subject: subject,
          text: content,
          html: html,
        }),
      });

      const resData = await res.json().catch(() => ({}));
      if (res.ok && resData.id) {
        return [200, {
          success: true,
          id: resData.id,
          from: formattedSender,
          to: to,
          provider: "Resend Verified Relay (trujillomingorance.com)"
        }];
      } else {
        console.warn("[mail-resend-warn]", res.status, resData);
      }
    } catch (err) {
      console.error("[mail-resend-err]", err);
    }
  }

  return fail(502, "No se pudo despachar el correo a través del relay.");
}

async function handleContact(body, env, ip) {
  const fail = (status, error, extra = {}) => [status, { success: false, error, ...extra }];
  // Honeypot: los bots rellenan el campo oculto; respondemos como si nada sin enviar.
  if (clean(body.website, 200) || clean(body.company_url, 200)) return [200, { success: true, ignored: true }];

  const name = oneLine(body.name, 100);
  const email = normEmail(oneLine(body.email, 254));
  const typeKey = Object.prototype.hasOwnProperty.call(CONTACT_TYPES, body.type) ? body.type : "general";
  const subject = oneLine(body.subject, 150);
  const message = multiLine(body.message, 5000);

  if (name.length < 2) return fail(400, "Please enter your name.", { field: "name" });
  if (!EMAIL_RE.test(email) || email.length > 254) return fail(400, "Please enter a valid email address.", { field: "email" });
  if (subject.length < 3) return fail(400, "Please add a short subject (3+ characters).", { field: "subject" });
  if (message.length < 20) return fail(400, "Your message is too short (20+ characters).", { field: "message" });
  if (String(body.message || "").length > 5000) return fail(400, "Your message is too long (max 5000 characters).", { field: "message" });
  if ((message.match(/https?:\/\//gi) || []).length > 3) return fail(400, "Please include at most 3 links.", { field: "message" });

  const tok = await verifyToken(body.token, env.JWT_SECRET || "", "contact");
  if (!tok) return fail(400, "The form expired. Please reload the page and try again.", { reload: true });
  if (Date.now() - tok.iat < CONTACT_MIN_MS) return fail(400, "That was quick! Please wait a few seconds and send again.");

  if (await rateLimited(`contact:${ip}`, CONTACT_PER_IP_HOUR, 3600)) return fail(429, "Too many messages in a short time. Please try again later.");

  const db = env.muntrume_vault;
  const ipHash = (await sha256Hex(`contact-ip:${ip}:${(env.JWT_SECRET || "").slice(0, 8)}`)).slice(0, 32);
  let rowId = null;
  if (db) {
    try {
      const c = await db.prepare(
        "SELECT SUM(CASE WHEN ip_hash = ?1 THEN 1 ELSE 0 END) AS mine, COUNT(*) AS total FROM contact_messages WHERE created_at > strftime('%Y-%m-%dT%H:%M:%fZ','now','-1 hour')"
      ).bind(ipHash).first();
      if ((c?.mine || 0) >= CONTACT_PER_IP_HOUR) return fail(429, "Too many messages in a short time. Please try again later.");
      if ((c?.total || 0) >= CONTACT_GLOBAL_HOUR) return fail(503, "The contact form is busy right now. Please email us directly.");
      const ins = await db.prepare(
        "INSERT INTO contact_messages (name, email, type, subject, message, ip_hash) VALUES (?1, ?2, ?3, ?4, ?5, ?6)"
      ).bind(name, email, typeKey, subject, message, ipHash).run();
      rowId = ins?.meta?.last_row_id ?? null;
    } catch (e) {
      console.error("[contact] D1:", e?.message); // seguimos: el correo es lo principal
    }
  }

  const to = contactTo(env);
  const r = await sendEmail(env, {
    to,
    replyTo: `${name.replace(/["\\<>,;:]/g, "")} <${email}>`,
    ...contactFormEmail({ name, email, type: CONTACT_TYPES[typeKey], subject, message, to, receivedAt: new Date() }),
  });
  if (db && rowId) {
    try {
      await db.prepare("UPDATE contact_messages SET status = ?1, resend_id = ?2, error = ?3 WHERE id = ?4")
        .bind(r.ok ? "sent" : "failed", r.ok ? r.id || null : null, r.ok ? null : String(r.error || "").slice(0, 300), rowId).run();
    } catch (e) { console.error("[contact] D1 update:", e?.message); }
  }
  if (!r.ok || !r.id) {
    return fail(502, rowId ? "We saved your message but could not email the team right now. Please also email us directly." : "We could not send your message right now. Please email us directly.", { saved: !!rowId });
  }
  return [200, { success: true, id: r.id, message: "Message sent. We will get back to you as soon as possible." }];
}

// ───────────────────────────── noticias (proxy RSS) ─────────────────────────────
// Sustituye a rss2json: lee feeds públicos en el servidor, devuelve solo texto plano
// (sin HTML) y cachea 20 min en el edge. Si un feed falla, simplemente no aporta items.
const NEWS_FEEDS = [
  { name: "iRacing Official", url: "https://www.iracing.com/feed/", category: "iracing" },
  { name: "Traxion.GG", url: "https://www.traxion.gg/tag/iracing/feed/", category: "iracing" },
  { name: "SimRacer.es", url: "https://simracer.es/feed/", category: "simracing" },
  { name: "Outlaws Racing", url: "https://outlawsracing.es/feed/", category: "simracing" },
  { name: "Esports Insider", url: "https://esportsinsider.com/feed", category: "esports",
    filter: /sim ?racing|iracing|motorsport|formula|\bf1\b|gran turismo|le mans|racing/i },
  { name: "Motorsport.com", url: "https://www.motorsport.com/rss/all/news/", category: "sport" },
];
const NEWS_TTL_S = 1200;
const NEWS_PER_FEED = 6;

function decodeEntities(s) {
  return String(s || "")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#(\d+);/g, (_, n) => { try { return String.fromCodePoint(+n); } catch { return ""; } })
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => { try { return String.fromCodePoint(parseInt(n, 16)); } catch { return ""; } })
    .replace(/&quot;/g, '"').replace(/&apos;|&#039;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&");
}
function plainText(s, max) {
  const t = decodeEntities(decodeEntities(s)).replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]*>/g, " ").replace(/[<>]/g, "").replace(/\s+/g, " ").trim();
  return t.length > max ? t.slice(0, max - 1).trimEnd() + "…" : t;
}
function safeUrl(u) {
  try { const x = new URL(decodeEntities(String(u || "").trim())); return /^https?:$/.test(x.protocol) ? x.href : null; } catch { return null; }
}
function tag(block, name) {
  const m = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, "i"));
  return m ? m[1] : "";
}
function attr(block, re) { const m = block.match(re); return m ? m[1] : null; }

function parseFeed(xml, feed) {
  const blocks = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) || xml.match(/<entry[\s>][\s\S]*?<\/entry>/gi) || [];
  const out = [];
  for (const b of blocks) {
    const title = plainText(tag(b, "title"), 200);
    let link = safeUrl(plainText(tag(b, "link"), 600)) || safeUrl(attr(b, /<link[^>]+href="([^"]+)"/i));
    if (!title || !link) continue;
    const rawDesc = tag(b, "description") || tag(b, "summary") || tag(b, "content:encoded") || tag(b, "content");
    const description = plainText(rawDesc, 320);
    if (feed.filter && !feed.filter.test(title + " " + description)) continue;
    const dateRaw = plainText(tag(b, "pubDate") || tag(b, "published") || tag(b, "updated") || tag(b, "dc:date"), 60);
    const d = new Date(dateRaw);
    const thumbnail = safeUrl(
      attr(b, /<media:content[^>]+url="([^"]+)"/i) || attr(b, /<media:thumbnail[^>]+url="([^"]+)"/i) ||
      attr(b, /<enclosure[^>]+url="([^"]+)"[^>]*type="image/i) || attr(b, /<enclosure[^>]+type="image[^"]*"[^>]*url="([^"]+)"/i) ||
      attr(decodeEntities(tag(b, "content:encoded") + rawDesc), /<img[^>]+src="([^"]+)"/i));
    out.push({ title, description, link, pubDate: isNaN(d) ? null : d.toISOString(), source: feed.name,
      thumbnail, autoCategory: feed.category });
    if (out.length >= NEWS_PER_FEED) break;
  }
  return out;
}

async function fetchFeed(feed) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 5000);
  try {
    const r = await fetch(feed.url, { signal: ctrl.signal, redirect: "follow",
      headers: { "User-Agent": "Mozilla/5.0 (compatible; MuntrumeNews/1.0; +https://muntru.me/news)", Accept: "application/rss+xml, application/atom+xml, application/xml;q=0.9, */*;q=0.5" },
      cf: { cacheTtl: 600, cacheEverything: true } });
    if (!r.ok) return { feed, ok: false, status: r.status, items: [] };
    const xml = (await r.text()).slice(0, 2_000_000);
    const items = parseFeed(xml, feed);
    return { feed, ok: items.length > 0, status: r.status, items };
  } catch (e) {
    return { feed, ok: false, status: 0, items: [] };
  } finally { clearTimeout(t); }
}

let NEWS_MEMO = null; // caché por isolate (caches.default no persiste en *.workers.dev)
async function handleNews(request, ctx) {
  if (NEWS_MEMO && Date.now() - NEWS_MEMO.at < NEWS_TTL_S * 1000) return new Response(NEWS_MEMO.body, { status: 200, headers: NEWS_MEMO.headers });
  const cache = caches.default;
  const key = new Request(new URL("/api/news?v=1", request.url).href, { method: "GET" });
  const hit = await cache.match(key);
  if (hit) return hit;
  const results = await Promise.all(NEWS_FEEDS.map(fetchFeed));
  const items = results.flatMap(r => r.items)
    .sort((a, b) => (b.pubDate ? Date.parse(b.pubDate) : 0) - (a.pubDate ? Date.parse(a.pubDate) : 0));
  const body = { success: true, updated: new Date().toISOString(),
    sources: results.map(r => ({ name: r.feed.name, category: r.feed.category, ok: r.ok, count: r.items.length })), items };
  const okCount = results.filter(r => r.ok).length;
  const res = new Response(JSON.stringify(body), { status: 200, headers: {
    "Content-Type": "application/json; charset=utf-8", "Access-Control-Allow-Origin": "*",
    "X-Content-Type-Options": "nosniff",
    // Si ningún feed responde, cachear poco para reintentar pronto.
    "Cache-Control": `public, max-age=${okCount ? 900 : 60}` } });
  const text = JSON.stringify(body);
  if (okCount) NEWS_MEMO = { at: Date.now(), body: text, headers: Object.fromEntries(res.headers) };
  if (ctx && ctx.waitUntil) ctx.waitUntil(cache.put(key, res.clone())); else await cache.put(key, res.clone());
  return res;
}


// ───────────────────────── perfiles públicos de piloto (opt-in) ─────────────────────────
// Solo se publican pilotos con status 'active' y public_visible = 1 (lo activa un admin).
// Nunca se exponen email, id interno, rol, descargas ni setups.
const PUBLIC_SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/;
const PUBLIC_COLS = "public_slug AS slug, COALESCE(NULLIF(public_name,''), name) AS name, team, car_class, public_bio AS bio, public_links AS links, substr(created_at,1,7) AS since, CASE WHEN photo IS NULL OR photo = '' THEN 0 ELSE 1 END AS has_photo";
function slugify(v) {
  return String(v || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40).replace(/-+$/, "");
}
function cleanLinks(raw) {
  let arr = raw;
  if (typeof raw === "string") { try { arr = JSON.parse(raw); } catch { arr = []; } }
  if (!Array.isArray(arr)) return [];
  const out = [];
  for (const l of arr.slice(0, 6)) {
    const label = clean(l && l.label, 30);
    let u; try { u = new URL(String(l && l.url || "")); } catch { continue; }
    if (u.protocol !== "https:" || u.username || u.password || !label) continue;
    out.push({ label, url: u.href.slice(0, 300) });
  }
  return out;
}
function publicPilot(r) {
  return { slug: r.slug, name: r.name, team: r.team || null, car_class: r.car_class || null, since: r.since || null,
    bio: r.bio || null, links: cleanLinks(r.links), photo: r.has_photo ? `${API_ORIGIN}/api/pilots/${r.slug}/photo` : null };
}
async function handlePublicPilots(url, env) {
  const db = env.muntrume_vault;
  const path = url.pathname.replace(/\/+$/, "").split("/").slice(3); // [slug?, "photo"?]
  const base = { "Access-Control-Allow-Origin": "*", "X-Content-Type-Options": "nosniff", "Cache-Control": "public, max-age=300" };
  const json = (st, o, extra = {}) => new Response(JSON.stringify(o), { status: st, headers: { ...base, "Content-Type": "application/json; charset=utf-8", ...extra } });
  if (!path.length) {
    const r = await db.prepare(`SELECT ${PUBLIC_COLS} FROM allowed_users WHERE public_visible = 1 AND status = 'active' AND public_slug IS NOT NULL ORDER BY COALESCE(NULLIF(public_name,''), name) COLLATE NOCASE`).all();
    return json(200, { success: true, pilots: (r.results || []).map(publicPilot) });
  }
  const slug = String(path[0] || "").toLowerCase();
  if (!PUBLIC_SLUG_RE.test(slug) || path.length > 2 || (path[1] && path[1] !== "photo")) return json(404, { success: false, error: "not_found" }, { "Cache-Control": "public, max-age=60" });
  if (path[1] === "photo") {
    const row = await db.prepare("SELECT photo FROM allowed_users WHERE public_slug = ? AND public_visible = 1 AND status = 'active'").bind(slug).first();
    const m = row && String(row.photo || "").match(/^data:(image\/(?:webp|jpeg|png));base64,([A-Za-z0-9+/=]+)$/);
    if (!m) return new Response("Not found", { status: 404, headers: { ...base, "Cache-Control": "public, max-age=60" } });
    const bin = Uint8Array.from(atob(m[2]), (c) => c.charCodeAt(0));
    return new Response(bin, { status: 200, headers: { ...base, "Content-Type": m[1], "Cache-Control": "public, max-age=3600", "Cross-Origin-Resource-Policy": "cross-origin" } });
  }
  const row = await db.prepare(`SELECT ${PUBLIC_COLS} FROM allowed_users WHERE public_slug = ? AND public_visible = 1 AND status = 'active'`).bind(slug).first();
  if (!row) return json(404, { success: false, error: "not_found" }, { "Cache-Control": "public, max-age=60" });
  return json(200, { success: true, pilot: publicPilot(row) });
}
async function handleAdminUserPublic(request, body, env) {
  const s = await adminSession(request, body, env); if (s.err) return s.err;
  const t = await adminTarget(env, s, body.email);
  if (t.error) return t.error;
  const visible = body.visible ? 1 : 0;
  const publicName = clean(body.public_name, 60) || null;
  let slug = slugify(body.slug || publicName || t.user.name);
  if (!PUBLIC_SLUG_RE.test(slug)) return [400, { success: false, error: "El alias de la URL no es válido (a-z, 0-9 y guiones)." }];
  const bio = clean(body.bio, 280) || null;
  const links = cleanLinks(body.links);
  if (visible && t.user.status !== "active") return [400, { success: false, error: "Solo se pueden publicar pilotos activos." }];
  const clash = await env.muntrume_vault.prepare("SELECT id FROM allowed_users WHERE public_slug = ? AND id <> ?").bind(slug, t.user.id).first();
  if (clash) return [409, { success: false, error: "Ese alias de URL ya lo usa otro piloto." }];
  await env.muntrume_vault.prepare("UPDATE allowed_users SET public_visible = ?, public_name = ?, public_slug = ?, public_bio = ?, public_links = ? WHERE id = ?")
    .bind(visible, publicName, slug, bio, links.length ? JSON.stringify(links) : null, t.user.id).run();
  await audit(env, s.user.email, visible ? "user.public_on" : "user.public_off", t.user.email, JSON.stringify({ slug, public_name: publicName, links: links.length }));
  return [200, { success: true, slug, visible: !!visible, url: `${SITE}/p/${slug}/` }];
}

// ───────────────────────────── router ─────────────────────────────

const ROUTES = {
  "/api/setups/auth": "login",
  "/api/setups/change-password": "change_password",
  "/api/setups/password/forgot": "forgot",
  "/api/setups/password/set": "set_password",
  "/api/setups/request-join": "request_join",
  "/api/setups/catalog": "catalog",
  "/api/setups/download": "download",
  "/api/setups/download-batch": "download_batch",
  "/api/setups/car-files": "car_files",
  "/api/setups/g61-laps": "g61",
  "/api/setups/admin/panel": "admin_panel",
  "/api/setups/admin/approve": "admin_approve",
  "/api/setups/admin/reject": "admin_reject",
  "/api/setups/admin/resend-invite": "admin_resend",
  "/api/setups/admin/set-status": "admin_status",
  "/api/setups/admin/email-preview": "admin_email_preview",
  "/api/setups/code/request": "code_request",
  "/api/setups/code/verify": "code_verify",
  "/api/setups/admin/user/update": "admin_user_update",
  "/api/setups/admin/user/delete": "admin_user_delete",
  "/api/setups/admin/user/revoke": "admin_user_revoke",
  "/api/setups/admin/user/photo": "admin_user_photo",
  "/api/setups/admin/user/public": "admin_user_public",
  "/api/setups/admin/events": "admin_events",
  "/api/setups/admin/user/detail": "admin_user_detail",
  "/api/setups/admin/audit": "admin_audit",
  "/api/setups/admin/stats": "admin_stats",
  "/api/email/prefs": "email_prefs",
  "/api/contact": "contact",
  "/api/mail/send": "mail_send",
  "/api/setups/mail/send": "mail_send",
};
// Los antiguos modos "setup_*" (body.mode) y el admin.html con códigos fijos están retirados.
const LEGACY_MODE_RE = /^setup_/;
const NEEDS_DB = new Set(Object.values(ROUTES).filter((r) => r !== "contact"));


async function handleMailInbox(request, env) {
  if (!env.muntrume_vault) return [503, { success: false, error: "Database not available", messages: [] }];
  const url = new URL(request.url);
  const mailbox = (url.searchParams.get("mailbox") || "all").toLowerCase().trim();

  try {
    let rows = [];
    if (mailbox === "all") {
      const res = await env.muntrume_vault.prepare(`
        SELECT id, folder, sender_email, sender_name, recipient_email, subject, snippet, body, date_str, timestamp, starred, unread, attachment_name, attachment_size
        FROM webmail_messages
        ORDER BY timestamp DESC
        LIMIT 100
      `).all();
      rows = res.results || [];
    } else {
      const prefix = mailbox.split("@")[0].split(".")[0];
      const res = await env.muntrume_vault.prepare(`
        SELECT id, folder, sender_email, sender_name, recipient_email, subject, snippet, body, date_str, timestamp, starred, unread, attachment_name, attachment_size
        FROM webmail_messages
        WHERE recipient_email LIKE ? OR recipient_email LIKE ?
        ORDER BY timestamp DESC
        LIMIT 100
      `).bind(`%${prefix}%`, `%${mailbox}%`).all();
      rows = res.results || [];
    }
    return [200, { success: true, messages: rows }];
  } catch (err) {
    console.error("[mail-inbox]", err);
    return [500, { success: false, error: err.message, messages: [] }];
  }
}

export default {
  async email(message, env, ctx) {
    try {
      const from = message.from;
      const to = message.to;
      const rawBuffer = await new Response(message.raw).arrayBuffer();
      
      const parser = new PostalMime();
      const parsed = await parser.parse(rawBuffer);

      const subject = parsed.subject || message.headers.get("subject") || "(Sin asunto)";
      const messageId = message.headers.get("message-id") || `msg-${Date.now()}`;
      const senderName = parsed.from?.name || from.split("@")[0];
      
      let cleanBody = (parsed.text || "").trim();
      if (!cleanBody && parsed.html) {
        cleanBody = parsed.html.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
                               .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
                               .replace(/<[^>]+>/g, ' ')
                               .replace(/\s+/g, ' ')
                               .trim();
      }
      if (!cleanBody) cleanBody = "Mensaje recibido sin contenido de texto.";

      const snippet = cleanBody.replace(/\s+/g, " ").slice(0, 100);
      const now = Date.now();
      const dateStr = new Date(now).toLocaleString("es-ES", { timeZone: "Europe/Madrid", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

      let attachName = null;
      let attachSize = null;
      if (Array.isArray(parsed.attachments) && parsed.attachments.length > 0) {
        attachName = parsed.attachments[0].filename || "adjunto.sto";
        const bytes = parsed.attachments[0].content?.byteLength || 1024;
        attachSize = `${(bytes / 1024).toFixed(1)} KB`;
      }

      if (env.muntrume_vault) {
        await env.muntrume_vault.prepare(`
          INSERT OR REPLACE INTO webmail_messages
          (id, folder, sender_email, sender_name, recipient_email, subject, snippet, body, date_str, timestamp, starred, unread, attachment_name, attachment_size)
          VALUES (?, 'inbox', ?, ?, ?, ?, ?, ?, ?, ?, 0, 1, ?, ?)
        `).bind(
          messageId,
          from,
          senderName,
          to,
          subject,
          snippet,
          cleanBody,
          dateStr,
          now,
          attachName,
          attachSize
        ).run();
      }

      // Reenvío al buzón personal de Alberto (si el remitente no es su propio Gmail)
      if (from.toLowerCase() !== "atrumin16@gmail.com") {
        await message.forward("atrumin16@gmail.com");
      }
    } catch (err) {
      console.error("[email-worker-error]", err);
    }
  },
  async fetch(request, env, ctx) {
    const origin = request.headers.get("Origin") || "";
    const headers = corsHeaders(origin);
    const reply = (status, obj) => new Response(JSON.stringify(obj), { status, headers });

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
    RATE_LIMITER = env.RATE_LIMITER || null;
    const url = new URL(request.url);
    if (request.method === "GET" && (url.pathname === "/" || url.pathname === "/health" || url.pathname === "/api/health")) {
      let dbStatus = "unconfigured";
      if (env.muntrume_vault) {
        try {
          await env.muntrume_vault.prepare("SELECT 1").first();
          dbStatus = "connected";
        } catch {
          dbStatus = "degraded";
        }
      }
      return reply(200, {
        status: dbStatus === "degraded" ? "degraded" : "healthy",
        service: "Muntrume Motorsport Setup Vault & Edge API",
        version: "2.0.0",
        timestamp: new Date().toISOString(),
        database: dbStatus,
        rate_limiter: env.RATE_LIMITER ? "active" : "disabled",
        security: "Zero-Trust Ed25519/HMAC · Strict CSP"
      });
    }
        if (request.method === "GET" && url.pathname.replace(/\/+$/, "") === "/api/mail/inbox") {
      if (origin && !isAllowedOrigin(origin)) return reply(403, { error: "Forbidden: Unauthorized origin" });
      const out = await handleMailInbox(request, env);
      return reply(out[0], out[1]);
    }
    if (request.method === "GET" && url.pathname.replace(/\/+$/, "") === "/api/news") {
      try { return await handleNews(request, ctx); }
      catch (err) { console.error("[news]", err?.message); return reply(200, { success: false, items: [], sources: [] }); }
    }
    if (request.method === "GET" && url.pathname.replace(/\/+$/, "") === "/api/contact/token") {
      if (origin && !isAllowedOrigin(origin)) return reply(403, { error: "Forbidden: Unauthorized origin" });
      const out = await handleContactToken(env);
      return reply(out[0], out[1]);
    }
    if (request.method === "GET" && /^\/api\/pilots(\/|$)/.test(url.pathname)) {
      if (!env.muntrume_vault) return reply(503, { success: false });
      try { return await handlePublicPilots(url, env); }
      catch (e) { console.error("[pilots]", e?.message); return reply(500, { success: false }); }
    }
    if (request.method === "GET" && /^\/api\/events(\.ics|\/\d{1,9}\.ics)?\/?$/.test(url.pathname)) {
      if (!env.muntrume_vault) return reply(503, { success: false });
      try { return await handlePublicEvents(url, env); }
      catch (e) { console.error("[events]", e?.message); return reply(500, { success: false }); }
    }
    if (url.pathname.replace(/\/+$/, "") === "/api/email/unsubscribe") {
      // RFC 8058 one-click: lo llama el proveedor de correo (Gmail/Yahoo/Apple) sin Origin; solo POST cambia datos.
      const plain = { ...headers, "Access-Control-Allow-Origin": "*" };
      if (request.method !== "POST") return new Response("Usa el enlace del correo para gestionar tus avisos: https://muntru.me/email-preferences", { status: 405, headers: { "Content-Type": "text/plain; charset=utf-8", Allow: "POST" } });
      if (!env.muntrume_vault || !env.JWT_SECRET) return reply(503, { success: false });
      try { const out = await handleOneClickUnsubscribe(url, env); return new Response(JSON.stringify(out[1]), { status: out[0], headers: plain }); }
      catch (e) { console.error("[unsub]", e?.message); return reply(500, { success: false }); }
    }
    if (request.method !== "POST") return reply(405, { error: "Method not allowed" });
    if (origin && !isAllowedOrigin(origin)) return reply(403, { error: "Forbidden: Unauthorized origin" });

    let body;
    try {
      body = await request.json();
    } catch {
      return reply(400, { success: false, error: "JSON no válido." });
    }
    if (!body || typeof body !== "object") body = {};

    const ip = request.headers.get("CF-Connecting-IP") || "unknown";
    const route = ROUTES[url.pathname.replace(/\/+$/, "")];
    if (!route && LEGACY_MODE_RE.test(String(body.mode || "")))
      return reply(410, { success: false, error: "Esta versión del Vault ya no está disponible. Recarga https://muntru.me/setups." });

    try {
      if (route && NEEDS_DB.has(route)) {
        if (!env.muntrume_vault) return reply(503, { success: false, error: "Base de datos no disponible." });
        if (!env.JWT_SECRET || env.JWT_SECRET.length < 32) {
          console.error("[config] JWT_SECRET ausente o demasiado corto");
          return reply(503, { success: false, error: "El Vault está en mantenimiento. Inténtalo en unos minutos." });
        }
      }
      let out;
      switch (route) {
        case "login": out = await handleLogin(body, env, ip); break;
        case "change_password": out = await handleChangePassword(request, body, env); break;
        case "forgot": out = await handleForgotPassword(body, env, ip); break;
        case "set_password": out = await handleSetPassword(body, env); break;
        case "request_join": out = await handleRequestJoin(body, env, ip); break;
        case "catalog": out = await handleCatalog(request, body, env); break;
        case "download": out = await handleDownload(request, body, env, ctx, ip); break;
        case "download_batch": out = await handleDownloadBatch(request, body, env, ctx, ip); break;
        case "car_files": out = await handleCarFiles(request, body, env, ctx, ip); break;
        case "code_request": out = await handleCodeRequest(body, env, ip, ctx); break;
        case "code_verify": out = await handleCodeVerify(body, env, ip); break;
        case "admin_user_update": out = await handleAdminUserUpdate(request, body, env); break;
        case "admin_user_delete": out = await handleAdminUserDelete(request, body, env); break;
        case "admin_user_revoke": out = await handleAdminRevokeSessions(request, body, env); break;
        case "admin_user_photo": out = await handleAdminUserPhoto(request, body, env); break;
        case "admin_user_public": out = await handleAdminUserPublic(request, body, env); break;
        case "admin_events": out = await handleAdminEvents(request, body, env); break;
        case "admin_user_detail": out = await handleAdminUserDetail(request, body, env); break;
        case "admin_audit": out = await handleAdminAudit(request, body, env); break;
        case "admin_stats": out = await handleAdminStats(request, body, env); break;
        case "g61": out = await handleG61Laps(request, body, env); break;
        case "admin_panel": out = await handleAdminPanel(request, body, env); break;
        case "admin_approve": out = await handleAdminApprove(request, body, env); break;
        case "admin_reject": out = await handleAdminReject(request, body, env); break;
        case "admin_resend": out = await handleAdminResendInvite(request, body, env); break;
        case "admin_status": out = await handleAdminSetStatus(request, body, env); break;
        case "admin_email_preview": out = await handleAdminEmailPreview(request, body, env); break;
        case "email_prefs": out = await handleEmailPrefs(body, env, ip); break;
        case "contact": out = await handleContact(body, env, ip); break;
        case "mail_send": out = await handleMailSend(body, env, ip); break;
        default:
          if (url.pathname.startsWith("/api/setups/")) return reply(404, { success: false, error: "Ruta no encontrada." });
          if (["ai_chat", "ai_setup", "ask_about"].includes(body.mode)) out = await handleAI(body, env, ip);
          else out = await handleContact(body, env, ip);
      }
      return reply(out[0], out[1]);
    } catch (err) {
      console.error("[worker]", route || "contact", err?.message);
      return reply(500, { success: false, error: "Error interno del servidor. Inténtalo de nuevo." });
    }
  },
};

