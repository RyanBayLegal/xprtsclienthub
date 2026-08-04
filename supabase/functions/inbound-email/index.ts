import { corsHeaders, adminClient, runAutomations } from "../_shared/automation-runner.ts";

// Public webhook: receives inbound email payloads from a mail provider
// (Zapier / Make / Mailgun / SendGrid parse / n8n) and fires any
// "Email received" automations.
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const contentType = req.headers.get("content-type") || "";
    // deno-lint-ignore no-explicit-any
    let payload: Record<string, any> = {};
    if (contentType.includes("application/json")) {
      payload = await req.json();
    } else {
      const form = await req.formData();
      for (const [k, v] of form.entries()) payload[k] = typeof v === "string" ? v : v.name;
    }

    const pick = (...keys: string[]) => {
      for (const k of keys) {
        const v = payload[k];
        if (typeof v === "string" && v.trim()) return v.trim();
      }
      return "";
    };

    const rawFrom = pick("from", "From", "sender", "from_email", "envelope_from");
    const emailMatch = rawFrom.match(/[\w.+-]+@[\w-]+\.[\w.-]+/);
    const fromEmail = (pick("from_email") || emailMatch?.[0] || "").toLowerCase();
    const fromName = pick("from_name") || rawFrom.replace(/<[^>]*>/, "").replace(/"/g, "").trim();
    const toEmail = pick("to", "To", "recipient", "to_email");
    const subject = pick("subject", "Subject");
    const bodyText = pick("text", "body", "body_plain", "stripped-text", "plain");
    const bodyHtml = pick("html", "body_html", "stripped-html");

    const db = adminClient();

    // Try to match the sender to an existing lead or client.
    let matchedLeadId: string | null = null;
    let matchedClientId: string | null = null;
    if (fromEmail) {
      const { data: lead } = await db
        .from("leads")
        .select("id")
        .ilike("contact", `%${fromEmail}%`)
        .limit(1)
        .maybeSingle();
      matchedLeadId = lead?.id ?? null;
      const { data: client } = await db
        .from("client_profiles")
        .select("id")
        .ilike("email", fromEmail)
        .limit(1)
        .maybeSingle();
      matchedClientId = client?.id ?? null;
    }

    const { data: inserted } = await db
      .from("inbound_emails")
      .insert({
        from_email: fromEmail || null,
        from_name: fromName || null,
        to_email: toEmail || null,
        subject: subject || null,
        body_text: bodyText || null,
        body_html: bodyHtml || null,
        raw_payload: payload,
        matched_lead_id: matchedLeadId,
        matched_client_id: matchedClientId,
        processed: true,
      })
      .select("id")
      .maybeSingle();

    const results = await runAutomations("email_received", {
      email_id: inserted?.id ?? null,
      from_email: fromEmail,
      from_name: fromName,
      to_email: toEmail,
      subject,
      body: bodyText || bodyHtml,
      email: fromEmail,
      name: fromName || fromEmail,
      lead_id: matchedLeadId,
      client_profile_id: matchedClientId,
    }, null);

    return json({ success: true, matched_lead_id: matchedLeadId, automations_run: results.length });
  } catch (e) {
    console.error("inbound-email failed", e);
    return json({ error: (e as Error)?.message ?? String(e) }, 500);
  }
});