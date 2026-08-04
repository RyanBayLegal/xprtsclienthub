import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, runAutomations } from "../_shared/automation-runner.ts";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const authClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData, error: userError } = await authClient.auth.getUser(
      authHeader.replace("Bearer ", ""),
    );
    const callerId = userData?.user?.id;
    if (userError || !callerId) return json({ error: "Unauthorized" }, 401);

    const { trigger_type, context } = await req.json();
    if (!trigger_type) return json({ error: "trigger_type is required" }, 400);

    const results = await runAutomations(trigger_type, context || {}, callerId);
    return json({ success: true, results });
  } catch (e) {
    console.error("run-automation failed", e);
    return json({ error: (e as Error)?.message ?? String(e) }, 500);
  }
});