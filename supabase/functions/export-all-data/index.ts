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

  const expected = Deno.env.get("EXPORT_TOKEN");
  const provided = req.headers.get("x-export-token");
  if (!expected || !provided || provided !== expected) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const result: Record<string, unknown> = {};
  const errors: Record<string, string> = {};
  const PAGE = 1000;

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