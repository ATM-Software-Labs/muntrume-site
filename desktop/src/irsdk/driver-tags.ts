/**
 * MMT Sync — Driver Tags Engine (Bloque 2)
 * Local persistence (localStorage / desktop state) for driver tags:
 * Rival, Amigo, Sucio, Limpio, Notas.
 * Displays high-contrast Kapps 2027 badges alongside driver names in Relative & Standings.
 */

export type DriverTagType = "rival" | "friend" | "dirty" | "clean" | "notes";

export interface DriverTag {
  type: DriverTagType;
  label: string;
  badgeBg: string;
  badgeColor: string;
  badgeBorder: string;
  notes?: string;
  updatedAt: number;
}

export const DRIVER_TAG_CONFIGS: Record<DriverTagType, { label: string; badgeBg: string; badgeColor: string; badgeBorder: string }> = {
  rival: {
    label: "RIVAL",
    badgeBg: "rgba(239, 68, 68, 0.25)",
    badgeColor: "#f87171",
    badgeBorder: "rgba(239, 68, 68, 0.6)",
  },
  friend: {
    label: "AMIGO",
    badgeBg: "rgba(16, 185, 129, 0.25)",
    badgeColor: "#34d399",
    badgeBorder: "rgba(16, 185, 129, 0.6)",
  },
  dirty: {
    label: "SUCIO",
    badgeBg: "rgba(168, 85, 247, 0.25)",
    badgeColor: "#c084fc",
    badgeBorder: "rgba(168, 85, 247, 0.6)",
  },
  clean: {
    label: "LIMPIO",
    badgeBg: "rgba(56, 189, 248, 0.25)",
    badgeColor: "#38bdf8",
    badgeBorder: "rgba(56, 189, 248, 0.6)",
  },
  notes: {
    label: "NOTA",
    badgeBg: "rgba(251, 191, 36, 0.25)",
    badgeColor: "#fbbf24",
    badgeBorder: "rgba(251, 191, 36, 0.6)",
  },
};

const STORAGE_KEY = "mmt_driver_tags_v1";

export class DriverTagsManager {
  private static instance: DriverTagsManager;
  private tags: Map<string, DriverTag> = new Map();
  private listeners: Array<() => void> = [];

  private constructor() {
    this.loadFromStorage();
  }

  public static getInstance(): DriverTagsManager {
    if (!DriverTagsManager.instance) {
      DriverTagsManager.instance = new DriverTagsManager();
    }
    return DriverTagsManager.instance;
  }

  private normalizeKey(key: string | number): string {
    return String(key).trim().toLowerCase();
  }

  private loadFromStorage(): void {
    try {
      if (typeof localStorage === "undefined") return;
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        for (const [k, v] of Object.entries(parsed)) {
          const item = v as any;
          if (item && item.type && DRIVER_TAG_CONFIGS[item.type as DriverTagType]) {
            const conf = DRIVER_TAG_CONFIGS[item.type as DriverTagType];
            this.tags.set(this.normalizeKey(k), {
              type: item.type as DriverTagType,
              label: conf.label,
              badgeBg: conf.badgeBg,
              badgeColor: conf.badgeColor,
              badgeBorder: conf.badgeBorder,
              notes: item.notes || "",
              updatedAt: item.updatedAt || Date.now(),
            });
          }
        }
      }
    } catch (e) {
      console.warn("[driver-tags] Error loading driver tags:", e);
    }
  }

  private saveToStorage(): void {
    try {
      if (typeof localStorage === "undefined") return;
      const obj: Record<string, any> = {};
      this.tags.forEach((tag, key) => {
        obj[key] = {
          type: tag.type,
          notes: tag.notes,
          updatedAt: tag.updatedAt,
        };
      });
      localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
    } catch (e) {
      console.warn("[driver-tags] Error saving driver tags:", e);
    }
    this.notify();
  }

  public getTag(identifier: string | number): DriverTag | null {
    const key = this.normalizeKey(identifier);
    return this.tags.get(key) || null;
  }

  public setTag(identifier: string | number, type: DriverTagType, notes = ""): DriverTag {
    const key = this.normalizeKey(identifier);
    const conf = DRIVER_TAG_CONFIGS[type];
    const tag: DriverTag = {
      type,
      label: conf.label,
      badgeBg: conf.badgeBg,
      badgeColor: conf.badgeColor,
      badgeBorder: conf.badgeBorder,
      notes,
      updatedAt: Date.now(),
    };
    this.tags.set(key, tag);
    this.saveToStorage();
    return tag;
  }

  public removeTag(identifier: string | number): boolean {
    const key = this.normalizeKey(identifier);
    const existed = this.tags.delete(key);
    if (existed) this.saveToStorage();
    return existed;
  }

  public getAllTags(): Map<string, DriverTag> {
    return new Map(this.tags);
  }

  public clearAll(): void {
    this.tags.clear();
    this.saveToStorage();
  }

  public subscribe(fn: () => void): () => void {
    this.listeners.push(fn);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== fn);
    };
  }

  private notify(): void {
    for (const listener of this.listeners) {
      try {
        listener();
      } catch {}
    }
  }

  /**
   * Helper that renders HTML badge for a driver given their cust_id or name
   */
  public renderBadgeHtml(identifier: string | number): string {
    const tag = this.getTag(identifier);
    if (!tag) return "";
    const tooltip = tag.notes ? `title="${tag.notes.replace(/"/g, "&quot;")}"` : "";
    return `
      <span class="px-1 py-0.2 rounded text-[8px] font-black uppercase tracking-wider select-none cursor-pointer"
        style="background-color: ${tag.badgeBg}; color: ${tag.badgeColor}; border: 1px solid ${tag.badgeBorder};"
        ${tooltip}
        data-driver-tag="${tag.type}"
      >
        ${tag.label}
      </span>
    `;
  }
}
