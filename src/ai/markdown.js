import { Marked } from "marked";
import DOMPurify from "dompurify";

const marked = new Marked({ gfm: true, breaks: false });

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[char]));
}

function safeUrl(href) {
  const value = String(href || "").trim();
  if (/^(https?:|mailto:)/i.test(value)) return value;
  if (value.startsWith("/") && !value.startsWith("//") && !value.startsWith("/\\")) return value;
  return "";
}

marked.use({
  renderer: {
    html() {
      return "";
    },
    link({ href, title, tokens }) {
      const text = this.parser.parseInline(tokens);
      const safe = safeUrl(href);
      if (!safe) return text;
      const titleAttr = title ? ` title="${escapeHtml(title)}"` : "";
      const external = /^https?:/i.test(safe) ? ' target="_blank" rel="noopener noreferrer"' : "";
      return `<a href="${escapeHtml(safe)}"${titleAttr}${external}>${text}</a>`;
    },
    code({ text, lang }) {
      const language = String(lang || "").match(/^[A-Za-z0-9_+-]{0,24}/)?.[0] || "";
      const cls = language ? ` class="language-${escapeHtml(language)}"` : "";
      return `<pre class="ai-pre"><code${cls}>${escapeHtml(text)}</code></pre>\n`;
    },
  },
});

/** Close an unfinished fence so a partial code block still renders as code. */
export function stabilizeMarkdown(src) {
  const text = String(src || "").replace(/\r\n/g, "\n");
  const fences = text.match(/```/g);
  if (fences && fences.length % 2 === 1) return `${text}\n\`\`\``;
  return text;
}

function decorate(root, labels) {
  root.querySelectorAll("a[href]").forEach((link) => {
    const href = link.getAttribute("href") || "";
    if (!safeUrl(href)) {
      link.removeAttribute("href");
      return;
    }
    if (/^https?:/i.test(href)) {
      link.setAttribute("target", "_blank");
      link.setAttribute("rel", "noopener noreferrer");
    }
  });
  root.querySelectorAll("table").forEach((table) => {
    const wrap = document.createElement("div");
    wrap.className = "ai-table";
    wrap.tabIndex = 0;
    wrap.setAttribute("role", "region");
    wrap.setAttribute("aria-label", labels.table || "Tabla");
    table.parentNode.insertBefore(wrap, table);
    wrap.appendChild(table);
  });
  root.querySelectorAll("pre.ai-pre").forEach((pre) => {
    const wrap = document.createElement("div");
    wrap.className = "ai-code";
    const button = document.createElement("button");
    button.type = "button";
    button.className = "ai-codecopy";
    button.textContent = labels.copy || "Copiar";
    button.setAttribute("aria-label", labels.copyCode || "Copiar código");
    pre.parentNode.insertBefore(wrap, pre);
    wrap.appendChild(button);
    wrap.appendChild(pre);
  });
}

export function renderMarkdown(src, labels = {}) {
  const fallback = document.createElement("div");
  fallback.className = "ai-md";
  const plain = document.createElement("pre");
  plain.className = "ai-plain";
  plain.textContent = String(src || "");
  if (!DOMPurify.isSupported) {
    fallback.appendChild(plain);
    return fallback;
  }
  const html = marked.parse(stabilizeMarkdown(src));
  const clean = DOMPurify.sanitize(String(html), {
    USE_PROFILES: { html: true },
    ADD_ATTR: ["target", "rel", "class"],
    FORBID_TAGS: ["style", "iframe", "object", "embed", "form", "input", "textarea", "button", "script", "svg", "math"],
    FORBID_ATTR: ["style"],
  });
  fallback.innerHTML = clean;
  decorate(fallback, labels);
  return fallback;
}
