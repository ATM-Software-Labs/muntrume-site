/**
 * MMT Sync — External Plugin Loader (Bloque 17)
 * Scans plugins/<name>/manifest.json, registers custom community widgets,
 * and mounts them into the overlay stage with draggable, scalable, and click-through properties.
 */

export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  author: string;
  description: string;
  entry: string; // usually index.html
  width: number;
  height: number;
  defaultPosition?: {
    x: number;
    y: number;
  };
}

export interface LoadedPlugin {
  manifest: PluginManifest;
  path: string;
  enabled: boolean;
  element?: HTMLElement;
}

const PLUGINS_STORAGE_KEY = "mmt_enabled_plugins_v1";

export class PluginLoader {
  private static instance: PluginLoader;
  private plugins: Map<string, LoadedPlugin> = new Map();

  private constructor() {
    this.registerBuiltinStarter();
  }

  public static getInstance(): PluginLoader {
    if (!PluginLoader.instance) {
      PluginLoader.instance = new PluginLoader();
    }
    return PluginLoader.instance;
  }

  private registerBuiltinStarter(): void {
    const starterManifest: PluginManifest = {
      id: "example-gforce-meter",
      name: "Medidor de Fuerzas G (2D)",
      version: "1.0.0",
      author: "Comunidad MMT",
      description: "Visualizador bidimensional de fuerzas G longitudinales y aceleración lateral para cockpit.",
      entry: "index.html",
      width: 170,
      height: 170,
      defaultPosition: { x: 740, y: 720 },
    };

    let isEnabled = false;
    try {
      if (typeof localStorage !== "undefined") {
        const stored = localStorage.getItem(PLUGINS_STORAGE_KEY);
        if (stored) {
          const list = JSON.parse(stored);
          isEnabled = Array.isArray(list) && list.includes(starterManifest.id);
        }
      }
    } catch {}

    this.plugins.set(starterManifest.id, {
      manifest: starterManifest,
      path: "plugins/example-gforce-meter/",
      enabled: isEnabled,
    });
  }

  public getPlugins(): LoadedPlugin[] {
    return Array.from(this.plugins.values());
  }

  public setPluginEnabled(id: string, enabled: boolean): void {
    const p = this.plugins.get(id);
    if (!p) return;
    p.enabled = enabled;
    try {
      if (typeof localStorage !== "undefined") {
        const enabledIds = Array.from(this.plugins.values())
          .filter((pl) => pl.enabled)
          .map((pl) => pl.manifest.id);
        localStorage.setItem(PLUGINS_STORAGE_KEY, JSON.stringify(enabledIds));
      }
    } catch {}
  }

  public mountPlugins(container: HTMLElement): void {
    this.plugins.forEach((plugin) => {
      if (!plugin.enabled) {
        if (plugin.element) {
          plugin.element.remove();
          plugin.element = undefined;
        }
        return;
      }

      if (plugin.element && container.contains(plugin.element)) return;

      const widget = document.createElement("div");
      widget.id = `plugin-widget-${plugin.manifest.id}`;
      widget.className = "mmt-float-widget absolute rounded-xl border border-white/10 bg-black/85 backdrop-blur-md p-2 shadow-2xl pointer-events-auto select-none";
      widget.dataset.widget = `plugin_${plugin.manifest.id}`;
      widget.style.width = `${plugin.manifest.width}px`;
      widget.style.height = `${plugin.manifest.height}px`;

      const defX = plugin.manifest.defaultPosition?.x || 100;
      const defY = plugin.manifest.defaultPosition?.y || 100;
      widget.style.left = `${defX}px`;
      widget.style.top = `${defY}px`;

      const iframe = document.createElement("iframe");
      iframe.src = `${plugin.path}${plugin.manifest.entry}`;
      iframe.className = "w-full h-full border-0 rounded bg-transparent";
      iframe.title = plugin.manifest.name;

      widget.appendChild(iframe);
      container.appendChild(widget);
      plugin.element = widget;
    });
  }
}
