/**
 * Paddock Pass Dispatcher for Muntrume Motorsport
 * Sends requests to alberto@trujillomingorance.com via Resend
 */

export async function onRequestPost(context) {
  const { request, env } = context;

  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json"
  };

  try {
    const body = await request.json().catch(() => ({}));
    const nombre_piloto = (body.nombre_piloto || body.name || "").trim();
    const email_iracing = (body.email_iracing || body.email || "").trim();
    const mensaje = (body.mensaje || body.message || "").trim();

    if (!nombre_piloto || !email_iracing) {
      return new Response(
        JSON.stringify({ success: false, error: "Nombre y email son requeridos" }),
        { status: 400, headers: corsHeaders }
      );
    }

    const ip = request.headers.get("cf-connecting-ip") || "89.128.216.86";
    const emailToken = env.RESEND_API_KEY || (typeof process !== "undefined" && process.env?.RESEND_API_KEY);

    if (emailToken) {
      const targetRecipient = body.to || env.PADDOCK_PASS_TO || "alberto@trujillomingorance.com";
      const emailPayload = {
        from: env.RESEND_FROM_EMAIL || "Muntrume Paddock <muntrume@trujillomingorance.com>",
        to: Array.isArray(targetRecipient) ? targetRecipient : [targetRecipient],
        subject: `Nuevo Paddock Pass - ${nombre_piloto}`,
        html: `<!DOCTYPE html>
        <html>
        <body style="margin:0;padding:0;background-color:#0E1211;font-family:JetBrains Mono,monospace;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0E1211;padding:40px 0;">
            <tr><td align="center">
              <table width="600" cellpadding="0" cellspacing="0" style="background-color:#1A2120;border:1px solid #2A3331;border-radius:12px;overflow:hidden;">
                <tr><td style="background-color:#0E1211;padding:24px 32px;border-bottom:1px solid #1A2120;">
                  <span style="color:#00E699;font-size:10px;letter-spacing:3px;">● MUNTRUME MOTORSPORT // PADDOCK PASS</span>
                  <h1 style="color:#FFFFFF;font-size:22px;margin:12px 0 0 0;">Nueva solicitud Paddock Pass</h1>
                </td></tr>
                <tr><td style="padding:32px;">
                  <table width="100%">
                    <tr><td style="padding:12px 0;border-bottom:1px solid #2A3331;"><span style="color:#7A8A87;font-size:11px;letter-spacing:1px;">NOMBRE DEL PILOTO</span><br><span style="color:#FFFFFF;font-size:16px;font-weight:600;">${nombre_piloto}</span></td></tr>
                    <tr><td style="padding:12px 0;border-bottom:1px solid #2A3331;"><span style="color:#7A8A87;font-size:11px;">EMAIL IRACING</span><br><a href="mailto:${email_iracing}" style="color:#00E699;font-size:14px;text-decoration:none;">${email_iracing}</a></td></tr>
                    <tr><td style="padding:12px 0;border-bottom:1px solid #2A3331;"><span style="color:#7A8A87;font-size:11px;">MENSAJE</span><br><span style="color:#E0E0E0;font-size:14px;line-height:20px;">${mensaje}</span></td></tr>
                    <tr><td style="padding:12px 0;">
                      <span style="color:#7A8A87;font-size:11px;">META</span><br>
                      <span style="color:#5A6A67;font-size:12px;">Fecha: ${new Date().toISOString()}<br>IP: ${ip}<br>Slugs: albertot 993381, mateob 1134615, eduardoc 1076585 CR 🇨🇷, juanluc</span>
                    </td></tr>
                  </table>
                  <div style="margin-top:32px;text-align:center;">
                    <a href="mailto:${email_iracing}" style="display:inline-block;background-color:#00E699;color:#0E1211;padding:12px 24px;border-radius:9999px;font-size:12px;font-weight:700;text-decoration:none;letter-spacing:1px;">RESPONDER AL PILOTO →</a>
                  </div>
                </td></tr>
                <tr><td style="background-color:#0E1211;padding:16px 32px;text-align:center;border-top:1px solid #1A2120;">
                  <span style="color:#3A4A47;font-size:10px;">Muntrume Motorsport | muntrume@trujillomingorance.com | Garage 61 Connected</span>
                </td></tr>
              </table>
            </td></tr>
          </table>
        </body>
        </html>`
      };

      let resendRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${emailToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(emailPayload)
      });

      if (!resendRes.ok && (resendRes.status === 403 || resendRes.status === 422)) {
        emailPayload.from = "Muntrume Paddock <onboarding@resend.dev>";
        resendRes = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${emailToken}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify(emailPayload)
        });

        if (!resendRes.ok) {
          const errData = await resendRes.json().catch(() => ({}));
          if (resendRes.status === 403 && errData?.message && errData.message.includes("You can only send testing emails")) {
            const ownerEmail = (errData.message.match(/\(([^)]+)\)/) || [])[1] || "jostrume16@gmail.com";
            emailPayload.to = [ownerEmail];
            emailPayload.subject = `[DEV -> alberto@trujillomingorance.com] ${emailPayload.subject}`;
            await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${emailToken}`,
                "Content-Type": "application/json"
              },
              body: JSON.stringify(emailPayload)
            });
          }
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Solicitud recibida correctamente. Nos pondremos en contacto via email o por la radio de Discord."
      }),
      { status: 200, headers: corsHeaders }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: err?.message || "Error procesando solicitud" }),
      { status: 500, headers: corsHeaders }
    );
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    }
  });
}
