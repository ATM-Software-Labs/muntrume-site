/**
 * Cloudflare Pages Function: /api/mail/send
 * Dispatches emails via Brevo (Sendinblue) REST API v3
 */

export async function onRequestPost(context) {
  const { request, env } = context;

  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, api-key, Authorization",
    "Content-Type": "application/json"
  };

  try {
    const body = await request.json();
    const { to, subject, htmlContent, textContent, fromName, fromEmail, attachments } = body;

    if (!to || !subject || (!htmlContent && !textContent)) {
      return new Response(
        JSON.stringify({ success: false, error: "Faltan campos obligatorios (to, subject, content)" }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Retrieve Brevo API Key from environment or request headers/body
    const apiKey = env.BREVO_API_KEY || 
                   request.headers.get("api-key") || 
                   request.headers.get("x-brevo-key") || 
                   body.apiKey;

    const senderEmail = fromEmail || env.BREVO_SENDER_EMAIL || "alberto@muntru.me";
    const senderName = fromName || env.BREVO_SENDER_NAME || "Muntrume Motorsport";

    // Format destination addresses
    const toRecipients = Array.isArray(to) 
      ? to.map(email => (typeof email === "string" ? { email: email.trim() } : email))
      : [{ email: String(to).trim() }];

    const brevoPayload = {
      sender: {
        name: senderName,
        email: senderEmail
      },
      to: toRecipients,
      subject: subject,
      htmlContent: htmlContent || `<p>${textContent}</p>`,
      ...(textContent ? { textContent } : {}),
      ...(attachments && Array.isArray(attachments) ? { attachment: attachments } : {})
    };

    if (apiKey) {
      const brevoRes = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: {
          "accept": "application/json",
          "api-key": apiKey,
          "content-type": "application/json"
        },
        body: JSON.stringify(brevoPayload)
      });

      const brevoData = await brevoRes.json();

      if (!brevoRes.ok) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: brevoData.message || "Error al enviar mediante Brevo API",
            details: brevoData 
          }),
          { status: brevoRes.status, headers: corsHeaders }
        );
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          messageId: brevoData.messageId, 
          provider: "Brevo SMTP Relay",
          relay: "Cloudflare Edge"
        }),
        { status: 200, headers: corsHeaders }
      );
    }

    // Simulation / Local relay mode if Brevo API key is not yet configured in env
    return new Response(
      JSON.stringify({ 
        success: true, 
        simulated: true, 
        messageId: "sim-" + Date.now(), 
        provider: "Brevo Relay Ready (Set BREVO_API_KEY to dispatch live)",
        relay: "Cloudflare Edge"
      }),
      { status: 200, headers: corsHeaders }
    );

  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: err.message || "Error interno del servidor" }),
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
      "Access-Control-Allow-Headers": "Content-Type, api-key, Authorization"
    }
  });
}
