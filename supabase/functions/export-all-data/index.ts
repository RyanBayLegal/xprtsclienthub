import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-export-token",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const TABLES = [
  "profiles","user_roles","branding_settings","lead_sources","lead_notification_recipients",
  "leads","client_profiles","client_notes","client_attachments","client_invoices",
  "client_projects","key_people","placed_vas","talent_pool","talent_attachments",
  "engagement_agreements","scoping_questionnaires","systems_audits","roles_open",
  "tasks","task_comments","task_attachments","activity_time_entries",
  "schedule_clients","schedule_blocks","staff_schedules","time_off_requests",
  "vendors","vendor_attachments","team_links","notifications","notification_logs",
  "workflow_automations","workflow_automation_logs","audit_logs",
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Require an authenticated team_admin session. The static export token alone
  // is no longer sufficient — it may only be used in ADDITION to a valid session.
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

  const { data: isAdmin } = await supabase.rpc("has_role", {
    _user_id: callerId,
    _role: "team_admin",
  });
  if (!isAdmin) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const includeAuthUsers = req.headers.get("x-include-auth-users") === "true";
  console.log(`export-all-data invoked by ${callerId} at ${new Date().toISOString()}`);
  await supabase.from("audit_logs").insert({
    action: "export_all_data",
    entity_type: "system",
    user_id: callerId,
  }).then(({ error }) => {
    if (error) console.error("audit log insert failed:", error.message);
  });

  const result: Record<string, unknown> = {};
  const errors: Record<string, string> = {};
  const PAGE = 1000;

  // Dump auth.users only when explicitly requested
  if (includeAuthUsers) try {
    const authUsers: Array<{ id: string; email: string | undefined; raw_user_meta_data: unknown }> = [];
    let page = 1;
    const perPage = 1000;
    while (true) {
      const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
      if (error) {
        errors["auth_users"] = error.message;
        break;
      }
      const users = data?.users ?? [];
      for (const u of users) {
        authUsers.push({
          id: u.id,
          email: u.email,
          raw_user_meta_data: (u as unknown as { user_metadata: unknown }).user_metadata,
        });
      }
      if (users.length < perPage) break;
      page += 1;
    }
    result["auth_users"] = authUsers;
  } catch (e) {
    errors["auth_users"] = (e as Error).message;
  }

  for (const table of TABLES) {
    const rows: unknown[] = [];
    let from = 0;
    while (true) {
      const { data, error } = await supabase
        .from(table)
        .select("*")
        .range(from, from + PAGE - 1);
      if (error) {
        errors[table] = error.message;
        break;
      }
      if (!data || data.length === 0) break;
      rows.push(...data);
      if (data.length < PAGE) break;
      from += PAGE;
    }
    result[table] = rows;
  }

  return new Response(
    JSON.stringify({ ...result, _errors: Object.keys(errors).length ? errors : undefined }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});