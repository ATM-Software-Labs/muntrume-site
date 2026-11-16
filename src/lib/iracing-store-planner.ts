/**
 * MMT Sync / muntru.me — iRacing Season Purchase Planner, Volume Discounts & Tax Calculator
 * Implements Prompts 111, 112 & 114.
 */

export const TRACK_PRICE_USD = 14.95;
export const CAR_PRICE_USD = 11.95;

export interface TaxProfile {
  readonly id: string;
  readonly label: string;
  readonly rate: number; // e.g. 0.21
  readonly taxName: string;
  readonly currency: string;
  readonly symbol: string;
  readonly usdRate: number; // Approximate conversion from 1 USD
}

export const TAX_PROFILES: readonly TaxProfile[] = [
  { id: "es", label: "España (Península y Baleares) · 21% IVA", rate: 0.21, taxName: "IVA 21%", currency: "EUR", symbol: "€", usdRate: 0.92 },
  { id: "es_ic", label: "España (Canarias / Ceuta / Melilla) · 0% Exento", rate: 0.0, taxName: "IVA 0% (Exento)", currency: "EUR", symbol: "€", usdRate: 0.92 },
  { id: "de", label: "Alemania · 19% MwSt", rate: 0.19, taxName: "MwSt 19%", currency: "EUR", symbol: "€", usdRate: 0.92 },
  { id: "fr", label: "Francia / Austria · 20% TVA/USt", rate: 0.20, taxName: "TVA 20%", currency: "EUR", symbol: "€", usdRate: 0.92 },
  { id: "it", label: "Italia · 22% IVA", rate: 0.22, taxName: "IVA 22%", currency: "EUR", symbol: "€", usdRate: 0.92 },
  { id: "pt", label: "Portugal / Irlanda · 23% IVA/VAT", rate: 0.23, taxName: "IVA 23%", currency: "EUR", symbol: "€", usdRate: 0.92 },
  { id: "uk", label: "Reino Unido · 20% VAT", rate: 0.20, taxName: "VAT 20%", currency: "GBP", symbol: "£", usdRate: 0.79 },
  { id: "mx", label: "México · 16% IVA", rate: 0.16, taxName: "IVA 16%", currency: "MXN", symbol: "$", usdRate: 18.5 },
  { id: "cl", label: "Chile / Colombia · 19% IVA", rate: 0.19, taxName: "IVA 19%", currency: "CLP", symbol: "$", usdRate: 950.0 },
  { id: "ar", label: "Argentina · 21% IVA + percepciones", rate: 0.21, taxName: "IVA 21%", currency: "ARS", symbol: "$", usdRate: 1020.0 },
  { id: "latam_0", label: "Latinoamérica (sin retención directa) · 0%", rate: 0.0, taxName: "Tax 0%", currency: "USD", symbol: "$", usdRate: 1.0 },
  { id: "us_0", label: "EE.UU. / Canadá · 0% Tax-Free", rate: 0.0, taxName: "Sales Tax 0%", currency: "USD", symbol: "$", usdRate: 1.0 },
  { id: "us_7", label: "EE.UU. · 7% Sales Tax", rate: 0.07, taxName: "Sales Tax 7%", currency: "USD", symbol: "$", usdRate: 1.0 },
  { id: "ca_13", label: "Canadá (Ontario) · 13% HST", rate: 0.13, taxName: "HST 13%", currency: "CAD", symbol: "$", usdRate: 1.38 },
];

export function detectDefaultTaxProfileId(): string {
  try {
    const saved = localStorage.getItem("mmt-tax-profile");
    if (saved && TAX_PROFILES.some((p) => p.id === saved)) return saved;
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
    const lang = (navigator.language || "").toLowerCase();
    if (tz.includes("Canary")) return "es_ic";
    if (tz.includes("Madrid") || lang.startsWith("es-es")) return "es";
    if (tz.includes("Mexico") || lang.startsWith("es-mx")) return "mx";
    if (tz.includes("Buenos_Aires") || lang.startsWith("es-ar")) return "ar";
    if (tz.includes("Santiago") || tz.includes("Bogota")) return "cl";
    if (tz.includes("London") || lang.startsWith("en-gb")) return "uk";
    if (tz.includes("Berlin")) return "de";
    if (tz.includes("Paris") || tz.includes("Vienna")) return "fr";
    if (tz.includes("Rome")) return "it";
    if (tz.includes("Lisbon") || tz.includes("Dublin")) return "pt";
    if (tz.includes("Toronto")) return "ca_13";
    if (tz.includes("America/")) return "us_0";
  } catch { /* ignore */ }
  return "es";
}

