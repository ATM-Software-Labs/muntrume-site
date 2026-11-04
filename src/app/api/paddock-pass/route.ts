export const runtime = "edge";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const nombre_piloto = (body.nombre_piloto || body.name || "").trim();
    const email_iracing = (body.email_iracing || body.email || "").trim();
    const mensaje = (body.mensaje || body.message || "").trim();

    if (!nombre_piloto || !email_iracing) {
      return new Response(JSON.stringify({ error: "Nombre y email son requeridos" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    const apiKey = process.env.RESEND_API_KEY;
    if (apiKey) {
      const payload = {
        from: process.env.RESEND_FROM_EMAIL || "Muntrume Paddock <paddock@muntru.me>",
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

      let res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok && (res.status === 403 || res.status === 422)) {
        payload.from = "Muntrume Paddock <onboarding@resend.dev>";
        res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify(payload)
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          if (res.status === 403 && errData?.message && errData.message.includes("You can only send testing emails")) {
            const ownerEmail = (errData.message.match(/\(([^)]+)\)/) || [])[1] || "jostrume16@gmail.com";
            payload.to = [ownerEmail];
            payload.subject = `[DEV -> alberto@trujillomingorance.com] ${payload.subject}`;
            await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${apiKey}`,
                "Content-Type": "application/json"
              },
              body: JSON.stringify(payload)
            });
          }
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message:
          "Solicitud recibida correctamente. Nos pondremos en contacto via email o por la radio de Discord."
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        }
      }
    );
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message || "Error procesando solicitud" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    }
  });
}
