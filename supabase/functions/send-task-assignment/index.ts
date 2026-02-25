import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { assignee_email, assignee_name, task_title, task_description, due_date } = await req.json();

    console.log("=== TASK ASSIGNMENT EMAIL ===");
    console.log(`To: ${assignee_email} (${assignee_name})`);
    console.log(`Task: ${task_title}`);
    console.log(`Description: ${task_description || "N/A"}`);
    console.log(`Due: ${due_date || "No due date"}`);
    console.log("=============================");
    console.log("NOTE: Configure RESEND_API_KEY to enable actual email delivery.");

    return new Response(
      JSON.stringify({ success: true, message: "Email logged (no RESEND_API_KEY configured)" }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
