/**
 * MMT Sync — Community i18n & Translation Manager (Bloque 18)
 * Flat JSON localization for ES, EN, PT, DE, FR, IT and custom_lang.json testing.
 * Updates interface and spotter strings in real-time without app restart.
 */

import esDict from "../../locales/es.json";
import enDict from "../../locales/en.json";
import ptDict from "../../locales/pt.json";
import deDict from "../../locales/de.json";
import frDict from "../../locales/fr.json";
import itDict from "../../locales/it.json";

export type SupportedLocale = "es" | "en" | "pt" | "de" | "fr" | "it" | "custom";

export const BUILTIN_LOCALES: Record<Exclude<SupportedLocale, "custom">, { name: string; dict: Record<string, string> }> = {
  es: { name: "Español", dict: esDict },
  en: { name: "English", dict: enDict },
  pt: { name: "Português", dict: ptDict },
  de: { name: "Deutsch", dict: deDict },
  fr: { name: "Français", dict: frDict },
  it: { name: "Italiano", dict: itDict },
};

const LOCALE_STORAGE_KEY = "mmt_locale_v1";
const CUSTOM_LANG_KEY = "mmt_custom_lang_v1";

export class I18nManager {
  private static instance: I18nManager;
  private currentLocale: SupportedLocale = "es";
  private customDict: Record<string, string> = {};
  private listeners: Array<() => void> = [];

  private constructor() {
    this.loadFromStorage();
  }

  public static getInstance(): I18nManager {
    if (!I18nManager.instance) {
      I18nManager.instance = new I18nManager();
    }
    return I18nManager.instance;
  }

  private loadFromStorage(): void {
    try {
      if (typeof localStorage === "undefined") return;
      const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
      if (stored && (stored === "custom" || BUILTIN_LOCALES[stored as Exclude<SupportedLocale, "custom">])) {
        this.currentLocale = stored as SupportedLocale;
      }
      const rawCustom = localStorage.getItem(CUSTOM_LANG_KEY);
      if (rawCustom) {
        this.customDict = JSON.parse(rawCustom);
      }
    } catch {}
  }

  private saveToStorage(): void {
    try {
      if (typeof localStorage === "undefined") return;
      localStorage.setItem(LOCALE_STORAGE_KEY, this.currentLocale);
      if (Object.keys(this.customDict).length > 0) {
        localStorage.setItem(CUSTOM_LANG_KEY, JSON.stringify(this.customDict));
      }
    } catch {}
    this.notify();
  }

  public getLocale(): SupportedLocale {
    return this.currentLocale;
  }

  public setLocale(locale: SupportedLocale): void {
    this.currentLocale = locale;
    this.saveToStorage();
    this.updateDomTranslations();
  }

  public loadCustomLang(jsonText: string): boolean {
    try {
      const parsed = JSON.parse(jsonText);
      if (parsed && typeof parsed === "object") {
        this.customDict = parsed;
        this.currentLocale = "custom";
        this.saveToStorage();
        this.updateDomTranslations();
        return true;
      }
    } catch (e) {
      console.error("[i18n] Error parsing custom_lang.json:", e);
    }
    return false;
  }

  public t(key: string, fallback?: string): string {
    if (this.currentLocale === "custom" && this.customDict[key]) {
      return this.customDict[key];
    }
    const builtin = BUILTIN_LOCALES[this.currentLocale as Exclude<SupportedLocale, "custom">];
    if (builtin && builtin.dict[key]) {
      return builtin.dict[key];
    }
    // Fallback to Spanish or English
    if (esDict[key as keyof typeof esDict]) {
      return esDict[key as keyof typeof esDict];
    }
    return fallback || key;
  }

  public updateDomTranslations(root?: ParentNode): void {
    if (typeof document === "undefined") return;
    const target = root || document;
    const elements = target.querySelectorAll<HTMLElement>("[data-i18n]");
    elements.forEach((el) => {
      const key = el.getAttribute("data-i18n");
      if (key) {
        el.textContent = this.t(key, el.textContent || "");
      }
    });
  }

  public subscribe(fn: () => void): () => void {
    this.listeners.push(fn);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== fn);
    };
  }

  private notify(): void {
    for (const l of this.listeners) {
      try {
        l();
      } catch {}
    }
  }
}
