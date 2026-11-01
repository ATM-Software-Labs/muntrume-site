/**
 * Muntrume Motorsport · plantillas de correo transaccional (HTML responsive + texto plano).
 * Todas las variables se escapan antes de insertarse en el HTML.
 */

const SITE = "https://muntru.me";
const LOGO = `${SITE}/assets/img/email-logo.png`; // 68x68 PNG (2x), ~5 KB

export function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function firstName(name) {
  const n = String(name || "").trim();
  return n ? n.split(/\s+/)[0] : "piloto";
}

/** Saludo según la hora local del piloto (zona guardada en sus preferencias; por defecto Madrid). */
export function greeting(name, tz) {
  let h = 12;
  try { h = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hourCycle: "h23", timeZone: tz || "Europe/Madrid" }).format(new Date())); } catch {}
  const g = h >= 6 && h < 14 ? "Buenos días" : h >= 14 && h < 21 ? "Buenas tardes" : "Buenas noches";
  return `${g}, ${firstName(name)}`;
}
const hello = (name, tz) => P(`${escapeHtml(greeting(name, tz))}:`);

/**
 * Layout base (Turno 7): una sola plantilla para todos los correos.
 * Tabla centrada de 560px, compatible con Gmail/Outlook/Apple Mail, legible en modo claro y oscuro,
 * sin píxeles de seguimiento ni recursos externos salvo el logo (PNG pequeño servido desde muntru.me).
 */
