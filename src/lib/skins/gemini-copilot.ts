import { contrastRatio } from "./photo-guide";
import type {
  CarProfile,
  FinishType,
  GeminiDesignReview,
  GeminiDesignSuggestion,
  GeminiPhotoAdaptation,
  PatternStyle,
  PhotoGuideShot,
  SkinDesignState,
} from "./types";

const STORAGE_KEY = "mmt-skins-gemini-api-key";
const MODEL_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

export function getSavedGeminiKey(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) || "";
  } catch {
    return "";
  }
}

export function saveGeminiKey(key: string): void {
  try {
    const clean = key.trim();
    if (!clean) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, clean);
  } catch {
    // Ignore storage quota errors
  }
}

async function callGeminiJson<T>(apiKey: string, prompt: string): Promise<T> {
  const key = apiKey.trim();
  if (!key) {
    throw new Error("Configura tu API key de Gemini en local antes de usar el copiloto.");
  }

  let res: Response;
  try {
    res = await fetch(`${MODEL_ENDPOINT}?key=${encodeURIComponent(key)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.45,
          responseMimeType: "application/json",
        },
      }),
    });
  } catch {
    throw new Error("Error de red al conectar con Gemini API. Comprueba tu conexión o bloqueadores.");
  }

  if (!res.ok) {
    if (res.status === 400 || res.status === 401 || res.status === 403) {
      throw new Error("API key de Gemini inválida o sin permisos para gemini-2.5-flash.");
    }
    if (res.status === 429) {
      throw new Error("Cuota de Gemini API alcanzada (HTTP 429). Espera unos segundos o revisa tu plan en Google AI Studio.");
    }
    throw new Error(`Error HTTP ${res.status} al consultar Gemini API.`);
  }

  const data = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
  if (!rawText) {
    throw new Error("Gemini devolvió una respuesta vacía.");
  }

  const cleaned = rawText.replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    throw new Error("No se pudo interpretar el JSON devuelto por Gemini. Inténtalo de nuevo.");
  }
}

const VALID_PATTERNS: PatternStyle[] = ["endurance", "sprint", "carbon-stealth", "tricolor", "clean-minimal"];
const VALID_FINISHES: FinishType[] = ["gloss", "satin", "matte", "metallic", "chrome", "carbon"];

function safeHex(val: unknown, fallback: string): string {
  return typeof val === "string" && /^#[0-9a-fA-F]{6}$/.test(val.trim()) ? val.trim() : fallback;
}

export async function requestGeminiDesignSuggestion(
  apiKey: string,
  car: CarProfile,
  state: SkinDesignState,
  userPrompt: string,
): Promise<GeminiDesignSuggestion> {
  const prompt = `Eres diseñador jefe de liveries GT3 para la escudería Muntrume Motorsport (MMT, identidad verde esmeralda #00e699 y tonos oscuros técnicos).
Coche: ${car.name} (${car.notes})
Piloto: ${state.customDriverName} #${state.customNumber}
Petición del piloto: ${userPrompt || "Propón una decoración competitiva, moderna y muy legible en pista y retransmisiones."}

Devuelve EXCLUSIVAMENTE un JSON válido con esta estructura exacta:
{
  "title": "Nombre corto del concepto",
  "rationale": "Explicación concisa en español (máx 2 frases) de por qué funciona en este coche",
  "pattern": "endurance" | "sprint" | "carbon-stealth" | "tricolor" | "clean-minimal",
  "finish": "gloss" | "satin" | "matte" | "metallic" | "chrome" | "carbon",
  "palette": {
    "primary": "#RRGGBB",
    "secondary": "#RRGGBB",
    "accent": "#RRGGBB",
    "detail": "#RRGGBB",
    "numberColor": "#RRGGBB",
    "numberBg": "#RRGGBB"
  },
  "sponsorTips": ["Consejo práctico 1 sobre colocación de logos en este coche", "Consejo 2", "Consejo 3"]
}`;

  const raw = await callGeminiJson<Partial<GeminiDesignSuggestion>>(apiKey, prompt);
  const pattern = VALID_PATTERNS.includes(raw.pattern as PatternStyle) ? (raw.pattern as PatternStyle) : state.pattern;
  const finish = VALID_FINISHES.includes(raw.finish as FinishType) ? (raw.finish as FinishType) : state.spec.finish;

  return {
    title: typeof raw.title === "string" && raw.title.trim() ? raw.title.trim() : "Propuesta MMT Gemini",
    rationale: typeof raw.rationale === "string" ? raw.rationale.trim() : "Paleta equilibrada para alta legibilidad en pista.",
    pattern,
    finish,
    palette: {
      primary: safeHex(raw.palette?.primary, state.palette.primary),
      secondary: safeHex(raw.palette?.secondary, state.palette.secondary),
      accent: safeHex(raw.palette?.accent, state.palette.accent),
      detail: safeHex(raw.palette?.detail, state.palette.detail),
      numberColor: safeHex(raw.palette?.numberColor, state.palette.numberColor),
      numberBg: safeHex(raw.palette?.numberBg, state.palette.numberBg),
    },
    sponsorTips: Array.isArray(raw.sponsorTips) ? raw.sponsorTips.slice(0, 4).map(String) : [],
  };
}

export async function requestGeminiPhotoAdaptation(
  apiKey: string,
  car: CarProfile,
  state: SkinDesignState,
  baseShots: PhotoGuideShot[],
): Promise<GeminiPhotoAdaptation> {
  const prompt = `Eres fotógrafo virtual experto en iRacing y Trading Paints para Muntrume Motorsport.
Coche: ${car.name}
Colores: base ${state.palette.primary}, secundario ${state.palette.secondary}, acento ${state.palette.accent}.
Acabado Spec Map: ${state.spec.finish} (metallic ${state.spec.metallic}%, roughness ${state.spec.roughness}%, clearcoat ${state.spec.clearcoat}%).
Tomas base: ${baseShots.map((s) => `${s.id}:${s.title}`).join(", ")}

Adapta el circuito de iRacing, hora exacta del día, clima y consejos de cámara Ctrl+F12 para que esta pintura concrete luzca profesional en Trading Paints y muntru.me.
Devuelve EXCLUSIVAMENTE un JSON válido:
{
  "summary": "Resumen breve en español",
  "recommendedCircuit": "Circuito de iRacing recomendado",
  "lightingNote": "Hora y clima exactos en iRacing",
  "shots": [
    {
      "id": "front34",
      "title": "...",
      "filename": "${baseShots[0]?.filename || "shot1.png"}",
      "circuit": "...",
      "timeAndWeather": "...",
      "cameraSetup": "Instrucciones concretas Ctrl+F12",
      "checklist": ["Punto 1", "Punto 2"]
    }
  ]
}`;

  const raw = await callGeminiJson<Partial<GeminiPhotoAdaptation>>(apiKey, prompt);
  const shots = Array.isArray(raw.shots) && raw.shots.length > 0
    ? raw.shots.slice(0, 4).map((s, idx) => ({
        id: s.id || baseShots[idx]?.id || `shot-${idx}`,
        title: s.title || baseShots[idx]?.title || `Toma ${idx + 1}`,
        filename: s.filename || baseShots[idx]?.filename || `mmt_shot_${idx + 1}.png`,
        circuit: s.circuit || raw.recommendedCircuit || baseShots[idx]?.circuit || "Spa-Francorchamps",
        timeAndWeather: s.timeAndWeather || raw.lightingNote || baseShots[idx]?.timeAndWeather || "16:30 Partly Cloudy",
        cameraSetup: s.cameraSetup || baseShots[idx]?.cameraSetup || "Ctrl+F12 FOV 35°",
        checklist: Array.isArray(s.checklist) ? s.checklist.map(String) : baseShots[idx]?.checklist || [],
      }))
    : baseShots;

  return {
    summary: raw.summary || "Guía de sesión adaptada al coche y acabado Spec Map.",
    recommendedCircuit: raw.recommendedCircuit || shots[0]?.circuit || "Spa-Francorchamps",
    lightingNote: raw.lightingNote || shots[0]?.timeAndWeather || "16:30 Partly Cloudy",
    shots,
  };
}

export async function requestGeminiDesignReview(
  apiKey: string,
  car: CarProfile,
  state: SkinDesignState,
): Promise<GeminiDesignReview> {
  const accentVsPrimary = contrastRatio(state.palette.accent, state.palette.primary);
  const detailVsPrimary = contrastRatio(state.palette.detail, state.palette.primary);
  const numberContrast = contrastRatio(state.palette.numberColor, state.palette.numberBg);

  const prompt = `Actúa como revisor técnico pre-exportación de liveries de iRacing para Muntrume Motorsport.
Coche: ${car.name}
Patrón: ${state.pattern} | Acabado: ${state.spec.finish} (M:${state.spec.metallic}% R:${state.spec.roughness}% C:${state.spec.clearcoat}%)
Resolución: ${state.resolution}x${state.resolution}px
Contraste medido (WCAG):
- Acento vs Base: ${accentVsPrimary}:1
- Detalle/Texto vs Base: ${detailVsPrimary}:1
- Dorsal vs Fondo Dorsal: ${numberContrast}:1
Capas/Logos activos (${state.decals.length}): ${state.decals.map((d) => `${d.name} (escala ${Math.round(d.scale * 100)}%, simetría ${d.mirrorX ? "sí" : "no"})`).join("; ")}

Evalúa contraste, legibilidad a 250 km/h en cámara TV y preparación para Trading Paints.
Devuelve EXCLUSIVAMENTE un JSON válido:
{
  "score": 88,
  "verdict": "Veredicto breve en español",
  "contrastNotes": ["Nota 1", "Nota 2"],
  "legibilityNotes": ["Nota 1", "Nota 2"],
  "exportChecklist": ["Revisión 1", "Revisión 2"]
}`;

  const raw = await callGeminiJson<Partial<GeminiDesignReview>>(apiKey, prompt);
  return {
    score: typeof raw.score === "number" ? Math.max(0, Math.min(100, Math.round(raw.score))) : 82,
    verdict: typeof raw.verdict === "string" ? raw.verdict : "Diseño listo con margen de ajuste menor.",
    contrastNotes: Array.isArray(raw.contrastNotes) ? raw.contrastNotes.map(String) : [],
    legibilityNotes: Array.isArray(raw.legibilityNotes) ? raw.legibilityNotes.map(String) : [],
    exportChecklist: Array.isArray(raw.exportChecklist) ? raw.exportChecklist.map(String) : [],
  };
}
