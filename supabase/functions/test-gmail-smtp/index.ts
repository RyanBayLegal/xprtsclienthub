import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // Require an authenticated team_admin session
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const authClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );
  const { data: userData, error: userError } = await authClient.auth.getUser(
    authHeader.replace("Bearer ", "")
  );
  const callerId = userData?.user?.id;
  if (userError || !callerId) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
  const { data: isAdmin } = await admin.rpc("has_role", {
    _user_id: callerId,
    _role: "team_admin",
  });
  if (!isAdmin) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const GMAIL_USER = Deno.env.get("GMAIL_USER");
  const GMAIL_APP_PASSWORD = Deno.env.get("GMAIL_APP_PASSWORD");

  if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
    return new Response(
      JSON.stringify({
        configured: false,
        ok: false,
        message: "Gmail SMTP credentials not configured yet.",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  let sendTo: string | undefined;
  try {
    const body = await req.json().catch(() => ({}));
    sendTo = body?.to;
  } catch (_) { /* ignore */ }

  const client = new SMTPClient({
    connection: {
      hostname: "smtp.gmail.com",
      port: 465,
      tls: true,
      auth: { username: GMAIL_USER, password: GMAIL_APP_PASSWORD },
    },
  });

  try {
    if (sendTo) {
      await client.send({
        from: GMAIL_USER,
        to: sendTo,
        subject: "Gmail SMTP test from CRM",
        content: "This is a test message confirming your Gmail SMTP credentials work.",
        html: "<p>This is a test message confirming your <strong>Gmail SMTP</strong> credentials work.</p>",
      });
    }
    await client.close();
    return new Response(
      JSON.stringify({
        configured: true,
        ok: true,
        gmail_user: GMAIL_USER,
        sent_test: !!sendTo,
        message: sendTo ? `Test email sent to ${sendTo}.` : "SMTP credentials are configured.",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    try { await client.close(); } catch (_) { /* ignore */ }
    return new Response(
      JSON.stringify({
        configured: true,
        ok: false,
        gmail_user: GMAIL_USER,
        error: (e as Error).message,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});