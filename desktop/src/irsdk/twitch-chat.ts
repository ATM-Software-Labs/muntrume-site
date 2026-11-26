/**
 * MMT Sync — Transparent Twitch Chat Cockpit Overlay (Kapps-inspired, 0 API keys)
 * Connects read-only to Twitch IRC WebSocket (`wss://irc-ws.chat.twitch.tv:443`)
 * using anonymous `justinfan` credentials. Supports IRCv3 display-name, user color,
 * MOD/VIP/SUB badges, auto-fade, and strict HTML escaping.
 */

export interface TwitchChatMessage {
  id: string;
  user: string;
  color: string;
  badges: string[];
  text: string;
  ts: number;
}

const CHANNEL_STORAGE_KEY = "mmt-twitch-channel";
const MAX_MESSAGES = 14;

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function parseIrcTags(rawTags: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of rawTags.split(";")) {
    const eq = part.indexOf("=");
    if (eq > 0) out[part.slice(0, eq)] = part.slice(eq + 1);
  }
  return out;
}

export class TwitchChatOverlay {
  private ws: WebSocket | null = null;
  private channel = "";
  private messages: TwitchChatMessage[] = [];
  private container: HTMLElement | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private connected = false;

  public getSavedChannel(): string {
    try {
      return (localStorage.getItem(CHANNEL_STORAGE_KEY) || "").trim().toLowerCase().replace(/^#/, "");
    } catch {
      return "";
    }
  }

  public setChannel(rawChannel: string): void {
    const clean = rawChannel.trim().toLowerCase().replace(/^#/, "").replace(/[^a-z0-9_]/g, "");
    try {
      localStorage.setItem(CHANNEL_STORAGE_KEY, clean);
    } catch { /* ignore */ }
    if (clean === this.channel && this.ws) return;
    this.disconnect();
    this.channel = clean;
    this.messages = [];
    if (clean) this.connect(clean);
    this.render();
  }

  public mount(container: HTMLElement): void {
    this.container = container;
    const saved = this.getSavedChannel();
    if (saved && saved !== this.channel) {
      this.channel = saved;
      this.connect(saved);
    }
    this.render();
  }

  public disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      try {
        this.ws.close();
      } catch { /* ignore */ }
      this.ws = null;
    }
    this.connected = false;
  }

  private connect(channel: string): void {
    if (typeof WebSocket === "undefined") return;
    try {
      const ws = new WebSocket("wss://irc-ws.chat.twitch.tv:443");
      this.ws = ws;
      const anonId = Math.floor(10000 + Math.random() * 89999);

      ws.onopen = () => {
        this.connected = true;
        ws.send("CAP REQ :twitch.tv/tags");
        ws.send("PASS SCHMOOPIIE");
        ws.send(`NICK justinfan${anonId}`);
        ws.send(`JOIN #${channel}`);
        this.render();
      };

      ws.onmessage = (ev) => {
        const payload = String(ev.data || "");
        for (const line of payload.split("\r\n")) {
          if (!line) continue;
          if (line.startsWith("PING")) {
            ws.send("PONG :tmi.twitch.tv");
            continue;
          }
          if (!line.includes(" PRIVMSG ")) continue;
          this.handlePrivMsg(line);
        }
      };

      ws.onclose = () => {
        this.connected = false;
        this.ws = null;
        this.render();
        if (this.channel === channel && channel) {
          this.reconnectTimer = setTimeout(() => this.connect(channel), 5000);
        }
      };

      ws.onerror = () => {
        try { ws.close(); } catch { /* ignore */ }
      };
    } catch {
      this.connected = false;
    }
  }

  private handlePrivMsg(line: string): void {
    let tags: Record<string, string> = {};
    let rest = line;
    if (rest.startsWith("@")) {
      const sp = rest.indexOf(" ");
      if (sp > 1) {
        tags = parseIrcTags(rest.slice(1, sp));
        rest = rest.slice(sp + 1);
      }
    }
    const msgIdx = rest.indexOf(" :");
    if (msgIdx < 0) return;
    const text = rest.slice(msgIdx + 2).trim();
    if (!text) return;

    const userMatch = rest.match(/^:([^!]+)!/);
    const user = tags["display-name"] || userMatch?.[1] || "Viewer";
    const color = /^#[0-9a-fA-F]{6}$/.test(tags["color"] || "") ? tags["color"] : "#34d399";
    const rawBadges = tags["badges"] || "";
    const badges: string[] = [];
    if (rawBadges.includes("broadcaster/")) badges.push("HOST");
    if (rawBadges.includes("moderator/")) badges.push("MOD");
    if (rawBadges.includes("vip/")) badges.push("VIP");
    if (rawBadges.includes("subscriber/")) badges.push("SUB");

    this.messages.push({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      user,
      color,
      badges,
      text: text.slice(0, 220),
      ts: Date.now(),
    });
    if (this.messages.length > MAX_MESSAGES) {
      this.messages.splice(0, this.messages.length - MAX_MESSAGES);
    }
    this.render();
  }

  public render(): void {
    if (!this.container) return;
    const statusDot = this.channel
      ? this.connected
        ? `<span style="color:#10b981;">● #${esc(this.channel)}</span>`
        : `<span style="color:#f59e0b;">○ Conectando #${esc(this.channel)}...</span>`
      : `<span style="color:#94a3b8;">Sin canal</span>`;

    const rows = this.messages.length > 0
      ? this.messages
          .slice(-8)
          .map((m) => {
            const bHtml = m.badges
              .map((b) => `<span style="padding:0 3px;margin-right:3px;border-radius:2px;font-size:8.5px;font-weight:900;background:${b === "MOD" ? "#10b981" : b === "HOST" ? "#ef4444" : "#8b5cf6"};color:#090b0f;">${b}</span>`)
              .join("");
            return `<div style="font-size:11px;line-height:1.35;padding:2px 0;word-break:break-word;">${bHtml}<strong style="color:${esc(m.color)};">${esc(m.user)}:</strong> <span style="color:#f1f5f9;">${esc(m.text)}</span></div>`;
          })
          .join("")
      : `<div style="font-size:10.5px;color:rgba(255,255,255,0.45);padding:6px 0;">${this.channel ? "Esperando mensajes del chat de Twitch..." : "Configura tu canal de Twitch para ver el chat en vivo en el cockpit (0 API keys)."}</div>`;

    this.container.innerHTML = `
      <div style="width:290px;padding:8px 10px;border-radius:8px;background:rgba(9,11,15,0.82);border:1px solid rgba(255,255,255,0.12);font-family:Inter,system-ui,sans-serif;backdrop-filter:blur(6px);">
        <div style="display:flex;justify-content:space-between;align-items:center;font-size:9.5px;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;padding-bottom:5px;margin-bottom:5px;border-bottom:1px solid rgba(255,255,255,0.08);">
          <span style="color:#a78bfa;">TWITCH CHAT</span>
          ${statusDot}
        </div>
        <div style="display:flex;flex-direction:column;gap:2px;">${rows}</div>
      </div>
    `;
  }
}