export interface VolumeDiscountResult {
  rate: number;
  label: string;
  upsellHint: string | null;
}

export function getVolumeDiscount(cartCount: number, ownedCount: number): VolumeDiscountResult {
  if (ownedCount >= 40) {
    return { rate: 0.20, label: "20% Club 40", upsellHint: null };
  }
  if (cartCount >= 6) {
    return { rate: 0.15, label: "15% (6+ piezas)", upsellHint: null };
  }
  if (cartCount >= 3) {
    const needed = 6 - cartCount;
    const estSave = ((cartCount + needed) * TRACK_PRICE_USD * 0.05).toFixed(2);
    return {
      rate: 0.10,
      label: "10% (3–5 piezas)",
      upsellHint: `Añade ${needed} ${needed === 1 ? "pieza más" : "piezas más"} para activar el 15% y ahorrarte ~$${estSave} extra en todo el carrito.`,
    };
  }
  if (cartCount > 0) {
    const needed = 3 - cartCount;
    return {
      rate: 0,
      label: "0% (<3 piezas)",
      upsellHint: `Añade ${needed} ${needed === 1 ? "pieza más" : "piezas más"} para desbloquear el 10% de descuento por volumen.`,
    };
  }
  return { rate: 0, label: "0%", upsellHint: null };
}

export interface CheckoutBreakdown {
  subtotalUsd: number;
  discountRate: number;
  discountLabel: string;
  discountUsd: number;
  creditsUsedUsd: number;
  taxableBaseUsd: number;
  taxRate: number;
  taxName: string;
  taxUsd: number;
  totalUsd: number;
  localAmountFormatted: string;
  localCurrency: string;
  upsellHint: string | null;
}

export function calculateCheckout(
  cartTracksCount: number,
  cartCarsCount: number,
  ownedTotalCount: number,
  participationCreditsUsd: number,
  profileId: string
): CheckoutBreakdown {
  const profile = TAX_PROFILES.find((p) => p.id === profileId) ?? TAX_PROFILES[0];
  const totalItems = cartTracksCount + cartCarsCount;
  const subtotalUsd = cartTracksCount * TRACK_PRICE_USD + cartCarsCount * CAR_PRICE_USD;
  const vol = getVolumeDiscount(totalItems, ownedTotalCount);
  const discountUsd = subtotalUsd * vol.rate;
  const afterDiscount = Math.max(0, subtotalUsd - discountUsd);
  const creditsUsedUsd = Math.min(afterDiscount, Math.max(0, participationCreditsUsd));
  const taxableBaseUsd = Math.max(0, afterDiscount - creditsUsedUsd);
  const taxUsd = taxableBaseUsd * profile.rate;
  const totalUsd = taxableBaseUsd + taxUsd;
  const localVal = totalUsd * profile.usdRate;
  const localAmountFormatted = profile.currency === "CLP" || profile.currency === "ARS"
    ? `${profile.symbol}${Math.round(localVal).toLocaleString("es-ES")}`
    : `${localVal.toFixed(2).replace(".", ",")} ${profile.symbol}`;

  return {
    subtotalUsd,
    discountRate: vol.rate,
    discountLabel: vol.label,
    discountUsd,
    creditsUsedUsd,
    taxableBaseUsd,
    taxRate: profile.rate,
    taxName: profile.taxName,
    taxUsd,
    totalUsd,
    localAmountFormatted,
    localCurrency: profile.currency,
    upsellHint: vol.upsellHint,
  };
}
