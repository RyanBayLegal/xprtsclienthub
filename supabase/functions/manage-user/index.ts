import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPER_ADMIN_EMAIL = "ryan@baylegal.com";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const anonClient = createClient(supabaseUrl, anonKey);
    const { data: { user: caller } } = await anonClient.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (!caller) return json({ error: "Unauthorized" }, 401);

    if ((caller.email || "").toLowerCase() !== SUPER_ADMIN_EMAIL) {
      return json({ error: "Forbidden: super admin only" }, 403);
    }

    const admin = createClient(supabaseUrl, serviceRoleKey);
    const { action, userId } = await req.json();

    if (!userId) return json({ error: "userId is required" }, 400);
    if (userId === caller.id) return json({ error: "You cannot modify your own access" }, 400);

    if (action === "disable" || action === "enable") {
      const isActive = action === "enable";
      const { error } = await admin
        .from("profiles")
        .update({ is_active: isActive })
        .eq("user_id", userId);
      if (error) return json({ error: error.message }, 400);
      if (!isActive) {
        try { await admin.auth.admin.signOut(userId, "global"); } catch (_e) { /* ignore */ }
      }
      return json({ success: true, is_active: isActive });
    }

    if (action === "delete") {
      await admin.from("user_roles").delete().eq("user_id", userId);
      await admin.from("profiles").delete().eq("user_id", userId);
      const { error } = await admin.auth.admin.deleteUser(userId);
      if (error) return json({ error: error.message }, 400);
      return json({ success: true });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
});
