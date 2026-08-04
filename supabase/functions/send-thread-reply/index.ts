import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, adminClient, sendMail } from "../_shared/automation-runner.ts";

// Sends a reply email to a lead or client and records it in the shared
// conversation thread (notification_logs, direction = outbound).
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: claimsError } = await userClient.auth.getClaims(token);
    const userId = claims?.claims?.sub as string | undefined;
    if (claimsError || !userId) return json({ error: "Unauthorized" }, 401);

    const db = adminClient();
    const { data: roles } = await db.from("user_roles").select("role").eq("user_id", userId);
    const allowed = (roles || []).some((r: { role: string }) => r.role === "team_admin" || r.role === "staff_member");
    if (!allowed) return json({ error: "Forbidden" }, 403);

    const { to, subject, body, lead_id, client_profile_id } = await req.json();
    if (!to || !body) return json({ error: "Recipient and message are required" }, 400);

    const html = String(body).replace(/\n/g, "<br/>");
    const finalSubject = String(subject || "Re:");

    try {
      await sendMail(String(to), finalSubject, html);
    } catch (e) {
      await db.from("notification_logs").insert({
        channel: "thread_reply",
        direction: "outbound",
        recipient_email: to,
        subject: finalSubject,
        body_html: html,
        body_text: String(body),
        lead_id: lead_id || null,
        client_profile_id: client_profile_id || null,
        status: "failed",
        error_message: (e as Error)?.message ?? String(e),
      });
      return json({ error: (e as Error)?.message ?? "Send failed" }, 500);
    }

    await db.from("notification_logs").insert({
      channel: "thread_reply",
      direction: "outbound",
      recipient_email: to,
      subject: finalSubject,
      body_html: html,
      body_text: String(body),
      lead_id: lead_id || null,
      client_profile_id: client_profile_id || null,
      status: "sent",
    });

    return json({ success: true });
  } catch (e) {
    return json({ error: (e as Error)?.message ?? String(e) }, 500);
  }
});
