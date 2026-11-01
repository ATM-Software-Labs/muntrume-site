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

/**
 * Layout base (Turno 7): una sola plantilla para todos los correos.
 * Tabla centrada de 560px, compatible con Gmail/Outlook/Apple Mail, legible en modo claro y oscuro,
 * sin píxeles de seguimiento ni recursos externos salvo el logo (PNG pequeño servido desde muntru.me).
 */
const SECURITY_NOTE = "Si no fuiste tú, ignora este correo: no se ha hecho ningún cambio en tu cuenta.";
const FONT = "Inter,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif";
function layout({ preheader, title, bodyHtml, cta, footerNote, securityNote = true }) {
  const ctaHtml = cta
    ? `<tr><td align="center" class="px" style="padding:6px 32px 26px 32px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr>
          <td align="center" bgcolor="#10b981" style="border-radius:10px;">
            <a href="${escapeHtml(cta.url)}" target="_blank" style="display:inline-block;padding:14px 30px;font-family:${FONT};font-size:15px;font-weight:700;color:#04241a;text-decoration:none;border-radius:10px;">${escapeHtml(cta.label)}</a>
          </td></tr></table>
        ${cta.hint ? `<p class="muted" style="margin:14px 0 0 0;font-family:${FONT};font-size:12px;line-height:18px;color:#64748b;">${cta.hint}</p>` : ""}
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
  }
</style>
</head>
<body class="bg" style="margin:0;padding:0;background-color:#eef2f5;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;mso-hide:all;">${escapeHtml(preheader)}&#8199;&#847;&#8199;&#847;&#8199;&#847;</div>
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
    <tr><td class="px body" style="padding:30px 32px 6px 32px;font-family:${FONT};color:#0f172a;">
      <h1 class="h1" style="margin:0 0 14px 0;font-size:22px;line-height:29px;font-weight:800;color:#0f172a;">${escapeHtml(title)}</h1>
      ${bodyHtml}
    </td></tr>
    ${ctaHtml}
    <tr><td class="px muted sep" style="padding:18px 32px 24px 32px;border-top:1px solid #eef2f5;font-family:${FONT};font-size:12px;line-height:18px;color:#64748b;">
      ${notes}
      <p style="margin:0;">Muntrume Motorsport · <a href="${SITE}" style="color:#059669;text-decoration:none;">muntru.me</a></p>
    </td></tr>
  </table>
</td></tr>
</table>
</body>
</html>`;
}

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

const textFooter = `\n\nSi no fuiste tú, ignora este correo: no se ha hecho ningún cambio en tu cuenta.\n--\nMuntrume Motorsport · ${SITE}\n`;

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
export function approvedLinkEmail({ name, email, link, expiresHours }) {
  const subject = "Acceso aprobado · Crea tu contraseña del Setup Vault";
  const html = layout({
    preheader: `Tu acceso está aprobado. El enlace caduca en ${expiresHours} horas.`,
    title: "¡Bienvenido al equipo!",
    bodyHtml:
      P(`Hola ${escapeHtml(firstName(name))},`) +
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
  const text = `Hola ${firstName(name)},

Control de Carrera ha aprobado tu solicitud. Ya tienes acceso al Setup Vault de Muntrume Motorsport.

Usuario: ${email}

Crea tu contraseña personal aquí (enlace personal, de un solo uso, caduca en ${expiresHours} horas):
${link}

Si el enlace caduca, usa «¿Olvidaste tu contraseña?» en ${SITE}/setups.${textFooter}`;
  return { subject, html, text };
}

/** 3b) Aprobado · con contraseña temporal (solo si el admin lo elige explícitamente) */
export function approvedTempPasswordEmail({ name, email, tempPassword }) {
  const subject = "Acceso aprobado · Tu contraseña temporal del Setup Vault";
  const html = layout({
    preheader: "Tu acceso está aprobado. Tendrás que cambiar la contraseña en el primer inicio de sesión.",
    title: "¡Bienvenido al equipo!",
    bodyHtml:
      P(`Hola ${escapeHtml(firstName(name))},`) +
      P("Control de Carrera ha aprobado tu solicitud. Estas son tus credenciales de acceso:") +
      infoBox([["Usuario", email], ["Contraseña temporal", tempPassword]]) +
      P("En tu primer acceso el sistema te pedirá elegir una contraseña personal. La temporal deja de funcionar en cuanto la cambies."),
    cta: { url: `${SITE}/setups`, label: "Entrar al Setup Vault" },
    footerNote: "Por seguridad, borra este correo después de cambiar la contraseña.",
  });
  const text = `Hola ${firstName(name)},

Control de Carrera ha aprobado tu solicitud. Estas son tus credenciales de acceso:

Usuario: ${email}
Contraseña temporal: ${tempPassword}

Entra en ${SITE}/setups. En tu primer acceso tendrás que elegir una contraseña personal.
Por seguridad, borra este correo después de cambiarla.${textFooter}`;
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
export function resetPasswordEmail({ name, link, expiresMinutes }) {
  const subject = "Restablece tu contraseña · Muntrume Setup Vault";
  const html = layout({
    preheader: `Enlace para crear una nueva contraseña. Caduca en ${expiresMinutes} minutos.`,
    title: "Restablecer contraseña",
    bodyHtml:
      P(`Hola ${escapeHtml(firstName(name))},`) +
      P("Hemos recibido una petición para crear o restablecer la contraseña de tu cuenta del Setup Vault."),
    cta: {
      url: link,
      label: "Crear nueva contraseña",
      hint: `El enlace es de un solo uso y caduca en ${expiresMinutes} minutos.`,
    },
    footerNote: "Tu contraseña actual no cambia hasta que elijas una nueva.",
  });
  const text = `Hola ${firstName(name)},

Hemos recibido una petición para crear o restablecer la contraseña de tu cuenta del Setup Vault.

Crea tu nueva contraseña aquí (un solo uso, caduca en ${expiresMinutes} minutos):
${link}
Tu contraseña actual no cambia hasta que elijas una nueva.${textFooter}`;
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
export function loginCodeEmail({ name, code, link, expiresMinutes }) {
  const subject = `${code} es tu código de acceso · Muntrume Setup Vault`;
  const html = layout({
    preheader: `Tu código de acceso es ${code}. Caduca en ${expiresMinutes} minutos.`,
    title: "Tu código de acceso",
    bodyHtml:
      P(`Hola ${escapeHtml(firstName(name))},`) +
      P("Usa este código para entrar en el Setup Vault. Es de un solo uso:") +
      codeBox(code) +
      (link ? P("O entra directamente desde este dispositivo con el botón:") : ""),
    cta: link ? { url: link, label: "Entrar al Setup Vault", hint: `El código y el enlace caducan en ${expiresMinutes} minutos y solo funcionan una vez. Nunca te pediremos este código por teléfono ni por chat.` } : null,
  });
  const text = `Hola ${firstName(name)},

Tu código de acceso al Setup Vault es: ${code}
${link ? `\nO entra directamente con este enlace:\n${link}\n` : ""}
El código${link ? " y el enlace" : ""} caducan en ${expiresMinutes} minutos y solo funcionan una vez. Nunca te pediremos este código por teléfono ni por chat.${textFooter}`;
  return { subject, html, text };
}