const SECURITY_NOTE = "Si no fuiste tú, ignora este correo: no se ha hecho ningún cambio en tu cuenta.";
const FONT = "Inter,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif";
function layout({ preheader, title, bodyHtml, cta, footerNote, securityNote = true, manageUrl, unsubUrl, jsonLd, tldr }) {
  const tldrHtml = tldrBox(tldr);
  const ld = (Array.isArray(jsonLd) ? jsonLd : jsonLd ? [jsonLd] : []).map((o) => `<script type="application/ld+json">${JSON.stringify({ "@context": "http://schema.org", ...o }).replace(/</g, "\\u003c")}</script>`).join("\n");
  const ctaHtml = cta
    ? `<tr><td align="center" class="px" style="padding:6px 32px 26px 32px;">
        <!--[if mso]><v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${escapeHtml(cta.url)}" style="height:48px;v-text-anchor:middle;width:280px;" arcsize="20%" stroke="f" fillcolor="#10b981"><w:anchorlock/><center style="color:#04241a;font-family:Arial,sans-serif;font-size:15px;font-weight:bold;">${escapeHtml(cta.label)}</center></v:roundrect><![endif]-->
        <!--[if !mso]><!-- --><table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr>
          <td align="center" bgcolor="#10b981" class="btn" style="border-radius:10px;">
            <a href="${escapeHtml(cta.url)}" target="_blank" rel="noopener" class="btn-a" style="display:inline-block;min-width:200px;padding:14px 30px;font-family:${FONT};font-size:16px;line-height:20px;font-weight:700;color:#04241a;text-decoration:none;border-radius:10px;mso-padding-alt:0;">${escapeHtml(cta.label)}</a>
          </td></tr></table><!--<![endif]-->
        ${cta.hint ? `<p class="muted" style="margin:14px 0 0 0;font-family:${FONT};font-size:13px;line-height:19px;color:#64748b;">${cta.hint}</p>` : ""}
      </td></tr>`
    : "";
  const notes = [footerNote, securityNote ? escapeHtml(SECURITY_NOTE) : ""].filter(Boolean)
    .map((n) => `<p style="margin:0 0 8px 0;">${n}</p>`).join("");

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>${escapeHtml(title)}</title>
${ld}
<style>
  @media only screen and (max-width:600px){
    .container{width:100% !important;}
    .px{padding-left:20px !important;padding-right:20px !important;}
    .h1{font-size:20px !important;line-height:27px !important;}
    .code{font-size:26px !important;letter-spacing:5px !important;padding:12px 16px !important;}
  }
  @media (prefers-color-scheme: dark){
    .bg{background-color:#0b0e14 !important;}
    .card{background-color:#141922 !important;border-color:#232a35 !important;}
    .h1,.ink{color:#f1f5f9 !important;}
    .body p,.body td{color:#cbd5e1 !important;}
    .muted,.muted p{color:#94a3b8 !important;}
    .box{background-color:#0f141b !important;border-color:#232a35 !important;}
    .code{background-color:#0f141b !important;color:#34d399 !important;border-color:#1f6f52 !important;}
    .sep{border-color:#232a35 !important;}
    .lnk{color:#34d399 !important;}
  }
  /* Outlook.com / Outlook apps en modo oscuro */
  [data-ogsc] .h1,[data-ogsc] .ink{color:#f1f5f9 !important;}
  [data-ogsc] .body p{color:#cbd5e1 !important;}
  [data-ogsc] .lnk{color:#34d399 !important;}
  a[x-apple-data-detectors]{color:inherit !important;text-decoration:none !important;}
</style>
</head>
<body class="bg" style="margin:0;padding:0;background-color:#eef2f5;-webkit-text-size-adjust:100%;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;mso-hide:all;">${escapeHtml(preheader)}&#8199;&#847;&#8199;&#847;&#8199;&#847;</div>
<div role="article" aria-roledescription="email" aria-label="${escapeHtml(title)}" lang="es">
<table role="presentation" class="bg" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#eef2f5">
<tr><td align="center" style="padding:24px 12px;">
  <table role="presentation" class="container card" width="560" cellspacing="0" cellpadding="0" border="0" style="width:560px;max-width:560px;background-color:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #dfe5eb;">
    <tr><td bgcolor="#0b0e14" style="padding:20px 32px;background-color:#0b0e14;" class="px">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr>
        <td width="46" valign="middle"><img src="${LOGO}" width="34" height="34" alt="Muntrume" style="display:block;border:0;outline:none;"></td>
        <td valign="middle" style="font-family:${FONT};">
          <div style="font-size:15px;font-weight:800;letter-spacing:0.6px;color:#ffffff;">MUNTRUME MOTORSPORT</div>
          <div style="font-size:12px;color:#34d399;font-weight:600;">Setup Vault · muntru.me</div>
        </td>
      </tr></table>
    </td></tr>
    <tr><td style="height:4px;line-height:4px;font-size:0;background-color:#10b981;">&nbsp;</td></tr>
    ${unsubUrl ? `<tr><td class="px muted" align="right" style="padding:10px 32px 0 32px;font-family:${FONT};font-size:12px;line-height:18px;color:#64748b;">¿No quieres estos avisos? <a href="${escapeHtml(unsubUrl)}" target="_blank" rel="noopener" class="lnk" style="color:#047857;font-weight:700;text-decoration:underline;">Darme de baja</a></td></tr>` : ""}
    <tr><td class="px body" style="padding:30px 32px 6px 32px;font-family:${FONT};color:#0f172a;">
      <h1 class="h1" style="margin:0 0 14px 0;font-size:22px;line-height:29px;font-weight:800;color:#0f172a;">${escapeHtml(title)}</h1>
      ${tldrHtml}
      ${bodyHtml}
    </td></tr>
    ${ctaHtml}
    ${unsubUrl ? `<tr><td class="px" style="padding:0 32px 22px 32px;font-family:${FONT};">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" class="box" style="background-color:#f6f8fa;border:1px solid #e5eaef;border-radius:12px;">
        <tr><td style="padding:16px;">
          <p class="ink" style="margin:0 0 4px 0;font-size:15px;line-height:21px;font-weight:700;color:#0f172a;">¿Demasiados correos?</p>
          <p class="muted" style="margin:0 0 14px 0;font-size:13px;line-height:19px;color:#64748b;">Un toque y no vuelves a recibir este tipo de aviso. Los correos de seguridad (códigos de acceso) se siguen enviando.</p>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr>
            <td align="center" bgcolor="#ffffff" style="border:2px solid #dc2626;border-radius:10px;"><a href="${escapeHtml(unsubUrl)}" target="_blank" rel="noopener" style="display:block;padding:14px 18px;font-size:16px;line-height:20px;font-weight:800;color:#b91c1c;text-decoration:none;border-radius:10px;">Darme de baja con un toque</a></td>
          </tr></table>
          ${manageUrl ? `<p style="margin:12px 0 0 0;text-align:center;font-size:13px;line-height:19px;"><a href="${escapeHtml(manageUrl)}" target="_blank" rel="noopener" class="lnk" style="color:#047857;font-weight:700;text-decoration:underline;">O elige qué avisos recibir</a></p>` : ""}
        </td></tr>
      </table>
    </td></tr>` : ""}
    <tr><td class="px muted sep" style="padding:18px 32px 24px 32px;border-top:1px solid #eef2f5;font-family:${FONT};font-size:12px;line-height:18px;color:#64748b;">
      ${notes}
      <p style="margin:0;">Muntrume Motorsport · Barcelona · <a href="${SITE}" class="lnk" style="color:#047857;text-decoration:underline;">muntru.me</a></p>
      ${manageUrl || unsubUrl ? `<p style="margin:8px 0 0 0;">${[
        manageUrl ? `<a href="${escapeHtml(manageUrl)}" class="lnk" style="color:#047857;text-decoration:underline;">Gestionar notificaciones</a>` : "",
        unsubUrl ? `<a href="${escapeHtml(unsubUrl)}" class="lnk" style="color:#047857;text-decoration:underline;">Darse de baja de estos correos</a>` : "",
      ].filter(Boolean).join(" · ")}</p>` : ""}
    </td></tr>
  </table>
</td></tr>
</table>
</div>
</body>
</html>`;
}

/** Resumen corto (2-3 frases) al principio del correo, en texto llano. */
function tldrBox(tldr) {
  const t = Array.isArray(tldr) ? tldr.filter(Boolean).join(" ") : String(tldr || "");
  if (!t) return "";
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 16px 0;"><tr><td class="box" style="padding:12px 14px;background-color:#ecfdf5;border-left:4px solid #10b981;border-radius:8px;font-size:14px;line-height:21px;color:#065f46;"><strong>En resumen:</strong> ${escapeHtml(t)}</td></tr></table>`;
}
const tldrText = (tldr) => { const t = Array.isArray(tldr) ? tldr.filter(Boolean).join(" ") : String(tldr || ""); return t ? `En resumen: ${t}\n\n` : ""; };

/** Bloque grande con el código de un solo uso. */
function codeBox(code) {
  const spaced = escapeHtml(String(code));
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:6px 0 18px 0;"><tr><td align="center">
    <div class="code" style="display:inline-block;padding:14px 26px;border:1px solid #a7f3d0;background-color:#ecfdf5;border-radius:12px;font-family:'SF Mono',Menlo,Consolas,monospace;font-size:32px;line-height:38px;font-weight:800;letter-spacing:8px;white-space:nowrap;color:#065f46;">${spaced}</div>
  </td></tr></table>`;
}

const P = (html) => `<p style="margin:0 0 14px 0;font-size:15px;line-height:23px;color:#334155;">${html}</p>`;

function infoBox(rows) {
  const tr = rows
    .filter(([, v]) => v !== undefined && v !== null && String(v).trim() !== "")
    .map(([k, v]) => `<tr>
      <td style="padding:6px 0;font-size:12px;color:#64748b;font-weight:600;text-transform:uppercase;letter-spacing:0.4px;width:140px;vertical-align:top;">${escapeHtml(k)}</td>
      <td style="padding:6px 0;font-size:14px;color:#0f172a;vertical-align:top;word-break:break-word;">${escapeHtml(v)}</td></tr>`)
    .join("");
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f6f8fa;border:1px solid #e5eaef;border-radius:12px;margin:4px 0 18px 0;" class="box"><tr><td style="padding:12px 16px;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">${tr}</table></td></tr></table>`;
}

const textFooterFor = (manageUrl, unsubUrl) => `\n\nSi no fuiste tú, ignora este correo: no se ha hecho ningún cambio en tu cuenta.\n--\nMuntrume Motorsport · ${SITE}\n${manageUrl ? `Gestionar notificaciones: ${manageUrl}\n` : ""}${unsubUrl ? `Darse de baja: ${unsubUrl}\n` : ""}`;
const textFooter = textFooterFor();

/** 1) Confirmación al piloto: solicitud recibida */
export function requestReceivedEmail({ name }) {
  const subject = "Hemos recibido tu solicitud · Muntrume Setup Vault";
  const html = layout({
    preheader: "Control de Carrera revisará tu solicitud y te avisaremos por correo.",
    title: "Solicitud recibida",
    bodyHtml:
      P(`Hola ${escapeHtml(firstName(name))},`) +
      P("Gracias por querer unirte al Setup Vault de Muntrume Motorsport. Hemos recibido tu solicitud y Control de Carrera la revisará personalmente.") +
      P("Te escribiremos a este correo en cuanto haya una decisión. Si se aprueba, recibirás un enlace seguro para crear tu contraseña; nunca te pediremos que nos la envíes."),
  });
  const text = `Hola ${firstName(name)},

Gracias por querer unirte al Setup Vault de Muntrume Motorsport. Hemos recibido tu solicitud y Control de Carrera la revisará personalmente.

Te escribiremos a este correo en cuanto haya una decisión. Si se aprueba, recibirás un enlace seguro para crear tu contraseña; nunca te pediremos que nos la envíes.${textFooter}`;
  return { subject, html, text };
}

/** 2) Aviso interno a Control de Carrera: nueva solicitud */
export function adminNewRequestEmail({ name, email, iracing_id, car_category, message }) {
  const subject = `Nueva solicitud de piloto: ${String(name).slice(0, 60)}`;
  const html = layout({
    preheader: `${name} (${email}) ha solicitado acceso al Setup Vault.`,
    title: "Nueva solicitud de acceso",
    bodyHtml:
      P("Un piloto ha solicitado acceso al Setup Vault:") +
      infoBox([
        ["Piloto", name],
        ["Correo", email],
        ["iRacing ID", iracing_id || "—"],
        ["Categoría", car_category || "—"],
        ["Mensaje", message || "—"],
      ]) +
      P("Revísala en el panel de Race Control para aprobarla o rechazarla."),
    cta: { url: `${SITE}/setups#admin`, label: "Abrir Race Control" },
    securityNote: false,
  });
  const text = `Nueva solicitud de acceso al Setup Vault

Piloto: ${name}
Correo: ${email}
iRacing ID: ${iracing_id || "—"}
Categoría: ${car_category || "—"}
Mensaje: ${message || "—"}

Revísala en Race Control: ${SITE}/setups#admin
--
Muntrume Motorsport · ${SITE}
`;
  return { subject, html, text };
}

/** 3a) Aprobado · con enlace para crear contraseña (método recomendado) */
export function approvedLinkEmail({ name, email, link, expiresHours, tz, manageUrl }) {
  const subject = "Acceso aprobado · Crea tu contraseña del Setup Vault";
  const html = layout({
    manageUrl,
    preheader: `Tu acceso está aprobado. El enlace caduca en ${expiresHours} horas.`,
    title: "¡Bienvenido al equipo!",
    jsonLd: { "@type": "EmailMessage", description: "Crea tu contraseña del Setup Vault", potentialAction: { "@type": "ViewAction", url: link, target: link, name: "Crear contraseña" }, publisher: { "@type": "Organization", name: "Muntrume Motorsport", url: SITE } },
    bodyHtml:
      hello(name, tz) +
      P("Control de Carrera ha aprobado tu solicitud. Ya tienes acceso al Setup Vault de Muntrume Motorsport.") +
      infoBox([["Usuario", email], ["Acceso", `${SITE}/setups`]]) +
      P("Para entrar, crea tu contraseña personal con el botón de abajo:"),
    cta: {
      url: link,
      label: "Crear mi contraseña",
      hint: `El enlace es personal, de un solo uso y caduca en ${expiresHours} horas. Si caduca, usa «¿Olvidaste tu contraseña?» en ${SITE}/setups.`,
    },
    footerNote: "Consejo: una vez dentro, usa «Vincular carpeta iRacing» para guardar los setups directamente en Documents\\iRacing\\setups.",
  });
  const text = `${greeting(name, tz)}:

Control de Carrera ha aprobado tu solicitud. Ya tienes acceso al Setup Vault de Muntrume Motorsport.

Usuario: ${email}

Crea tu contraseña personal aquí (enlace personal, de un solo uso, caduca en ${expiresHours} horas):
${link}

Si el enlace caduca, usa «¿Olvidaste tu contraseña?» en ${SITE}/setups.${textFooterFor(manageUrl)}`;
  return { subject, html, text };
}

/** 3b) Aprobado · con contraseña temporal (solo si el admin lo elige explícitamente) */
export function approvedTempPasswordEmail({ name, email, tempPassword, tz, manageUrl }) {
  const subject = "Acceso aprobado · Tu contraseña temporal del Setup Vault";
  const html = layout({
    manageUrl,
    preheader: "Tu acceso está aprobado. Tendrás que cambiar la contraseña en el primer inicio de sesión.",
    title: "¡Bienvenido al equipo!",
    bodyHtml:
      hello(name, tz) +
      P("Control de Carrera ha aprobado tu solicitud. Estas son tus credenciales de acceso:") +
      infoBox([["Usuario", email], ["Contraseña temporal", tempPassword]]) +
      P("En tu primer acceso el sistema te pedirá elegir una contraseña personal. La temporal deja de funcionar en cuanto la cambies."),
    cta: { url: `${SITE}/setups`, label: "Entrar al Setup Vault" },
    footerNote: "Por seguridad, borra este correo después de cambiar la contraseña.",
  });
  const text = `${greeting(name, tz)}:

Control de Carrera ha aprobado tu solicitud. Estas son tus credenciales de acceso:

Usuario: ${email}
Contraseña temporal: ${tempPassword}

Entra en ${SITE}/setups. En tu primer acceso tendrás que elegir una contraseña personal.
Por seguridad, borra este correo después de cambiarla.${textFooterFor(manageUrl)}`;
  return { subject, html, text };
}

/** 4) Rechazado */
export function rejectedEmail({ name, reason }) {
  const subject = "Sobre tu solicitud al Setup Vault de Muntrume";
  const html = layout({
    preheader: "Gracias por tu interés en Muntrume Motorsport.",
    title: "Gracias por tu solicitud",
    bodyHtml:
      P(`Hola ${escapeHtml(firstName(name))},`) +
      P("Gracias por tu interés en Muntrume Motorsport. Hemos revisado tu solicitud y, por ahora, no podemos darte acceso al Setup Vault.") +
      (reason ? infoBox([["Comentario", reason]]) : "") +
      P("Puedes volver a solicitarlo más adelante o escribirnos desde la web si tienes cualquier duda."),
    cta: { url: `${SITE}/contact`, label: "Contactar con el equipo" },
    securityNote: false,
  });
  const text = `Hola ${firstName(name)},

Gracias por tu interés en Muntrume Motorsport. Hemos revisado tu solicitud y, por ahora, no podemos darte acceso al Setup Vault.
${reason ? `\nComentario: ${reason}\n` : ""}
Puedes volver a solicitarlo más adelante o escribirnos desde ${SITE}/contact.
--
Muntrume Motorsport · ${SITE}
`;
  return { subject, html, text };
}

/** 5) Restablecer / crear contraseña (olvidé mi contraseña o primer acceso) */
export function resetPasswordEmail({ name, link, expiresMinutes, tz, manageUrl }) {
  const subject = "Restablece tu contraseña · Muntrume Setup Vault";
  const html = layout({
    manageUrl,
    preheader: `Enlace para crear una nueva contraseña. Caduca en ${expiresMinutes} minutos.`,
    title: "Restablecer contraseña",
    jsonLd: { "@type": "EmailMessage", description: "Restablece tu contraseña del Setup Vault", potentialAction: { "@type": "ViewAction", url: link, target: link, name: "Crear contraseña" }, publisher: { "@type": "Organization", name: "Muntrume Motorsport", url: SITE } },
    bodyHtml:
      hello(name, tz) +
      P("Hemos recibido una petición para crear o restablecer la contraseña de tu cuenta del Setup Vault."),
    cta: {
      url: link,
      label: "Crear nueva contraseña",
      hint: `El enlace es de un solo uso y caduca en ${expiresMinutes} minutos.`,
    },
    footerNote: "Tu contraseña actual no cambia hasta que elijas una nueva.",
  });
  const text = `${greeting(name, tz)}:

Hemos recibido una petición para crear o restablecer la contraseña de tu cuenta del Setup Vault.

Crea tu nueva contraseña aquí (un solo uso, caduca en ${expiresMinutes} minutos):
${link}
Tu contraseña actual no cambia hasta que elijas una nueva.${textFooterFor(manageUrl)}`;
  return { subject, html, text };
}

/** 6) Formulario de contacto → buzón del equipo */
export function contactFormEmail({ name, email, type, subject, message, to, receivedAt }) {
  const oneLine = (v, n) => String(v ?? "").replace(/[\r\n]+/g, " ").slice(0, n);
  const subj = `[muntru.me · ${oneLine(type || "General", 40)}] ${oneLine(subject || `Mensaje de ${name}`, 120)}`;
  const when = (receivedAt || new Date()).toLocaleString("es-ES", { timeZone: "Europe/Madrid", dateStyle: "medium", timeStyle: "short" }) + " (hora de Madrid)";
  const replyUrl = `mailto:${encodeURIComponent(email).replace(/%40/g, "@")}?subject=${encodeURIComponent(`Re: ${oneLine(subject, 120)}`)}`;
  const html = layout({
    preheader: `${oneLine(name, 60)} te ha escrito desde muntru.me: ${oneLine(subject, 80)}`,
    title: "Nuevo mensaje desde muntru.me",
    bodyHtml:
      infoBox([
        ["Nombre", name],
        ["Correo", email],
        ["Tipo", type || "General"],
        ["Asunto", subject || "Sin asunto"],
        ["Recibido", when],
      ]) +
      `<div style="margin:0 0 18px 0;padding:14px 16px;border-left:4px solid #10b981;background:#f6f8fa;border-radius:8px;font-size:14px;line-height:22px;color:#0f172a;white-space:pre-wrap;word-break:break-word;">${escapeHtml(message)}</div>` +
      `<p style="margin:0 0 6px 0;font-size:13px;line-height:20px;color:#64748b;">Pulsa «Responder» en tu correo: la respuesta irá directamente a ${escapeHtml(email)}.</p>`,
    cta: { url: replyUrl, label: `Responder a ${oneLine(name, 40)}` },
    securityNote: false,
    footerNote: `Enviado a ${escapeHtml(to)} desde el formulario de contacto de muntru.me. El remitente no ha verificado su dirección: no compartas datos sensibles sin confirmarla.`,
  });
  const text = `Nuevo mensaje desde muntru.me

Nombre: ${name}
Correo: ${email}
Tipo: ${type || "General"}
Asunto: ${subject || "Sin asunto"}
Recibido: ${when}

${message}

(Responde a este correo para contestar directamente a ${email}.)
--
Muntrume Motorsport · ${SITE}
`;
  return { subject: subj, html, text };
}

/** 7) Código de acceso de un solo uso (+ enlace mágico opcional) */
export function loginCodeEmail({ name, code, link, expiresMinutes, tz, manageUrl }) {
  const subject = `${code} es tu código de acceso · Muntrume Setup Vault`;
  const html = layout({
    manageUrl,
    preheader: `Tu código de acceso es ${code}. Caduca en ${expiresMinutes} minutos.`,
    title: "Tu código de acceso",
    jsonLd: link ? { "@type": "EmailMessage", description: `Código de acceso ${code}`, potentialAction: { "@type": "ViewAction", url: link, target: link, name: "Entrar" }, publisher: { "@type": "Organization", name: "Muntrume Motorsport", url: SITE } } : null,
    bodyHtml:
      hello(name, tz) +
      P("Usa este código para entrar en el Setup Vault. Es de un solo uso:") +
      codeBox(code) +
      (link ? P("O entra directamente desde este dispositivo con el botón:") : ""),
    cta: link ? { url: link, label: "Entrar al Setup Vault", hint: `El código y el enlace caducan en ${expiresMinutes} minutos y solo funcionan una vez. Nunca te pediremos este código por teléfono ni por chat.` } : null,
  });
  const text = `${greeting(name, tz)}:

Tu código de acceso al Setup Vault es:\n\n    ${code}\n\n(Código de verificación de Muntrume: ${code})
${link ? `\nO entra directamente con este enlace:\n${link}\n` : ""}
El código${link ? " y el enlace" : ""} caducan en ${expiresMinutes} minutos y solo funcionan una vez. Nunca te pediremos este código por teléfono ni por chat.${textFooterFor(manageUrl)}`;
  return { subject, html, text };
}

// Nombres legibles de los coches (copiado de assets/js/setups.js; mantener sincronizado).
export const CAR_LABELS = {
  "acuraarx06gtp": "Acura ARX-06 GTP",
  "acuransxevo22gt3": "Acura NSX EVO22 GT3",
  "amvalkyriegtp": "Aston Martin Valkyrie GTP",
  "amvantageevogt3": "Aston Martin Vantage EVO GT3",
  "amvantagegt4": "Aston Martin Vantage GT4",
  "astonmartin dbr9": "Aston Martin DBR9 GT1",
  "audi90gto": "Audi 90 GTO",
  "audir8lmsevo2gt3": "Audi R8 LMS EVO II GT3",
  "audirs3lmsgen2": "Audi RS 3 LMS Gen 2 TCR",
  "bmwlmdh": "BMW M Hybrid V8 GTP",
  "bmwm2csr": "BMW M2 CS Racing",
  "bmwm2g87": "BMW M2 CS (G87)",
  "bmwm4evogt4": "BMW M4 EVO GT4",
  "bmwm4gt3": "BMW M4 GT3",
  "bmwm8gte": "BMW M8 GTE",
  "c6r": "Corvette C6.R GT1",
  "c8rvettegte": "Corvette C8.R GTE",
  "cadillacvseriesrgtp": "Cadillac V-Series.R GTP",
  "caterham caterham420r": "Caterham Seven 420R",
  "caterham caterhamacademy": "Caterham Academy",
  "chevyvettez06rgt3": "Corvette Z06 GT3.R",
  "dallaraf3": "Dallara F3",
  "dallarair18": "Dallara IR-18 Indycar",
  "dallarap217": "Dallara P217 LMP2",
  "ferrari296gt3": "Ferrari 296 GT3",
  "ferrari488gte": "Ferrari 488 GTE",
  "ferrari499p": "Ferrari 499P Hypercar",
  "fordgt": "Ford GT GT2",
  "fordgt2017": "Ford GT GTE 2017",
  "fordmustanggt3": "Ford Mustang GT3",
  "fordmustanggt4": "Ford Mustang GT4",
  "formulair04": "FIA Formula 4 (iR-04)",
  "formulavee": "Formula Vee",
  "formulavee formulavee2": "Formula Vee Spec 2",
  "formulavee formulavee3": "Formula Vee Spec 3",
  "hondacivictyper": "Honda Civic Type R TCR",
  "hpdarx01c": "HPD ARX-01c LMP2",
  "hyundaielantracn7": "Hyundai Elantra N TCR",
  "hyundaivelostern": "Hyundai Veloster N TCR",
  "lamborghinievogt3": "Lamborghini Huracán EVO GT3",
  "ligierjsp320": "Ligier JS P320 LMP3",
  "mclaren570sgt4": "McLaren 570S GT4",
  "mclaren720sgt3": "McLaren 720S GT3",
  "mercedesamgevogt3": "Mercedes-AMG GT3 EVO",
  "mercedesamggt4": "Mercedes-AMG GT4",
  "ministock": "Mini Stock",
  "mx5 cup": "Mazda MX-5 Cup",
  "mx5 mx52016": "Global Mazda MX-5 2016",
  "nissangtpzxt": "Nissan GTP ZX-T",
  "porsche718gt4": "Porsche 718 Cayman GT4",
  "porsche963gtp": "Porsche 963 GTP",
  "porsche991rsr": "Porsche 991 RSR GTE",
  "porsche9922cup": "Porsche 992 Cup (2.0)",
  "porsche992rgt3": "Porsche 992 GT3 R",
  "raygr22": "Ray FF1600 (GR22)",
  "renaultcliocup": "Renault Clio Cup",
  "specracer": "SCCA Spec Racer Ford",
  "stockcars2 mustang2019": "NASCAR Cup Mustang 2019",
  "supercars fordmustanggen3": "Supercars Mustang Gen3",
  "superformulalights324": "Super Formula Lights 324",
  "superformulasf23 honda": "Super Formula SF23 Honda",
  "superformulasf23 toyota": "Super Formula SF23 Toyota",
  "toyotagr86": "Toyota GR86",
  "trucks silverado": "NASCAR Craftsman Truck Silverado",
  "trucks toyotatundra2022": "NASCAR Craftsman Truck Tundra",
  "mercedesw13": "Mercedes-AMG F1 W13 E Performance"
};
const carLabel = (id) => CAR_LABELS[id] || id;
const refLabel = (ref) => { const s = String(ref || ""); if (CAR_LABELS[s]) return `${CAR_LABELS[s]} · todos los setups`; const m = s.match(/^([^/ ]+)(\/| · )(.*)$/); if (!m) return s; const rest = m[3].replace(/^\d\dS\d\//, ""); return `${carLabel(m[1])} · ${rest}`; };

/** Fila de cifras (solo datos reales que se pasan). */
function kpiRow(items) {
  const cells = items.filter(([v]) => v && v !== "undefined").slice(0, 3).map(([v, l]) => `<td class="box" width="${Math.floor(100 / Math.min(3, items.length))}%" style="padding:12px 10px;background-color:#f6f8fa;border:1px solid #e5eaef;border-radius:10px;text-align:center;">
      <div style="font-size:20px;line-height:24px;font-weight:800;color:#047857;" class="lnk">${escapeHtml(v)}</div>
      <div class="muted" style="font-size:12px;line-height:16px;color:#64748b;">${escapeHtml(l)}</div></td>`);
  if (!cells.length) return "";
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:4px 0 18px 0;border-collapse:separate;border-spacing:6px 0;"><tr>${cells.join("")}</tr></table>`;
}

/** Tabla simple (filas de texto) con estilo de la plantilla. */
function listBox(head, rows) {
  if (!rows.length) return "";
  const tr = rows.map(([a, b]) => `<tr>
      <td class="ink" style="padding:9px 0;border-bottom:1px solid #e5eaef;font-size:14px;line-height:20px;color:#0f172a;font-weight:600;word-break:break-word;">${escapeHtml(a)}</td>
      <td align="right" style="padding:9px 0 9px 12px;border-bottom:1px solid #e5eaef;font-size:13px;line-height:20px;color:#047857;font-weight:700;white-space:nowrap;">${escapeHtml(b)}</td></tr>`).join("");
  return `<p class="muted" style="margin:6px 0 6px 0;font-size:12px;line-height:18px;color:#64748b;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">${escapeHtml(head)}</p>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" class="box" style="margin:0 0 18px 0;">${tr}</table>`;
}

/**
 * 8) Novedades del Setup Vault (correo NO esencial → lleva List-Unsubscribe y enlace visible de baja).
 * Todo el contenido sale de datos reales de D1 (setups/descargas del piloto); si no hay datos, se omite la sección.
 */
export function setupDigestEmail({ name, tz, team, carClass, season, seasonTotal, forYou = [], topCars = [], recent = [], events = [], manageUrl, unsubUrl }) {
  const nCars = forYou.length;
  const subject = nCars
    ? `${firstName(name)}, hay setups de ${season} ${nCars === 1 ? `para tu ${carLabel(forYou[0].car)}` : `para tus ${nCars} coches`} · Muntrume`
    : `${firstName(name)}, novedades del Setup Vault (${season})`;
  const fmt = (iso) => { try { return new Date(String(iso).replace(" ", "T") + (/[zZ]|[+-]\d\d:?\d\d$/.test(iso) ? "" : "Z")).toLocaleDateString("es-ES", { timeZone: tz || "Europe/Madrid", day: "numeric", month: "short" }); } catch { return ""; } };
  const profile = [team, carClass].filter(Boolean).join(" · ");
  const tldr = [
    nCars ? `Hay setups de ${season} para ${nCars === 1 ? `tu ${carLabel(forYou[0].car)}` : `${nCars} de tus coches`}.` : `El Vault tiene ${seasonTotal} setups de la temporada ${season}.`,
    topCars.length && !nCars ? `El coche con más setups es el ${carLabel(topCars[0].car)} (${topCars[0].n}).` : "",
    events.length ? `Próximo evento del equipo: ${events[0].title}, el ${fmtEventDate(events[0].starts_at, tz)}.` : "",
  ].filter(Boolean);
  const html = layout({
    manageUrl, unsubUrl, securityNote: false, tldr,
    preheader: nCars ? `${forYou.map((c) => carLabel(c.car)).slice(0, 3).join(", ")}: setups de ${season} listos para descargar.` : `${seasonTotal} setups de ${season} en el Vault.`,
    title: "Novedades del Setup Vault",
    jsonLd: [{ "@type": "EmailMessage", description: `Setups de ${season} en el Setup Vault`, potentialAction: { "@type": "ViewAction", url: `${SITE}/setups`, target: `${SITE}/setups`, name: "Abrir el Vault" }, publisher: { "@type": "Organization", name: "Muntrume Motorsport", url: SITE } }, ...eventsLd(events)],
    bodyHtml:
      hello(name, tz) +
      (profile ? `<p class="muted" style="margin:-6px 0 14px 0;font-size:13px;line-height:19px;color:#64748b;">${escapeHtml(profile)}</p>` : "") +
      P(nCars
        ? `Esta temporada (${escapeHtml(season)}) hay setups para los coches que sueles descargar:`
        : `El Vault tiene <strong>${escapeHtml(seasonTotal)}</strong> setups de la temporada ${escapeHtml(season)}. Estos son los coches con más setups:`) +
      kpiRow([[String(seasonTotal ?? "—"), `setups ${season}`], ...(nCars ? [[String(nCars), nCars === 1 ? "coche tuyo con setups" : "coches tuyos con setups"]] : [])]) +
      listBox(nCars ? "Para tus coches" : "Más setups esta temporada", (nCars ? forYou : topCars).map((c) => [carLabel(c.car), `${c.n} setups`])) +
      listBox("Tus últimas descargas", recent.slice(0, 3).map((r) => [refLabel(r.ref), fmt(r.at)])) +
      eventsBlock(events, tz),
    cta: { url: `${SITE}/setups`, label: "Abrir el Setup Vault" },
    footerNote: "Recibes este correo porque eres piloto del Setup Vault de Muntrume Motorsport. Puedes elegir qué avisos recibir o darte de baja con un clic.",
  });
  const rows = (nCars ? forYou : topCars).map((c) => `- ${carLabel(c.car)}: ${c.n} setups`).join("\n");
  const rec = recent.slice(0, 3).map((r) => `- ${refLabel(r.ref)} (${fmt(r.at)})`).join("\n");
  const text = `${tldrText(tldr)}${greeting(name, tz)}:
${profile ? `${profile}\n` : ""}
${nCars ? `Esta temporada (${season}) hay setups para los coches que sueles descargar:` : `El Vault tiene ${seasonTotal} setups de la temporada ${season}. Coches con más setups:`}
${rows}
${rec ? `\nTus últimas descargas:\n${rec}\n` : ""}${events.length ? `\n${eventsText(events, tz)}` : ""}
Abrir el Setup Vault: ${SITE}/setups

Recibes este correo porque eres piloto del Setup Vault de Muntrume Motorsport.
--
Muntrume Motorsport · ${SITE}
Gestionar notificaciones: ${manageUrl}
Darse de baja: ${unsubUrl}
`;
  return { subject, html, text };
}

// ───────────────────────────── Eventos / carreras (solo fechas reales de team_events) ─────────────────────────────

const fmtEventDate = (iso, tz) => {
  try {
    const d = new Date(iso); const zone = tz || "Europe/Madrid";
    const day = d.toLocaleDateString("es-ES", { timeZone: zone, weekday: "short", day: "numeric", month: "short", year: "numeric" });
    const time = d.toLocaleTimeString("es-ES", { timeZone: zone, hour: "2-digit", minute: "2-digit" });
    const city = zone.split("/").pop().replace(/_/g, " ");
    return `${day} · ${time} (hora de ${city})`;
  } catch { return String(iso); }
};

/** Tarjetas de evento con «Añadir a Google Calendar» y descarga .ics. ev: {title, starts_at, track, car_class, url, gcal, ics} */
export function eventsBlock(events, tz) {
  if (!events || !events.length) return "";
  const cards = events.map((ev) => `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" class="box" style="margin:0 0 10px 0;background-color:#f6f8fa;border:1px solid #e5eaef;border-radius:12px;"><tr><td style="padding:14px 16px;">
      <p class="ink" style="margin:0 0 2px 0;font-size:16px;line-height:22px;font-weight:800;color:#0f172a;">${escapeHtml(ev.title)}</p>
      <p style="margin:0 0 2px 0;font-size:14px;line-height:20px;color:#047857;font-weight:700;" class="lnk">${escapeHtml(fmtEventDate(ev.starts_at, tz))}</p>
      ${[ev.track, ev.car_class].filter(Boolean).length ? `<p class="muted" style="margin:0 0 12px 0;font-size:13px;line-height:19px;color:#64748b;">${escapeHtml([ev.track, ev.car_class].filter(Boolean).join(" · "))}</p>` : `<div style="height:10px;line-height:10px;font-size:0;">&nbsp;</div>`}
      <table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr>
        <td bgcolor="#1a73e8" style="border-radius:8px;"><a href="${escapeHtml(ev.gcal)}" target="_blank" rel="noopener" style="display:inline-block;padding:11px 16px;font-size:14px;line-height:18px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:8px;">📅 Añadir a Google Calendar</a></td>
        <td width="8">&nbsp;</td>
        <td style="border:1px solid #cbd5e1;border-radius:8px;"><a href="${escapeHtml(ev.ics)}" target="_blank" rel="noopener" style="display:inline-block;padding:10px 14px;font-size:14px;line-height:18px;font-weight:700;color:#334155;text-decoration:none;">.ics</a></td>
      </tr></table>
    </td></tr></table>`).join("");
  return `<p class="muted" style="margin:6px 0 6px 0;font-size:12px;line-height:18px;color:#64748b;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Próximos eventos del equipo</p>${cards}`;
}
export function eventsText(events, tz) {
  if (!events || !events.length) return "";
  return "Próximos eventos del equipo:\n" + events.map((ev) => `- ${ev.title} — ${fmtEventDate(ev.starts_at, tz)}${ev.track ? ` · ${ev.track}` : ""}\n  Google Calendar: ${ev.gcal}\n  .ics: ${ev.ics}`).join("\n") + "\n";
}
/** schema.org Event (listo para cuando Google apruebe el remitente). */
export function eventsLd(events) {
  return (events || []).map((ev) => ({
    "@type": "Event", name: ev.title, startDate: ev.starts_at, endDate: ev.ends_at,
    eventStatus: "https://schema.org/EventScheduled", eventAttendanceMode: "https://schema.org/OnlineEventAttendanceMode",
    location: { "@type": "VirtualLocation", url: ev.url || `${SITE}/` },
    ...(ev.track ? { description: [ev.track, ev.car_class].filter(Boolean).join(" · ") } : {}),
    organizer: { "@type": "Organization", name: "Muntrume Motorsport", url: SITE },
    url: ev.url || `${SITE}/`,
  }));
}

/** 9) Aviso de evento/carrera del equipo (lista team_news, no esencial). Solo se genera con eventos reales de D1. */
export function teamEventEmail({ name, tz, events, manageUrl, unsubUrl }) {
  const first = events[0];
  const when = fmtEventDate(first.starts_at, tz);
  const subject = events.length === 1 ? `${first.title} · ${when.split(" · ")[0]} · Muntrume` : `${events.length} próximos eventos del equipo · Muntrume`;
  const tldr = events.length === 1
    ? [`Próximo evento: ${first.title}, el ${when}${first.track ? ` en ${first.track}` : ""}.`, "Puedes añadirlo a tu calendario con un toque."]
    : [`Hay ${events.length} eventos del equipo próximamente; el primero es ${first.title}, el ${when}.`, "Puedes añadirlos a tu calendario con un toque."];
  const html = layout({
    manageUrl, unsubUrl, securityNote: false, tldr,
    preheader: tldr.join(" "),
    title: events.length === 1 ? first.title : "Próximos eventos del equipo",
    jsonLd: eventsLd(events),
    bodyHtml: hello(name, tz) + eventsBlock(events, tz),
    cta: { url: `${SITE}/`, label: "Ver en muntru.me" },
    footerNote: "Recibes este correo porque eres piloto de Muntrume Motorsport y tienes activadas las noticias del equipo.",
  });
  const text = `${tldrText(tldr)}${greeting(name, tz)}:\n\n${eventsText(events, tz)}\n--\nMuntrume Motorsport · ${SITE}\nGestionar notificaciones: ${manageUrl}\nDarse de baja: ${unsubUrl}\n`;
  return { subject, html, text };
}
