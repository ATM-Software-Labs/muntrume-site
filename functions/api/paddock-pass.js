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

    const emailToken = env.RESEND_API_KEY || (typeof process !== "undefined" && process.env?.RESEND_API_KEY);

    if (emailToken) {
      const emailPayload = {
        from: env.RESEND_FROM_EMAIL || "Muntrume Paddock <paddock@muntru.me>",
        to: ["alberto@trujillomingorance.com"],
        reply_to: email_iracing,
        subject: `Nuevo Paddock Pass - ${nombre_piloto} - ${email_iracing}`,
        html: `
          <h2>Nueva solicitud Paddock Pass</h2>
          <p><strong>Nombre del piloto:</strong> ${nombre_piloto}</p>
          <p><strong>Email iRacing:</strong> ${email_iracing}</p>
          <p><strong>Mensaje:</strong> ${mensaje}</p>
          <p><strong>Fecha:</strong> ${new Date().toISOString()}</p>
          <p><strong>Slugs:</strong> albertot 993381, mateob 1134615, eduardoc 1076585 CR, juanluc</p>
        `
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
