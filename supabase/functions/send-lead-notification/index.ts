import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GMAIL_GATEWAY_URL = "https://connector-gateway.lovable.dev/google_mail/gmail/v1";

function buildRawEmail(to: string, subject: string, html: string): string {
  const message = [
    `To: ${to}`,
    `Subject: ${subject}`,
    "MIME-Version: 1.0",
    'Content-Type: text/html; charset="UTF-8"',
    "",
    html,
  ].join("\r\n");
  // base64url encode (UTF-8 safe)
  const b64 = btoa(unescape(encodeURIComponent(message)));
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { lead_id, lead_name, source, interest, contact, notes } = await req.json();

    const { data: recipients } = await supabase
      .from("lead_notification_recipients")
      .select("email")
      .eq("is_active", true);

    if (!recipients || recipients.length === 0) {
      return new Response(
        JSON.stringify({ success: true, sent: 0, message: "No active recipients configured" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const GOOGLE_MAIL_API_KEY = Deno.env.get("GOOGLE_MAIL_API_KEY");

    if (!LOVABLE_API_KEY || !GOOGLE_MAIL_API_KEY) {
      console.warn("Gmail connector not configured — skipping send. Recipients:", recipients.length);
      return new Response(
        JSON.stringify({
          success: false,
          skipped: true,
          reason: "Gmail connector not configured. Connect Gmail in Lovable to enable sending.",
          would_send_to: recipients.map((r: any) => r.email),
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const subject = `New Lead: ${lead_name}`;
    const html = `
      <h2>New Lead Submitted</h2>
      <p><strong>Name:</strong> ${lead_name}</p>
      ${contact ? `<p><strong>Contact:</strong> ${contact}</p>` : ""}
      ${source ? `<p><strong>Source:</strong> ${source}</p>` : ""}
      ${interest ? `<p><strong>Interest:</strong> ${interest}</p>` : ""}
      ${notes ? `<p><strong>Notes:</strong><br/>${String(notes).replace(/\n/g, "<br/>")}</p>` : ""}
      <p><a href="https://xprtsclienthub.lovable.app/leads?leadId=${lead_id}">Open lead in CRM</a></p>
    `;

    let sent = 0;
    const errors: string[] = [];

    for (const r of recipients as { email: string }[]) {
      try {
        const raw = buildRawEmail(r.email, subject, html);
        const resp = await fetch(`${GMAIL_GATEWAY_URL}/users/me/messages/send`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "X-Connection-Api-Key": GOOGLE_MAIL_API_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ raw }),
        });
        if (!resp.ok) {
          const t = await resp.text();
          errors.push(`${r.email}: ${resp.status} ${t}`);
          await supabase.from("notification_logs").insert({
            channel: "lead", recipient_email: r.email, lead_id: lead_id || null,
            subject, status: "failed", error_message: `${resp.status} ${t}`.slice(0, 1000),
          });
        } else {
          sent++;
          const body = await resp.json().catch(() => ({}));
          await supabase.from("notification_logs").insert({
            channel: "lead", recipient_email: r.email, lead_id: lead_id || null,
            subject, status: "sent", message_id: body?.id || null,
          });
        }
      } catch (e) {
        errors.push(`${r.email}: ${(e as Error).message}`);
        await supabase.from("notification_logs").insert({
          channel: "lead", recipient_email: r.email, lead_id: lead_id || null,
          subject, status: "failed", error_message: (e as Error).message.slice(0, 1000),
        });
      }
    }

    return new Response(JSON.stringify({ success: true, sent, errors }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("send-lead-notification error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});